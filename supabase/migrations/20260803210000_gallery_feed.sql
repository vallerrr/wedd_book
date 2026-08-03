-- The gallery needs each photo's author, but a guest cannot read another
-- guest's row — that policy is deliberate, since `guests` holds invite_code
-- and handing those out would let anyone sign in as anyone.
--
-- A view can't square this either: with security_invoker on, the join to
-- guests drops everyone else's rows; with it off, RLS on photos is bypassed
-- and blind mode collapses. So the feed is a SECURITY DEFINER function that
-- calls can_view_photo itself — the same rule the table policy uses, not a
-- second copy of it — and resolves the name here so anonymity is applied in
-- one place rather than trusted to the UI.
create or replace function gallery_feed()
  returns table (
    id           uuid,
    thumb_path   text,
    storage_path text,
    display_mode text,
    author       text,
    mine         boolean,
    created_at   timestamptz
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select p.id,
         p.thumb_path,
         p.storage_path,
         p.display_mode,
         case when p.display_mode = 'anonymous' then null else g.display_name end,
         p.guest_id = current_guest_id(),
         p.created_at
    from photos p
    join guests g on g.id = p.guest_id
   where p.kind = 'disposable'
     and p.status = 'ready'
     and can_view_photo(p)
   order by p.created_at desc;
$$;

revoke all on function gallery_feed() from public, anon;
grant execute on function gallery_feed() to authenticated;

-- How long until the reveal, for the countdown. Exposed on its own so the
-- gallery doesn't have to reason about which of the two switches is holding
-- it shut.
create or replace function gallery_state()
  returns table (open boolean, reveal_at timestamptz, waiting_count bigint)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select s.gallery_visible and coalesce(s.disposable_reveal_at <= now(), false),
         s.disposable_reveal_at,
         -- A count of what is waiting, so the locked screen can say something
         -- true and specific rather than just "not yet".
         (select count(*) from photos where kind = 'disposable' and status = 'ready')
    from app_settings s
   where s.id = 1;
$$;

revoke all on function gallery_state() from public, anon;
grant execute on function gallery_state() to authenticated;
