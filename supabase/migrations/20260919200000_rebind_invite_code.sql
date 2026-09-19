-- Let a code be redeemed again by a new session.
--
-- Until now a redeemed code was bound to one anonymous session for good, so
-- signing out locked that guest out permanently — as did clearing site data,
-- switching phone, or a browser evicting storage. Recovering needed an admin
-- with a laptop, which is not a thing that exists halfway up Qianling
-- mountain.
--
-- The rule it replaced stopped a second person claiming someone's code. That
-- protection was always thin — the codes are three characters and get handed
-- out on printed cards — and the failure it prevents (a friend using the wrong
-- card) is far cheaper than the one it caused (a guest locked out mid-wedding
-- with no way back in). Rebinding also keeps everything attached to the guest
-- row, so photos, bingo answers and print picks survive the change.
create or replace function redeem_invite_code(p_code text)
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

  -- Already redeemed on this session — idempotent, just return it.
  select * into v_guest from guests where auth_user_id = v_uid;
  if found and v_guest.invite_code = v_norm then
    update guests set last_seen_at = now() where id = v_guest.id;
    return v_guest;
  end if;

  select * into v_guest from guests where invite_code = v_norm;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if v_guest.failed_attempts >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  -- Rebind to whoever is holding the code now. The previous session simply
  -- stops resolving to a guest and lands back on the welcome screen.
  update guests
     set auth_user_id = v_uid,
         redeemed_at  = coalesce(redeemed_at, now()),
         last_seen_at = now()
   where id = v_guest.id
  returning * into v_guest;

  return v_guest;
end;
$$;
