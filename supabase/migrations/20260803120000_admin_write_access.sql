-- Admins could read everything and write nothing.
--
-- The initial migration created admin RLS policies but never granted the
-- underlying table privileges, and Postgres requires both: a policy only
-- narrows a privilege you already hold. `authenticated` held SELECT alone, so
-- every admin write failed with "permission denied for table ..." — adding a
-- guest, editing the programme, changing the reveal times, all of it.

-- ---------------------------------------------------------------------------
-- Content the couple edits.
--
-- Safe to grant broadly: these tables have no guest-facing write policy, so
-- the only policy covering a write is the is_admin() one. A guest holding the
-- privilege still gets refused by RLS.
-- ---------------------------------------------------------------------------
grant insert, update, delete on program_days    to authenticated;
grant insert, update, delete on program_items   to authenticated;
grant insert, update, delete on content_blocks  to authenticated;
grant insert, update, delete on bingo_questions to authenticated;
grant update                 on app_settings    to authenticated;

-- ---------------------------------------------------------------------------
-- Guests are different: they hold a self-update policy, so a blanket UPDATE
-- grant would let a guest rewrite their own invite_code or re-point
-- auth_user_id — the column grant is what stops that today. Admin writes
-- therefore go through SECURITY DEFINER functions instead of table grants,
-- matching how the rest of the privileged work is done.
-- ---------------------------------------------------------------------------

-- Crockford base32 minus I, L, O and U: nothing that gets misread off a
-- printed card. 256 is an exact multiple of 32, so the modulo is unbiased.
create or replace function gen_invite_code()
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $$
declare
  alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  code text;
begin
  for _attempt in 1..500 loop
    code := '';
    for _i in 1..3 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    if not exists (select 1 from guests where invite_code = code) then
      return code;
    end if;
  end loop;
  raise exception 'no_free_invite_code';
end;
$$;

create or replace function admin_create_guest(p_display_name text)
  returns guests
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_row guests;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if not is_admin() then
    raise exception 'not_an_admin' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'name_required' using errcode = 'P0001';
  end if;

  -- The code is generated here rather than in the browser, so there is one
  -- alphabet and the uniqueness check happens inside the same transaction as
  -- the insert.
  insert into guests (invite_code, display_name)
  values (gen_invite_code(), v_name)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function admin_update_guest(
  p_guest_id uuid,
  p_display_name text default null,
  p_table_number text default null
)
  returns guests
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_row guests;
begin
  if not is_admin() then
    raise exception 'not_an_admin' using errcode = '42501';
  end if;

  update guests
     set display_name = coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), display_name),
         table_number = nullif(btrim(coalesce(p_table_number, '')), '')
   where id = p_guest_id
  returning * into v_row;

  if not found then
    raise exception 'unknown_guest' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

create or replace function admin_delete_guest(p_guest_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_an_admin' using errcode = '42501';
  end if;
  -- Photos and credits cascade; a redeemed guest loses their session with it.
  delete from guests where id = p_guest_id;
end;
$$;

-- Let a guest go back to being unclaimed, so a code printed on a QR card can
-- be handed to someone else (or reused after testing).
create or replace function admin_reset_guest(p_guest_id uuid)
  returns guests
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_row guests;
begin
  if not is_admin() then
    raise exception 'not_an_admin' using errcode = '42501';
  end if;

  update guests
     set auth_user_id = null,
         redeemed_at = null,
         failed_attempts = 0
   where id = p_guest_id
  returning * into v_row;

  if not found then
    raise exception 'unknown_guest' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

revoke all on function
  gen_invite_code(),
  admin_create_guest(text),
  admin_update_guest(uuid, text, text),
  admin_delete_guest(uuid),
  admin_reset_guest(uuid)
from public, anon;

grant execute on function
  admin_create_guest(text),
  admin_update_guest(uuid, text, text),
  admin_delete_guest(uuid),
  admin_reset_guest(uuid)
to authenticated;
