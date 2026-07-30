-- Cihaz push token'ları. Bir kullanıcının birden fazla cihazı olabilir; token
-- benzersiz (aynı cihaz yeniden kurulunca yeni token alır, eskisi ölür).
create table if not exists push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

-- Kullanıcı yalnızca kendi token'ını yazar/okur. Gönderim tarafı
-- (send-push edge function) service_role ile RLS'i bypass eder.
drop policy if exists "Kullanıcılar kendi token'larını görebilir" on push_tokens;
create policy "Kullanıcılar kendi token'larını görebilir"
  on push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Kullanıcılar kendi token'ını kaydedebilir" on push_tokens;
create policy "Kullanıcılar kendi token'ını kaydedebilir"
  on push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kullanıcılar kendi token'ını güncelleyebilir" on push_tokens;
create policy "Kullanıcılar kendi token'ını güncelleyebilir"
  on push_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "Kullanıcılar kendi token'ını silebilir" on push_tokens;
create policy "Kullanıcılar kendi token'ını silebilir"
  on push_tokens for delete
  using (auth.uid() = user_id);
