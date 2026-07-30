import { NavigationContainer, useNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppSplash } from "./src/components/AppSplash";
import { resolveAppRoute } from "./src/lib/appRoute";
import { ensureSession } from "./src/lib/auth";
import { navigationRef, setSignOutListener, type RootStackParamList } from "./src/lib/navigation";
import { useNotificationRouting } from "./src/lib/notificationRouting";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AuthGateScreen } from "./src/screens/AuthGateScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
// @factory:imports

const Stack = createNativeStackNavigator<RootStackParamList>();

// Splash animasyonu yarıda kesilmiş gibi görünmesin diye en az bu kadar durur.
const MIN_SPLASH_MS = 900;
// Tuzak #9: kritik açılış promise'i askıda kalırsa uygulama sonsuza dek
// splash'ta kalır — bu süreden sonra oturum kurulamamış sayıp devam ediyoruz.
const SESSION_TIMEOUT_MS = 8000;

// Apple Guideline 5.1.1(v): hesaba bağlı olmayan özellikler giriş yapmadan
// erişilebilir olmalı — bu yüzden giriş ekranı zorunlu bir gate değil,
// AccountScreen'den isteğe bağlı açılan bir stack ekranı.
function AuthRoute() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Auth">>();
  return (
    <AuthGateScreen onVerified={() => navigation.goBack()} onCancel={() => navigation.goBack()} />
  );
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  useNotificationRouting();

  useEffect(() => {
    const timeoutId = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    // ensureSession()'a HER ZAMAN .catch() + timeout ekle (bkz. tuzak #9).
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function finish(err?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (err) console.error("Oturum başlatılamadı:", err);
      setSessionReady(true);
    }

    timeoutId = setTimeout(() => finish("oturum başlatma zaman aşımı"), SESSION_TIMEOUT_MS);
    ensureSession()
      .then(() => finish())
      .catch(finish);

    return () => {
      settled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    // Hesap silindiğinde/çıkış yapıldığında eski oturum geçersiz kalır —
    // yeni bir anonim oturum kurup Home'a dönüyoruz (zorunlu giriş ekranına
    // düşürmüyoruz, Guideline 5.1.1(v)).
    setSignOutListener(() => {
      ensureSession().catch((err) => console.error("Oturum yenilenemedi:", err));
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Home" }] });
      }
    });
    return () => setSignOutListener(null);
  }, []);

  if (resolveAppRoute({ sessionReady, minSplashElapsed }) === "splash") {
    return <AppSplash />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Auth" component={AuthRoute} />
          {/* @factory:screens */}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
