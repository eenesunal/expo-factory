# core/auth

Supabase auth deseni: anonim oturum önce, e-posta OTP ile gerçek hesaba
yükseltme, hesap silme. Her projede var, seçilebilir değil.

## Neden anonim-önce

Apple Guideline 5.1.1(v): hesaba bağlı olmayan özellikler giriş yapmadan
erişilebilir olmalı. Bu yüzden uygulama açılışta `signInAnonymously()` ile bir
kimlik kurar (kullanım/limit takibi bu kimliğe bağlanır), gerçek hesap
(`startEmailAuth`/`confirmEmailAuth`) tamamen isteğe bağlı bir yükseltmedir —
aynı `user.id` korunur, veri kaybolmaz.

## TUZAK: `ensureSession()`'a her zaman `.catch()` + timeout

Ağ hatası ya da askıda kalan bir istek, `.catch()` yoksa uygulamayı sonsuza dek
splash ekranında bırakır. `App.tsx` bunu 8 saniyelik bir timeout + `.catch()`
ile sarıyor — oturum kurulamasa bile hesapsız özellikler kullanılabilir kalır.
Aynı deseni açılışta beklediğin BAŞKA kritik promise'ler (font yükleme, remote
config) için de tekrarla.

## Supabase tarafında elle yapılacaklar

1. **Auth > Providers > Anonymous sign-ins** açık olmalı.
2. **Auth > Email Templates**: `Magic Link` VE `Change Email Address`
   şablonlarında `{{ .Token }}` kullan. Varsayılan şablon link gönderir; OTP
   ekranı 6 haneli kod beklediği için bu adım atlanırsa giriş hiç çalışmaz.
3. `supabase functions deploy delete-account`

## `verifyOtp` tipi neden ikiye ayrılıyor

Kayıtlı bir e-postaya giriş `type: "email"`, mevcut anonim oturumu yeni bir
e-postaya bağlama `type: "email_change"` ister. `startEmailAuth` hangisinin
geçerli olduğunu `shouldCreateUser:false` denemesiyle anlar ve `mode` olarak
döner — bu `mode`'u doğrulama adımına taşımayı unutma.

`shouldCreateUser:false` hatasını "kayıtlı değil" sinyaline çevirirken SADECE
"signups not allowed" desenine bakıyoruz; diğer hatalar (rate limit vb.) doğrudan
gösterilir. Yoksa zaten kayıtlı bir e-postada kullanıcı gerçek hata yerine
"zaten kayıtlısın" görüyor.

## App Store review hesabı

Reviewer gerçek e-postaya gelen OTP'yi göremez. Admin API ile sabit şifreli bir
review hesabı oluştur, `src/lib/auth.ts` içindeki yorumdaki desene göre bir
bypass ekle, App Review notlarında Apple'a bildir. (Bu, otomatikleştirilemeyen
bir adım.)
