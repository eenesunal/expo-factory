create table if not exists messages (
  id bigint generated always as identity primary key,
  room_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx on messages (room_id, created_at desc);

alter table messages enable row level security;

-- Bu politika TÜM odaları herkese okutur. Özel odalar istiyorsan bir
-- `room_members(room_id, user_id)` tablosu ekleyip politikayı
-- `using (exists (select 1 from room_members m where m.room_id = messages.room_id
--   and m.user_id = auth.uid()))` biçiminde daralt.
drop policy if exists "Mesajlar herkese okunur" on messages;
create policy "Mesajlar herkese okunur"
  on messages for select
  using (true);

drop policy if exists "Kullanıcı kendi adına mesaj gönderebilir" on messages;
create policy "Kullanıcı kendi adına mesaj gönderebilir"
  on messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Kullanıcı kendi mesajını silebilir" on messages;
create policy "Kullanıcı kendi mesajını silebilir"
  on messages for delete
  using (auth.uid() = user_id);

-- Realtime yayını. BU OLMADAN MESAJLAR CANLI GELMEZ (sadece yeniden
-- yüklemede görünür). Bazı Supabase planlarında panelden
-- (Database > Replication) da onaylamak gerekiyor.
-- Not: tablo yayında zaten varsa `alter publication ... add` hata verir, o
-- yüzden koşullu ekliyoruz.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
