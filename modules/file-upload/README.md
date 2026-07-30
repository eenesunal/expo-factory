# modules/file-upload

Galeriden/kameradan görsel seçip Supabase Storage'a yükleme. Avatar örneğiyle
geliyor ama herhangi bir bucket için kullanılabilir.

```ts
const { path, publicUrl, error } = await pickAndUploadImage();
if (path) await setMyAvatarPath(path);
```

## Yol biçimi ZORUNLU: `<user_id>/<dosya>`

Storage RLS politikaları dosya yolunun **ilk klasörünün** kullanıcı id'si
olmasına dayanıyor (`(storage.foldername(name))[1] = auth.uid()::text`). Yolu
kendin üretiyorsan bu deseni koru, yoksa yükleme RLS'e takılır.

## Bucket herkese açık

`avatars` bucket'ı `public: true`: yolu bilen herkes dosyaya erişir. Yollar
tahmin edilemez ama **gizli değil**. Gerçekten özel dosyalar için:

```sql
update storage.buckets set public = false where id = 'avatars';
```
ve client'ta `getPublicUrl` yerine `createSignedUrl(path, 60)` kullan. Bu yüzden
profilde tam URL değil **path** saklıyoruz — bucket'ı private'a çevirince
URL'ler değişir, path aynı kalır.

## Sıkıştırma

`ImagePicker`'ın kendi `quality: 0.7` seçeneği kullanılıyor; ayrı bir
`expo-image-manipulator` bağımlılığı yok. Bu JPEG kalitesini düşürür ama
**piksel boyutunu sınırlamaz** — 12MP bir fotoğraf yine 12MP yüklenir.

Gerçekten maks. çözünürlük şartın varsa:
```bash
npx expo install expo-image-manipulator
```
ve seçilen asset'i yüklemeden önce resize et.

## İzin metinleri

`app.json` > `plugins` > `expo-image-picker` altındaki `photosPermission` /
`cameraPermission` metinleri iOS izin dialogunda **aynen** görünür. Apple genel
ifadeler yerine somut gerekçe istiyor — kendi uygulamana göre düzenle, yoksa
review'da reddedilebilir.
