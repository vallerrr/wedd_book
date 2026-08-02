-- Wedd Book — core schema
--
-- Event: 26–28 September 2026, Guiyang → Qianxi, Guizhou.
-- ~20 guests. Three photo kinds with three different visibility rules:
--   disposable — blind; nobody sees them, not even the owner, until reveal
--   bingo      — private to the owner until the couple opens "review night"
--   guestbook  — visible whenever the gallery is open (P2)

-- ---------------------------------------------------------------------------
-- Settings (single row, id = 1)
-- ---------------------------------------------------------------------------
create table app_settings (
  id                   int primary key default 1 check (id = 1),
  gallery_visible      boolean     not null default false,
  disposable_reveal_at timestamptz,           -- null = still blind
  bingo_review_at      timestamptz,           -- null = bingo answers stay private
  daily_photo_credits  int         not null default 20 check (daily_photo_credits >= 0),
  capture_cost         int         not null default 1 check (capture_cost > 0),
  upload_cost          int         not null default 2 check (upload_cost > 0),
  venue_timezone       text        not null default 'Asia/Shanghai',
  event_start_date     date        not null default '2026-09-26',
  event_end_date       date        not null default '2026-09-28',
  slideshow_enabled    boolean     not null default false,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guests. No email, no password — a 3-character invite code redeemed onto a
-- Supabase anonymous session. display_name is set by the admin up front, so
-- the guest only confirms it.
-- ---------------------------------------------------------------------------
create table guests (
  id                uuid primary key default gen_random_uuid(),
  invite_code       text unique not null check (invite_code = lower(invite_code)),
  display_name      text not null,
  table_number      text,
  auth_user_id      uuid unique references auth.users (id) on delete set null,
  default_anonymous boolean not null default false,
  locale            text not null default 'zh' check (locale in ('zh', 'en')),
  failed_attempts   int not null default 0,
  created_at        timestamptz not null default now(),
  redeemed_at       timestamptz,
  last_seen_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- Daily quota ledger. One row per guest per venue-local day; `used` is only
-- ever moved by a single atomic UPDATE, which is what makes the quota
-- race-free (see create_disposable_photo).
-- ---------------------------------------------------------------------------
create table photo_credits (
  guest_id uuid not null references guests (id) on delete cascade,
  day      date not null,
  used     int  not null default 0 check (used >= 0),
  primary key (guest_id, day)
);

-- ---------------------------------------------------------------------------
-- Bingo: the same 16 prompts for everyone, but each guest answers privately.
-- ---------------------------------------------------------------------------
create table bingo_questions (
  id        uuid primary key default gen_random_uuid(),
  position  int unique not null check (position between 1 and 16),
  prompt_zh text not null,
  prompt_en text not null,
  active    boolean not null default true
);

create table photos (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid not null references guests (id) on delete cascade,
  kind         text not null check (kind in ('disposable', 'bingo', 'guestbook')),
  storage_path text unique not null,
  thumb_path   text,
  source       text not null check (source in ('capture', 'upload')),
  credit_cost  int  not null default 0 check (credit_cost >= 0),
  display_mode text not null default 'named' check (display_mode in ('named', 'anonymous')),
  status       text not null default 'pending'
                 check (status in ('pending', 'ready', 'failed', 'hidden')),
  question_id  uuid references bingo_questions (id) on delete set null,
  width        int,
  height       int,
  bytes        int,
  local_day    date not null,
  created_at   timestamptz not null default now(),

  -- Only bingo photos belong to a question, and only they are quota-free.
  constraint photos_question_only_for_bingo
    check ((kind = 'bingo') = (question_id is not null)),
  constraint photos_bingo_is_free
    check (kind <> 'bingo' or credit_cost = 0)
);

-- Exactly one live answer per guest per question. Replacing marks the old row
-- 'hidden' rather than deleting it, so nothing is ever actually lost.
create unique index photos_one_bingo_slot
  on photos (guest_id, question_id)
  where kind = 'bingo' and status <> 'hidden';

create index photos_gallery_idx on photos (kind, status, created_at desc);
create index photos_guest_idx   on photos (guest_id, kind);
create index photos_question_idx on photos (question_id) where kind = 'bingo';

-- ---------------------------------------------------------------------------
-- Programme. The couple's itinerary is a travel guide, not a timetable —
-- fuzzy times ("Around 10am"), markdown prose, photos, hotel addresses.
-- Images live in the repo under public/program/ so the service worker can
-- precache them; there is no signal inside Zhijin Cave.
-- ---------------------------------------------------------------------------
create table program_days (
  id       uuid primary key default gen_random_uuid(),
  day_date date not null unique,
  label_zh text not null,
  label_en text not null,
  intro_zh text,
  intro_en text,
  position int not null default 0
);

create table program_items (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid not null references program_days (id) on delete cascade,
  time_label_zh text,
  time_label_en text,
  starts_at     timestamptz,             -- optional; powers the "next up" card
  title_zh      text not null,
  title_en      text not null,
  body_zh       text,                    -- markdown
  body_en       text,
  image_paths   text[] not null default '{}',
  location_name text,
  address       text,
  map_url       text,                    -- Amap / Baidu (Google Maps is blocked in CN)
  category      text check (category in ('activity', 'meal', 'hotel', 'free', 'travel')),
  position      int not null default 0,
  visible       boolean not null default true
);

create index program_items_day_idx on program_items (day_id, position);

-- Free-form prose blocks: trip intro, "what's on us", "what we won't cover",
-- Guiyang food and coffee recommendations.
create table content_blocks (
  key      text primary key,
  title_zh text,
  title_en text,
  body_zh  text,
  body_en  text,
  position int not null default 0,
  visible  boolean not null default true
);

-- ---------------------------------------------------------------------------
-- P2 — schema now so nothing needs restructuring if we get to it.
-- ---------------------------------------------------------------------------
create table guestbook_entries (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid not null references guests (id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 500),
  photo_id     uuid references photos (id) on delete set null,
  display_mode text not null default 'named' check (display_mode in ('named', 'anonymous')),
  created_at   timestamptz not null default now()
);

-- The couple. Real Supabase Auth (email + password), unlike guests.
create table admin_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into app_settings (id) values (1);
