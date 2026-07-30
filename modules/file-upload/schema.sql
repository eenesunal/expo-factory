-- Avatar bucket'ı. `public: true` = dosya URL'i bilen herkes erişebilir
-- (yol tahmin edilemez ama gizli de değil). Gerçekten özel dosyalar için
-- public'i false yapıp client'ta createSignedUrl() kullan.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RLS politikaları, dosya yolunun İLK KLASÖRÜNÜN kullanıcı id'si olmasına
-- dayanıyor: "<user_id>/avatar.jpg". Client bu yolu böyle üretmek zorunda
-- (bkz. src/lib/upload.ts).
drop policy if exists "Avatarlar herkese okunur" on storage.objects;
create policy "Avatarlar herkese okunur"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Kullanıcı kendi klasörüne yükleyebilir" on storage.objects;
create policy "Kullanıcı kendi klasörüne yükleyebilir"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Kullanıcı kendi dosyasını güncelleyebilir" on storage.objects;
create policy "Kullanıcı kendi dosyasını güncelleyebilir"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Kullanıcı kendi dosyasını silebilir" on storage.objects;
create policy "Kullanıcı kendi dosyasını silebilir"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Profilde avatar yolu (bucket içindeki path, tam URL değil — bucket'ı
-- private'a çevirirsen URL'ler değişir, path aynı kalır).
alter table profiles add column if not exists avatar_path text;
