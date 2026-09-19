-- Local food recommendations.
--
-- These were prose in a content_block, but each one has an address and a map
-- link, and guests want to copy the address and open it — the same affordances
-- the programme items already have. Prose can't carry that (the renderer
-- deliberately has no link support), so they get real columns instead.
create table if not exists tips (
  id       uuid primary key default gen_random_uuid(),
  city     text not null check (city in ('guiyang', 'qianxi')),
  position int  not null default 0,
  title_zh text not null,
  title_en text not null,
  note_zh  text,
  note_en  text,
  address  text,
  map_url  text,
  visible  boolean not null default true
);

create index if not exists tips_city_idx on tips (city, position);

alter table tips enable row level security;

-- Part of the public itinerary, same as the programme.
grant select on tips to anon, authenticated;
grant insert, update, delete on tips to authenticated;
grant all on tips to service_role;

create policy tips_read on tips
  for select to anon, authenticated using (visible);

create policy tips_admin on tips
  for all to authenticated using (is_admin()) with check (is_admin());
