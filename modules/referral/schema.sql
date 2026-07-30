alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references auth.users (id);

-- Karışabilecek karakterler (0/O, 1/I/L) çıkarıldı — kod elle de yazılabiliyor.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    -- Çakışma olasılığı düşük ama sıfır değil; benzersiz olana kadar dene.
    exit when not exists (select 1 from profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- Her yeni profile otomatik kod. core/auth'un handle_new_user()'ı profili
-- oluşturduktan sonra bu trigger kodu dolduruyor.
create or replace function public.assign_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created_referral on profiles;
create trigger on_profile_created_referral
  before insert on profiles
  for each row execute function public.assign_referral_code();

-- Var olan profillere kod ver (şemayı sonradan eklediysen).
update profiles set referral_code = public.generate_referral_code() where referral_code is null;

-- Davet kodunu kullanır: davet eden ve edilen ikisine de kredi verir.
-- Dönen: kazanılan kredi miktarı. Hata durumlarında exception atar (client
-- mesajı Türkçeleştirir).
create or replace function public.redeem_referral(p_code text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Ödül ayarları — kendi ekonomine göre değiştir.
  reward_invitee constant int := 10;
  reward_inviter constant int := 10;
  reward_pool constant text := 'default';

  uid uuid := auth.uid();
  inviter_id uuid;
  already uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select referred_by into already from profiles where id = uid;
  if already is not null then
    raise exception 'ALREADY_REDEEMED';
  end if;

  select id into inviter_id from profiles where referral_code = upper(trim(p_code));
  if inviter_id is null then
    raise exception 'INVALID_CODE';
  end if;
  if inviter_id = uid then
    raise exception 'SELF_REFERRAL';
  end if;

  update profiles set referred_by = inviter_id where id = uid;

  -- credits modülünün RPC'leri (bu modül ona bağımlı).
  perform public.add_credit(uid, reward_pool, reward_invitee);
  insert into credit_transactions (user_id, pool, amount, reason)
    values (uid, reward_pool, reward_invitee, 'signup_grant');

  perform public.add_credit(inviter_id, reward_pool, reward_inviter);
  insert into credit_transactions (user_id, pool, amount, reason)
    values (inviter_id, reward_pool, reward_inviter, 'signup_grant');

  return reward_invitee;
end;
$$;

grant execute on function public.redeem_referral(text) to authenticated;
