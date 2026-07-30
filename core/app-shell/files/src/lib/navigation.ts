import { createNavigationContainerRef } from "@react-navigation/native";

// Modül ekranları create.mjs tarafından aşağıdaki işaretçiye eklenir.
export type RootStackParamList = {
  Home: undefined;
  Account: undefined;
  Auth: undefined;
  // @factory:routes
};

// Bildirim/deep link gibi React ağacının dışından gelen yönlendirmeler için.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// AccountScreen (stack ekranı) ile App.tsx arasında doğrudan prop bağlantısı
// yok — hesap silindiğinde/çıkış yapıldığında App.tsx'in yeni bir oturum
// kurmasını tetiklemek için minik bir callback.
let signOutListener: (() => void) | null = null;

export function setSignOutListener(fn: (() => void) | null) {
  signOutListener = fn;
}

export function notifySignedOut() {
  signOutListener?.();
}
