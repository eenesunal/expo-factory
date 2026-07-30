import * as Haptics from "expo-haptics";
import { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// TUZAK #3 — bu deseni bozmayın:
// Daha önce stiller "boyut" / "içerik" diye ikiye bölünüp dış Pressable + iç
// Animated.View'e dağıtılıyordu (transform'un sadece içeriği etkilemesi için).
// Bu, native Yoga'da tanımsız ana eksenlerde güvenilmez çözülüyordu (bazen
// sıfıra çöküyor, bazen butonlar tüm ekranı kaplıyordu). onLayout ile ölçüp
// içteki view'ı boyutlandırma denemesi de küsuratlı piksel farkları yüzünden
// sonsuz render döngüsüne girdi.
// transform zaten bir view'in KENDİ layout kutusunu etkilemez (sadece boyama
// aşamasında uygulanır) — ayrı bir iç view'e hiç gerek yok. Tek bir
// Animated-Pressable'a çağıranın TÜM stilini aynen ver, üstüne sadece
// transform + opacity ekle. Split yok, heuristic yok, ölçüm yok.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticKind = "light" | "medium" | "selection" | "none";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: HapticKind;
};

function fireHaptic(kind: HapticKind) {
  if (kind === "none" || Platform.OS === "web") return;
  if (kind === "selection") {
    Haptics.selectionAsync();
  } else {
    Haptics.impactAsync(
      kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
  }
}

export function PressableScale({
  style,
  scaleTo = 0.96,
  haptic = "light",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    onPressIn?.(e);
  }

  function handlePressOut(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
    onPressOut?.(e);
  }

  function handlePress(e: GestureResponderEvent) {
    fireHaptic(haptic);
    onPress?.(e);
  }

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.5 : 1 }]}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}
