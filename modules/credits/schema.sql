-- Kredi bakiyeleri. Hafız'da bu iki sabit kolondu (question_credits,
-- image_credits); burada havuz adı satır bazlı, böylece yeni bir havuz
-- eklemek migration gerektirmiyor.
create table if not exists credit_balances (
  user_id uuid not null references auth.users (id) on delete cascade,
  pool text not null,
  balance int not null default 0 check (balance >= 0),
  primary key (user_id, pool)
);

alter table credit_balances enable row level security;

drop policy if exists "Kullanıcılar kendi bakiyesini görebilir" on credit_balances;
create policy "Kullanıcılar kendi bakiyesini görebilir"
  on credit_balances for select
  using (auth.uid() = user_id);

-- Kredi hareketleri — append-only log. Asıl bakiye credit_balances'ta; bu
-- tablo (a) aynı satın almanın iki kez işlenmemesi (rc_transaction_id UNIQUE)
-- ve (b) destek/denetim için var.
create table if not exists credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pool text not null,
  amount int not null,
  rc_transaction_id text,
  reason text not null check (reason in ('purchase', 'spend', 'refund', 'signup_grant')),
  created_at timestamptz not null default now()
);

-- Partial unique index: ödeme sağlayıcısı aynı webhook'u retry ile birden fazla
-- gönderirse ikinci insert conflict'e düşer ve bakiye iki kez artmaz.
create unique index if not exists credit_transactions_rc_txn_idx
  on credit_transactions (rc_transaction_id)
  where rc_transaction_id is not null;

create index if not exists credit_transactions_user_created_idx
  on credit_transactions (user_id, created_at);

alter table credit_transactions enable row level security;

drop policy if exists "Kullanıcılar kendi kredi hareketlerini görebilir" on credit_transactions;
create policy "Kullanıcılar kendi kredi hareketlerini görebilir"
  on credit_transactions for select
  using (auth.uid() = user_id);

-- p_amount kadar kredi harcar. Atomik: "oku sonra yaz" yerine tek bir
-- UPDATE ... WHERE balance >= p_amount, yani race condition'ı DB çözer.
-- Kredi yetmiyorsa NULL döner — çağıran taraf (edge function) bunu 429'a
-- çevirir. Pahalı işlemler için p_amount'u büyüt (Hafız'da video render 2,
-- diğerleri 1 kredi harcıyordu).
create or replace function public.spend_credit(p_user_id uuid, p_pool text, p_amount int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  update credit_balances set balance = balance - p_amount
    where user_id = p_user_id and pool = p_pool and balance >= p_amount
    returning balance into remaining;
  return remaining;
end;
$$;

-- DİKKAT: sadece service_role. Client'a açarsan kullanıcı kendi bakiyesini
-- manipüle edebilir — bir edge function'ın içinden çağır.
revoke all on function public.spend_credit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.spend_credit(uuid, text, int) to service_role;

-- Kredi ekler (satın alma) ya da negatif amount ile düşer (iade), atomik.
create or replace function public.add_credit(p_user_id uuid, p_pool text, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  insert into credit_balances (user_id, pool, balance)
  values (p_user_id, p_pool, greatest(p_amount, 0))
  on conflict (user_id, pool)
    do update set balance = greatest(credit_balances.balance + p_amount, 0)
  returning balance into new_balance;
  return new_balance;
end;
$$;

revoke all on function public.add_credit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.add_credit(uuid, text, int) to service_role;

-- Yeni hesaba ücretsiz başlangıç kredisi. Havuz adlarını ve miktarları kendi
-- uygulamana göre düzenle; core/auth'un handle_new_user trigger'ından sonra
-- çalışacak ayrı bir trigger olarak bağlanıyor.
create or replace function public.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  starter record;
begin
  for starter in
    select * from (values ('default', 5)) as t(pool, amount)
  loop
    insert into credit_balances (user_id, pool, balance)
      values (new.id, starter.pool, starter.amount)
      on conflict (user_id, pool) do nothing;
    insert into credit_transactions (user_id, pool, amount, reason)
      values (new.id, starter.pool, starter.amount, 'signup_grant');
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.grant_signup_credits();
