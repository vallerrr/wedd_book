-- Let the couple decide how blind the camera is.
--
-- Shooting with no viewfinder at all is the intended disposable-camera feel,
-- but it is genuinely hard to aim, and the couple may prefer guests be able to
-- frame a shot. This only controls the *viewfinder*: captured photos stay
-- hidden until the reveal either way, which is enforced by can_view_photo and
-- is not affected by this flag.
alter table app_settings
  add column if not exists camera_live_preview boolean not null default false;

comment on column app_settings.camera_live_preview is
  'false = no viewfinder at all (true disposable). true = live preview while framing; photos are still hidden after capture.';
