# assets/

Buraya kendi ikon/splash görsellerini koy, sonra `app.json`'a bağla:

```json
"icon": "./assets/icon.png",
"android": { "adaptiveIcon": { "foregroundImage": "./assets/android-icon-foreground.png", "backgroundColor": "#3A5A9B" } },
"plugins": [["expo-splash-screen", { "image": "./assets/splash-icon.png", "backgroundColor": "#3A5A9B", "resizeMode": "contain" }]]
```

Gerekli boyutlar: `icon.png` 1024×1024, `splash-icon.png` ~1284×2778 (veya
ortalanacak bir logo), Android adaptive icon katmanları 1024×1024.

`expo-splash-screen` plugin'ini eklerken paketi de kur:
`npx expo install expo-splash-screen`
