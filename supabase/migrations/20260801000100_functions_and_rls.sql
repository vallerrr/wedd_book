-- Wedd Book — identity helpers, privileged RPCs, and RLS.
--
-- Design note: there are no Edge Functions. Every privileged operation is a
-- SECURITY DEFINER function called through supabase.rpc(), which keeps cold
-- starts off the critical path on a congested mobile network.

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------

-- The guest behind the current anonymous session, or null.
create function current_guest_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id from guests where auth_user_id = auth.uid();
$$;

create function is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from admin_profiles where user_id = auth.uid());
$$;

-- Calendar day at the venue, not in UTC — the quota resets at local midnight.
create function venue_today()
  returns date
  language sql
  stable
  security definer
  set search_path = public
as $$
  select (now() at time zone (select venue_timezone from app_settings where id = 1))::date;
$$;

-- ---------------------------------------------------------------------------
-- Visibility. Defined once and reused by both the photos policy and the
-- storage.objects policy so the two can never drift apart.
-- ---------------------------------------------------------------------------
create function can_view_photo(p photos)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select case
    when is_admin() then true
    when p.status = 'hidden' then false

    -- Your own bingo answers are always yours to see.
    when p.kind = 'bingo' and p.guest_id = current_guest_id() then true

    -- Everyone else's bingo answers open up on review night.
    when p.kind = 'bingo' then
      coalesce((select bingo_review_at from app_settings where id = 1) <= now(), false)

    -- Disposable is blind: deliberately no "own photos" exemption here.
    when p.kind = 'disposable' then
      (select gallery_visible from app_settings where id = 1)
      and coalesce((select disposable_reveal_at from app_settings where id = 1) <= now(), false)

    when p.kind = 'guestbook' then
      (select gallery_visible from app_settings where id = 1)

    else false
  end;
$$;

-- Ownership check for the storage INSERT policy.
--
-- This has to be SECURITY DEFINER. A plain `exists (select 1 from photos ...)`
-- inside a storage.objects policy runs as the guest, so RLS on `photos`
-- applies — and a guest deliberately cannot see their own blind disposable
-- row. The subquery would find nothing and every upload would be refused.
create function owns_photo_path(p_path text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from photos ph
     where (ph.storage_path = p_path or ph.thumb_path = p_path)
       and ph.guest_id = current_guest_id()
  );
$$;

-- Storage-side equivalent, keyed by object path.
create function can_view_photo_path(p_path text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select can_view_photo(ph) from photos ph
      where ph.storage_path = p_path or ph.thumb_path = p_path
      limit 1),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Redeeming an invite code
-- ---------------------------------------------------------------------------
create function redeem_invite_code(p_code text)
  returns guests
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_guest guests;
  v_norm  text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Tolerate what people actually type: caps, spaces, stray dashes.
  v_norm := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));

  -- Already redeemed on this device/session — idempotent, just return it.
  select * into v_guest from guests where auth_user_id = v_uid;
  if found then
    update guests set last_seen_at = now() where id = v_guest.id;
    return v_guest;
  end if;

  select * into v_guest from guests where invite_code = v_norm;

  if not found then
    -- No row to count against, so this is only rate-limited by Supabase's
    -- per-IP anonymous sign-in limit. That is deliberate: we must not leak
    -- which codes exist by behaving differently for near-misses.
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if v_guest.failed_attempts >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  -- Someone else already claimed this code. Count it and refuse.
  if v_guest.auth_user_id is not null then
    update guests
       set failed_attempts = failed_attempts + 1
     where id = v_guest.id;
    raise exception 'code_already_used' using errcode = 'P0001';
  end if;

  update guests
     set auth_user_id = v_uid,
         redeemed_at  = coalesce(redeemed_at, now()),
         last_seen_at = now()
   where id = v_guest.id
  returning * into v_guest;

  return v_guest;
end;
$$;

-- ---------------------------------------------------------------------------
-- Creating photos. Quota check and insert happen in one transaction, so two
-- simultaneous uploads can never both spend the last credit.
-- ---------------------------------------------------------------------------
create function create_disposable_photo(
  p_source       text,
  p_storage_path text,
  p_thumb_path   text default null,
  p_width        int  default null,
  p_height       int  default null,
  p_bytes        int  default null
)
  returns photos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_guest uuid := current_guest_id();
  v_day   date := venue_today();
  v_cost  int;
  v_max   int;
  v_used  int;
  v_anon  boolean;
  v_row   photos;
begin
  if v_guest is null then
    raise exception 'not_a_guest' using errcode = '28000';
  end if;

  if p_source not in ('capture', 'upload') then
    raise exception 'bad_source' using errcode = 'P0001';
  end if;

  select case when p_source = 'capture' then capture_cost else upload_cost end,
         daily_photo_credits
    into v_cost, v_max
    from app_settings where id = 1;

  insert into photo_credits (guest_id, day, used)
  values (v_guest, v_day, 0)
  on conflict (guest_id, day) do nothing;

  -- The WHERE clause *is* the quota check. One statement, no race.
  update photo_credits
     set used = used + v_cost
   where guest_id = v_guest
     and day = v_day
     and used + v_cost <= v_max
  returning used into v_used;

  if v_used is null then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  select default_anonymous into v_anon from guests where id = v_guest;

  insert into photos (
    guest_id, kind, source, credit_cost, storage_path, thumb_path,
    width, height, bytes, local_day, display_mode
  )
  values (
    v_guest, 'disposable', p_source, v_cost, p_storage_path, p_thumb_path,
    p_width, p_height, p_bytes, v_day,
    case when v_anon then 'anonymous' else 'named' end
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Bingo answers cost no credits and there is exactly one live slot per
-- guest per question, so re-answering replaces rather than adds.
create function upsert_bingo_photo(
  p_question_id  uuid,
  p_source       text,
  p_storage_path text,
  p_thumb_path   text default null,
  p_width        int  default null,
  p_height       int  default null,
  p_bytes        int  default null
)
  returns photos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_guest uuid := current_guest_id();
  v_row   photos;
begin
  if v_guest is null then
    raise exception 'not_a_guest' using errcode = '28000';
  end if;

  if p_source not in ('capture', 'upload') then
    raise exception 'bad_source' using errcode = 'P0001';
  end if;

  if not exists (select 1 from bingo_questions where id = p_question_id and active) then
    raise exception 'unknown_question' using errcode = 'P0001';
  end if;

  -- Retire the previous answer. Kept, not deleted — the old file is cleaned
  -- up out of band so a failed replacement never loses the original.
  update photos
     set status = 'hidden'
   where guest_id = v_guest
     and question_id = p_question_id
     and kind = 'bingo'
     and status <> 'hidden';

  insert into photos (
    guest_id, kind, source, credit_cost, storage_path, thumb_path,
    width, height, bytes, local_day, question_id
  )
  values (
    v_guest, 'bingo', p_source, 0, p_storage_path, p_thumb_path,
    p_width, p_height, p_bytes, venue_today(), p_question_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Called once the bytes are actually in Storage.
create function mark_photo_ready(p_photo_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update photos
     set status = 'ready'
   where id = p_photo_id
     and guest_id = current_guest_id()
     and status = 'pending';
end;
$$;

-- Credits are spent at capture time so the quota stays honest on a flaky
-- network. If the upload never lands, the guest gets the credit back.
create function refund_failed_photo(p_photo_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_guest uuid := current_guest_id();
  v_photo photos;
begin
  select * into v_photo
    from photos
   where id = p_photo_id and guest_id = v_guest and status = 'pending';

  if not found then
    return;
  end if;

  update photos set status = 'failed' where id = p_photo_id;

  if v_photo.credit_cost > 0 then
    update photo_credits
       set used = greatest(0, used - v_photo.credit_cost)
     where guest_id = v_guest and day = v_photo.local_day;
  end if;
end;
$$;

-- Small enough to fetch on every camera screen load.
create function my_credits_remaining()
  returns int
  language sql
  stable
  security definer
  set search_path = public
as $$
  select greatest(
    0,
    (select daily_photo_credits from app_settings where id = 1)
    - coalesce(
        (select used from photo_credits
          where guest_id = current_guest_id() and day = venue_today()),
        0
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table app_settings      enable row level security;
alter table guests            enable row level security;
alter table photo_credits     enable row level security;
alter table bingo_questions   enable row level security;
alter table photos            enable row level security;
alter table program_days      enable row level security;
alter table program_items     enable row level security;
alter table content_blocks    enable row level security;
alter table guestbook_entries enable row level security;
alter table admin_profiles    enable row level security;

-- Supabase grants broadly to anon/authenticated by default; narrow it right
-- down and let the RPCs do the privileged work.
revoke all on all tables in schema public from anon, authenticated;

-- Default privileges are keyed to the creating role, and migrations run as
-- `postgres` rather than `supabase_admin` — so tables created here do not
-- inherit service_role's usual DML grants. Grant them explicitly, or the
-- service key silently loses access to every table in this schema.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Settings: everyone reads (the app needs reveal times to render countdowns),
-- only admins write.
grant select on app_settings to anon, authenticated;
create policy app_settings_read on app_settings
  for select to anon, authenticated using (true);
create policy app_settings_admin_write on app_settings
  for update to authenticated using (is_admin()) with check (is_admin());

-- Programme is public — no invite code, and readable in WeChat.
grant select on program_days, program_items, content_blocks to anon, authenticated;
create policy program_days_read on program_days
  for select to anon, authenticated using (true);
create policy program_items_read on program_items
  for select to anon, authenticated using (visible);
create policy content_blocks_read on content_blocks
  for select to anon, authenticated using (visible);

create policy program_days_admin on program_days
  for all to authenticated using (is_admin()) with check (is_admin());
create policy program_items_admin on program_items
  for all to authenticated using (is_admin()) with check (is_admin());
create policy content_blocks_admin on content_blocks
  for all to authenticated using (is_admin()) with check (is_admin());

-- Guests: you can see and lightly edit yourself. Column grants stop a guest
-- rewriting their own invite_code or re-pointing auth_user_id.
grant select on guests to authenticated;
grant update (default_anonymous, locale) on guests to authenticated;
create policy guests_read_self on guests
  for select to authenticated using (id = current_guest_id() or is_admin());
create policy guests_update_self on guests
  for update to authenticated
  using (id = current_guest_id())
  with check (id = current_guest_id());
create policy guests_admin_all on guests
  for all to authenticated using (is_admin()) with check (is_admin());

-- Quota ledger is read-only to its owner; only the RPCs move it.
grant select on photo_credits to authenticated;
create policy photo_credits_read_self on photo_credits
  for select to authenticated using (guest_id = current_guest_id() or is_admin());

-- The 16 prompts are visible to any signed-in guest.
grant select on bingo_questions to authenticated;
create policy bingo_questions_read on bingo_questions
  for select to authenticated using (active or is_admin());
create policy bingo_questions_admin on bingo_questions
  for all to authenticated using (is_admin()) with check (is_admin());

-- Photos: reads go through can_view_photo; writes go through the RPCs only.
-- The single permitted direct write is flipping your own named/anonymous.
grant select on photos to authenticated;
grant update (display_mode) on photos to authenticated;
create policy photos_read on photos
  for select to authenticated using (can_view_photo(photos));
create policy photos_update_own_display on photos
  for update to authenticated
  using (guest_id = current_guest_id())
  with check (guest_id = current_guest_id());
create policy photos_admin_all on photos
  for all to authenticated using (is_admin()) with check (is_admin());

-- Guestbook (P2)
grant select, insert on guestbook_entries to authenticated;
create policy guestbook_read on guestbook_entries
  for select to authenticated
  using ((select gallery_visible from app_settings where id = 1) or is_admin());
create policy guestbook_write_own on guestbook_entries
  for insert to authenticated with check (guest_id = current_guest_id());
create policy guestbook_admin on guestbook_entries
  for all to authenticated using (is_admin()) with check (is_admin());

grant select on admin_profiles to authenticated;
create policy admin_profiles_self on admin_profiles
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage. Private bucket: every URL must be signed, so blind mode holds at
-- the byte level rather than just in the UI.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy photos_object_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and can_view_photo_path(name));

-- Guests may only write inside their own folder, and only for a row an RPC
-- has already created — so an upload cannot exist without a spent credit.
create policy photos_object_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and owns_photo_path(name));

create policy photos_object_admin on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and is_admin())
  with check (bucket_id = 'photos' and is_admin());

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------
revoke all on function
  redeem_invite_code(text),
  create_disposable_photo(text, text, text, int, int, int),
  upsert_bingo_photo(uuid, text, text, text, int, int, int),
  mark_photo_ready(uuid),
  refund_failed_photo(uuid),
  my_credits_remaining()
from public, anon;

grant execute on function
  redeem_invite_code(text),
  create_disposable_photo(text, text, text, int, int, int),
  upsert_bingo_photo(uuid, text, text, text, int, int, int),
  mark_photo_ready(uuid),
  refund_failed_photo(uuid),
  my_credits_remaining()
to authenticated;
