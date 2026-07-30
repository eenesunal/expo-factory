import { useEffect, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

// TUZAK #2 — iOS'ta aynı anda YALNIZCA BİR native <Modal> güvenilir çalışır.
// İki Modal üst üste mount'lu kalırsa (biri kapanırken diğeri açılmaya
// çalışırsa) ikincisi sessizce açılmaz; "bazen açılıyor bazen açılmıyor"
// tarzı bug'ların kök nedeni budur.
//   - Modal-ağırlıklı navigasyon akışlarını gerçek stack screen'lere çevir.
//   - Gerçekten iç içe modal gerekiyorsa `nested` kullan (native Modal
//     açmaz, üstteki Modal'ın içine tam ekran overlay olarak katılır).
//   - Sıradaki modal'ı sabit bir setTimeout tahminiyle DEĞİL, `onClosed`
//     sinyaliyle aç.
type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: "center" | "corner";
  backdropColor?: string;
  nested?: boolean;
  // Kapanma animasyonu bitip native <Modal> gerçekten unmount olduğunda
  // tetiklenir (ilk mount'ta visible=false ise tetiklenmez).
  onClosed?: () => void;
};

const nestedOverlayStyle: ViewStyle = { zIndex: 1000, elevation: 1000 };

const POSITION_STYLES: Record<"center" | "corner", ViewStyle> = {
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  corner: { flex: 1, justifyContent: "flex-end", alignItems: "flex-end", padding: 24, paddingBottom: 96 },
};

export function AnimatedModal({
  visible,
  onClose,
  children,
  position = "center",
  backdropColor = "rgba(0,0,0,0.45)",
  nested = false,
  onClosed,
}: Props) {
  const [rendered, setRendered] = useState(visible);
  const restY = position === "center" ? 28 : 12;
  const translateY = useRef(new Animated.Value(visible ? 0 : restY)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const swipeToDismiss = position === "center";
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      setRendered(true);
      dragY.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: restY, duration: 160, useNativeDriver: true }),
    ]).start();
    // ponytail: unmount kararını Animated .start() callback'ine değil sabit bir
    // timeout'a bağlıyoruz — RN Web'de useNativeDriver JS'e düşünce parallel()
    // completion callback'i bazen hiç tetiklenmiyor.
    const timeout = setTimeout(() => {
      setRendered(false);
      if (wasVisible.current) {
        wasVisible.current = false;
        onClosed?.();
      }
    }, 170);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        swipeToDismiss && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          Animated.timing(dragY, { toValue: 420, duration: 180, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  if (!rendered) return null;

  const overlay = (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor, opacity }]} />
      </Pressable>
      <View style={POSITION_STYLES[position]} pointerEvents="box-none">
        <Animated.View
          {...(swipeToDismiss ? panResponder.panHandlers : {})}
          style={{ opacity, transform: [{ translateY: Animated.add(translateY, dragY) }] }}
        >
          {children}
        </Animated.View>
      </View>
    </>
  );

  if (nested) {
    return <View style={[StyleSheet.absoluteFill, nestedOverlayStyle]}>{overlay}</View>;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {overlay}
    </Modal>
  );
}
