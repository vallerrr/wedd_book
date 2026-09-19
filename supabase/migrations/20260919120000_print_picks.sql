-- Each guest chooses a few photos to have printed.
--
-- Opens with the gallery: there is nothing to choose from until the photos are
-- revealed, and can_view_photo is what decides that. The cap is enforced here
-- rather than in the UI, for the same reason the photo quota is — a guest
-- tapping quickly on a bad connection should not be able to overshoot it.

alter table app_settings
  add column if not exists print_picks_per_guest int not null default 3
    check (print_picks_per_guest >= 0);

create table if not exists print_picks (
  guest_id   uuid not null references guests (id) on delete cascade,
  photo_id   uuid not null references photos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guest_id, photo_id)
);

create index if not exists print_picks_photo_idx on print_picks (photo_id);

alter table print_picks enable row level security;

grant select, delete on print_picks to authenticated;
grant all on print_picks to service_role;

create policy print_picks_read_own on print_picks
  for select to authenticated
  using (guest_id = current_guest_id() or is_admin());

create policy print_picks_delete_own on print_picks
  for delete to authenticated
  using (guest_id = current_guest_id());

create policy print_picks_admin on print_picks
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- Inserting goes through a function so the cap is checked and applied in one
-- statement, the same shape as the photo credit ledger.
create or replace function add_print_pick(p_photo_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_guest uuid := current_guest_id();
  v_max   int;
  v_count int;
begin
  if v_guest is null then
    raise exception 'not_a_guest' using errcode = '28000';
  end if;

  -- You can only choose a photo you are actually allowed to see.
  if not exists (
    select 1 from photos p where p.id = p_photo_id and can_view_photo(p)
  ) then
    raise exception 'photo_not_available' using errcode = 'P0001';
  end if;

  select print_picks_per_guest into v_max from app_settings where id = 1;

  insert into print_picks (guest_id, photo_id)
  select v_guest, p_photo_id
   where (select count(*) from print_picks where guest_id = v_guest) < v_max
  on conflict do nothing;

  select count(*) into v_count from print_picks where guest_id = v_guest;

  -- Nothing inserted and not already chosen means the cap was reached.
  if not exists (
    select 1 from print_picks where guest_id = v_guest and photo_id = p_photo_id
  ) then
    raise exception 'pick_limit_reached' using errcode = 'P0001';
  end if;

  return v_max - v_count;
end;
$$;

revoke all on function add_print_pick(uuid) from public, anon;
grant execute on function add_print_pick(uuid) to authenticated;

-- What the couple take to the print shop: every chosen photo once, with who
-- asked for it. Admins bypass can_view_photo, so this works whenever.
create or replace function print_queue()
  returns table (
    photo_id     uuid,
    storage_path text,
    thumb_path   text,
    pick_count   bigint,
    chosen_by    text[]
  )
  language sql
  stable
  security definer
  set search_path = public
as $$
  select p.id,
         p.storage_path,
         p.thumb_path,
         count(*),
         array_agg(g.display_name order by g.display_name)
    from print_picks pp
    join photos p on p.id = pp.photo_id
    join guests g on g.id = pp.guest_id
   where is_admin()
   group by p.id, p.storage_path, p.thumb_path
   order by count(*) desc, min(pp.created_at);
$$;

revoke all on function print_queue() from public, anon;
grant execute on function print_queue() to authenticated;

-- How many the guest has left, so the gallery can show it without a join.
create or replace function my_print_picks()
  returns table (photo_id uuid, remaining int)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select pp.photo_id,
         (select print_picks_per_guest from app_settings where id = 1)
           - (select count(*)::int from print_picks where guest_id = current_guest_id())
    from print_picks pp
   where pp.guest_id = current_guest_id();
$$;

revoke all on function my_print_picks() from public, anon;
grant execute on function my_print_picks() to authenticated;
