# core/app-shell

Expo uygulama iskeleti. Her projede var, seçilebilir değil.

## Ne veriyor

- `App.tsx` — native-stack navigator, oturum kurulumu (timeout + `.catch()` ile),
  `signOut` sonrası yeni anonim oturum, bildirim yönlendirmesi
- `src/lib/navigation.ts` — `navigationRef` (React ağacı dışından yönlendirme) +
  `RootStackParamList`. Modül ekranları `// @factory:routes` işaretçisine eklenir.
- `src/lib/appRoute.ts` (+ testi) — splash/main kararı
- `src/theme/` — light/dark renk paleti, `useTheme()`
- `src/components/PressableScale.tsx` — basınca küçülen buton + haptik
- `src/components/AnimatedModal.tsx` — backdrop + swipe-to-dismiss modal
- `src/components/AppSplash.tsx`, `src/screens/HomeScreen.tsx` — değiştirilecek iskelet

## Buradaki iki tuzağa dikkat

**1. `PressableScale`'de outer/inner style split'i YAPMA.** Dıştaki Pressable'a
"sizing", içteki `Animated.View`'e `flex:1` verme deseni Yoga'da layout
patlamalarına yol açıyor (bazı butonlar tüm ekranı kaplıyor). `onLayout` ile
ölçüp içteki view'ı boyutlandırmak da sonsuz render loop'una yol açtı.
Stabil çözüm dosyanın içinde: tek bir `Animated.createAnimatedComponent(Pressable)`'a
çağıranın TÜM stilini direkt uygula, üstüne sadece `{transform:[{scale}], opacity}` ekle.

**2. iOS'ta aynı anda tek native `<Modal>`.** İki Modal üst üste mount'lu
kalırsa ikincisi sessizce açılmaz ("bazen açılıyor bazen açılmıyor" bug'larının
kök nedeni). Modal-ağırlıklı akışları gerçek stack screen'lere çevir; iç içe
gerekiyorsa `<AnimatedModal nested>` kullan; sıradaki modal'ı sabit bir
`setTimeout` tahminiyle değil `onClosed` callback'iyle aç.

## Ekran ekleme

`src/screens/X.tsx` yaz, `App.tsx`'teki `Stack.Navigator`'a ve
`src/lib/navigation.ts`'teki `RootStackParamList`'e ekle. (Modüller bunu
`manifest.json` > `navigationScreens` ile otomatik yapıyor.)

## Özel font

`typography.ts` sistem fontlarını kullanıyor. `expo-font` +
`@expo-google-fonts/<font>` ekleyeceksen `useFonts` askıda kalabileceği için
`App.tsx`'teki oturum timeout desenini fontlar için de tekrarla — yoksa splash
sonsuza dek dönebilir.
