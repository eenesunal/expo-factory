# core/eas-setup

`eas.json` iskeleti + `scripts/setup-eas-env.mjs`. Her projede var, seçilebilir
değil — buradaki iki tuzak release'i tek başına batırabilir.

## TUZAK #1: EAS Build yerel `.env`'i GÖRMEZ

`.env` gitignore'da olduğu için EAS cloud build'e hiç yüklenmiyor. İki adım
gerekli, ikisi de:

1. Her `EXPO_PUBLIC_*` değişkenini EAS'a kaydet:
   ```bash
   node scripts/setup-eas-env.mjs production
   ```
   (elle: `eas env:create --environment production --name X --value Y --visibility plaintext`)

2. `eas.json`'daki ilgili build profiline `"environment": "production"` ekle
   (bu repoda üç profilde de hazır duruyor — silmeyin).

Bu atlanırsa production build'de **TÜM** env değişkenleri `undefined` olur:
uygulama açılır, hiçbir şey yüklenmez, backend'e hiç bağlanmaz. Simülatörde ve
`expo start`'ta çalıştığı için ancak gerçek bir build'de fark edilir. Hafız'da
bu, release'e günler kalmışken yakalandı.

Kontrol: `eas env:list --environment production`

**Sunucu tarafı sırları buraya koymayın.** `SUPABASE_SERVICE_ROLE_KEY`,
`OPENAI_API_KEY` gibi değerler uygulamaya gömülmemeli — onlar
`supabase secrets set KEY=value` ile edge function'lara gider.

## TUZAK #10: `app.json` > `name` ile Xcode target adı eşleşmeli

Uyuşmazsa EAS build şu hatayla patlar:
`Could not find target 'X' in project.pbxproj`

Kullanıcıya gösterilecek adı `name` ile değiştirmeye çalışma —
`ios.infoPlist.CFBundleDisplayName` kullan. `name`, native projeyi üreten
`prebuild` adımının target adıdır; bir kez native klasör üretildikten sonra
değiştirmek target adını bozar.

## İlk kurulum sırası

```bash
npm install -g eas-cli
eas login
eas init                                   # app.json'a extra.eas.projectId yazar
node scripts/setup-eas-env.mjs production
eas build --platform ios --profile production
eas submit --platform ios --profile production
```
