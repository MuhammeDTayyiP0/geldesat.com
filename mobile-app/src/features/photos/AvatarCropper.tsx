import { useId, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { FlipHorizontal2, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import { cropSquarePhoto, flipPhotoHorizontal, rotatePhoto, type PickedPhoto } from '@/lib/photos';
import { Button, IconButton, Text, ToastHost, font, radius, space, toast } from '@/ui';

export type AvatarCropperProps = {
  /** The picked photo to preview and crop; null keeps the editor closed. */
  photo: PickedPhoto | null;
  /** Preview cutout shape: circular for user avatars, rounded square for store logos. */
  shape?: 'circle' | 'rounded';
  title?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (cropped: { uri: string; mimeType: string; fileName: string }) => void | Promise<void>;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Instagram-style square/circular photo preview & crop editor: pan, pinch/button
 * zoom, double-tap to zoom, 90° rotate, horizontal flip, and live cutout mask.
 */
export function AvatarCropper({ photo, shape = 'circle', title = 'Profil fotoğrafı', busy = false, onCancel, onConfirm }: AvatarCropperProps) {
  return (
    <Modal
      visible={photo !== null}
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait']}
    >
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        {photo ? <CropperBody key={photo.uri} photo={photo} shape={shape} title={title} busy={busy} onCancel={onCancel} onConfirm={onConfirm} /> : null}
        <ToastHost active={photo !== null} />
      </GestureHandlerRootView>
    </Modal>
  );
}

function CropperBody({
  photo,
  shape,
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  photo: PickedPhoto;
  shape: 'circle' | 'rounded';
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (cropped: { uri: string; mimeType: string; fileName: string }) => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const maskId = useId();
  const [workingPhoto, setWorkingPhoto] = useState<PickedPhoto>(photo);
  const [transforming, setTransforming] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [zoomLabel, setZoomLabel] = useState(1);

  const stageSize = Math.max(240, Math.min(width - 32, Math.round(height * 0.48), 340));
  const baseScale = Math.max(stageSize / Math.max(1, workingPhoto.width), stageSize / Math.max(1, workingPhoto.height));
  const baseW = workingPhoto.width * baseScale;
  const baseH = workingPhoto.height * baseScale;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const gridOpacity = useSharedValue(0);
  const isPinching = useSharedValue(false);

  const clampOffset = (nx: number, ny: number, s: number) => {
    'worklet';
    const maxTx = Math.max(0, (baseW * s - stageSize) / 2);
    const maxTy = Math.max(0, (baseH * s - stageSize) / 2);
    return {
      x: Math.min(maxTx, Math.max(-maxTx, nx)),
      y: Math.min(maxTy, Math.max(-maxTy, ny)),
    };
  };

  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      if (isPinching.value) return;
      gridOpacity.value = withTiming(1, { duration: 120 });
    },
    onUpdate: (e) => {
      'worklet';
      if (isPinching.value) return;
      const c = clampOffset(savedTx.value + e.translationX, savedTy.value + e.translationY, scale.value);
      tx.value = c.x;
      ty.value = c.y;
    },
    onDeactivate: () => {
      'worklet';
      if (isPinching.value) return;
      const c = clampOffset(tx.value, ty.value, scale.value);
      tx.value = c.x;
      ty.value = c.y;
      savedTx.value = c.x;
      savedTy.value = c.y;
      gridOpacity.value = withTiming(0, { duration: 240 });
    },
  });

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      isPinching.value = true;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      gridOpacity.value = withTiming(1, { duration: 120 });
    },
    onUpdate: (e) => {
      'worklet';
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * e.scale));
      scale.value = nextScale;
      const c = clampOffset(tx.value, ty.value, nextScale);
      tx.value = c.x;
      ty.value = c.y;
    },
    onDeactivate: () => {
      'worklet';
      isPinching.value = false;
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale.value));
      scale.value = nextScale;
      savedScale.value = nextScale;
      const c = clampOffset(tx.value, ty.value, nextScale);
      tx.value = c.x;
      ty.value = c.y;
      savedTx.value = c.x;
      savedTy.value = c.y;
      gridOpacity.value = withTiming(0, { duration: 240 });
      scheduleOnRN(setZoomLabel, nextScale);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      const next = savedScale.value > 1.15 ? 1 : 2;
      scale.value = withTiming(next, { duration: 200 });
      savedScale.value = next;
      if (next === 1) {
        tx.value = withTiming(0, { duration: 200 });
        ty.value = withTiming(0, { duration: 200 });
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        const c = clampOffset(tx.value, ty.value, next);
        tx.value = withTiming(c.x, { duration: 200 });
        ty.value = withTiming(c.y, { duration: 200 });
        savedTx.value = c.x;
        savedTy.value = c.y;
      }
      scheduleOnRN(setZoomLabel, next);
    },
  });

  const gesture = useSimultaneousGestures(pan, pinch, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  const resetTransform = (animated = true) => {
    if (animated) {
      scale.set(withTiming(1, { duration: 180 }));
      tx.set(withTiming(0, { duration: 180 }));
      ty.set(withTiming(0, { duration: 180 }));
    } else {
      scale.set(1);
      tx.set(0);
      ty.set(0);
    }
    savedScale.set(1);
    savedTx.set(0);
    savedTy.set(0);
    setZoomLabel(1);
  };

  const stepZoom = (delta: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((scale.get() + delta).toFixed(2))));
    const maxTx = Math.max(0, (baseW * next - stageSize) / 2);
    const maxTy = Math.max(0, (baseH * next - stageSize) / 2);
    const nx = Math.min(maxTx, Math.max(-maxTx, tx.get()));
    const ny = Math.min(maxTy, Math.max(-maxTy, ty.get()));
    scale.set(withTiming(next, { duration: 160 }));
    tx.set(withTiming(nx, { duration: 160 }));
    ty.set(withTiming(ny, { duration: 160 }));
    savedScale.set(next);
    savedTx.set(nx);
    savedTy.set(ny);
    setZoomLabel(next);
  };

  const handleRotate = async () => {
    if (transforming || cropping || busy) return;
    setTransforming(true);
    try {
      const next = await rotatePhoto(workingPhoto);
      setWorkingPhoto(next);
      resetTransform(false);
    } catch {
      toast.error('Fotoğraf döndürülemedi');
    } finally {
      setTransforming(false);
    }
  };

  const handleFlip = async () => {
    if (transforming || cropping || busy) return;
    setTransforming(true);
    try {
      const next = await flipPhotoHorizontal(workingPhoto);
      setWorkingPhoto(next);
      resetTransform(false);
    } catch {
      toast.error('Fotoğraf aynalanamadı');
    } finally {
      setTransforming(false);
    }
  };

  const handleConfirm = async () => {
    if (transforming || cropping || busy) return;
    if (!workingPhoto.width || !workingPhoto.height) {
      toast.error('Fotoğraf boyutları okunamadı');
      return;
    }
    setCropping(true);
    try {
      cancelAnimation(scale);
      cancelAnimation(tx);
      cancelAnimation(ty);
      const s = savedScale.get();
      const curTx = savedTx.get();
      const curTy = savedTy.get();
      const dispW = baseW * s;
      const dispH = baseH * s;
      const imgLeft = (stageSize - dispW) / 2 + curTx;
      const imgTop = (stageSize - dispH) / 2 + curTy;
      const pxPerStagePx = 1 / (baseScale * s);
      const originX = -imgLeft * pxPerStagePx;
      const originY = -imgTop * pxPerStagePx;
      const size = stageSize * pxPerStagePx;
      const cropped = await cropSquarePhoto(workingPhoto, { originX, originY, size });
      await onConfirm(cropped);
    } catch {
      toast.error('Fotoğraf kırpılamadı');
    } finally {
      setCropping(false);
    }
  };

  const disabled = transforming || cropping || busy;
  const cornerRadius = shape === 'circle' ? stageSize / 2 : 28;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon={X} label="Vazgeç" onPress={onCancel} disabled={cropping || busy} tone="onImage" />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Button title="Uygula" size="sm" loading={cropping || busy} disabled={transforming} onPress={() => void handleConfirm()} />
      </View>

      <View style={styles.stageArea}>
        <View style={[styles.stage, { width: stageSize, height: stageSize }]}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.stageInner, { width: stageSize, height: stageSize }]}>
              <Animated.View style={[styles.imageWrap, imageStyle]}>
                <Image source={{ uri: workingPhoto.uri }} style={{ width: baseW, height: baseH }} contentFit="fill" />
              </Animated.View>
            </View>
          </GestureDetector>

          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={stageSize} height={stageSize}>
              <Defs>
                <Mask id={maskId}>
                  <Rect x={0} y={0} width={stageSize} height={stageSize} fill="#fff" />
                  {shape === 'circle' ? (
                    <Circle cx={stageSize / 2} cy={stageSize / 2} r={stageSize / 2 - 1} fill="#000" />
                  ) : (
                    <Rect x={1} y={1} width={stageSize - 2} height={stageSize - 2} rx={28} ry={28} fill="#000" />
                  )}
                </Mask>
              </Defs>
              <Rect x={0} y={0} width={stageSize} height={stageSize} fill="rgba(0,0,0,0.62)" mask={`url(#${maskId})`} />
              {shape === 'circle' ? (
                <Circle cx={stageSize / 2} cy={stageSize / 2} r={stageSize / 2 - 1} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={1.5} />
              ) : (
                <Rect x={1} y={1} width={stageSize - 2} height={stageSize - 2} rx={28} ry={28} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={1.5} />
              )}
            </Svg>

            <Animated.View style={[StyleSheet.absoluteFill, styles.gridOverlay, { borderRadius: cornerRadius }, gridStyle]}>
              <View style={[styles.gridV, { left: '33.33%' }]} />
              <View style={[styles.gridV, { left: '66.66%' }]} />
              <View style={[styles.gridH, { top: '33.33%' }]} />
              <View style={[styles.gridH, { top: '66.66%' }]} />
            </Animated.View>
          </View>
        </View>

        <Text variant="caption" style={styles.hint}>
          Kaydırarak konumlandırın, iki parmakla yakınlaştırın
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, space.md) + space.sm }]}>
        <View style={styles.zoomBar}>
          <Pressable
            onPress={() => stepZoom(-0.35)}
            disabled={disabled || zoomLabel <= MIN_ZOOM}
            style={({ pressed }) => [styles.zoomBtn, (pressed || disabled || zoomLabel <= MIN_ZOOM) && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel="Uzaklaştır"
          >
            <ZoomOut size={18} color="#fff" />
          </Pressable>
          <Text style={styles.zoomText}>{zoomLabel.toFixed(1)}x</Text>
          <Pressable
            onPress={() => stepZoom(0.35)}
            disabled={disabled || zoomLabel >= MAX_ZOOM}
            style={({ pressed }) => [styles.zoomBtn, (pressed || disabled || zoomLabel >= MAX_ZOOM) && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel="Yakınlaştır"
          >
            <ZoomIn size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <ActionTool icon={RotateCw} label="Döndür" onPress={() => void handleRotate()} disabled={disabled} />
          <ActionTool icon={FlipHorizontal2} label="Aynala" onPress={() => void handleFlip()} disabled={disabled} />
          <ActionTool icon={RotateCcw} label="Sıfırla" onPress={() => resetTransform(true)} disabled={disabled} />
        </View>
      </View>
    </View>
  );
}

function ActionTool({ icon: Icon, label, onPress, disabled }: { icon: typeof RotateCw; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.toolBtn, (pressed || disabled) && styles.dim]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.toolCircle}>
        <Icon size={18} color="#fff" />
      </View>
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0c' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  title: { flex: 1, color: '#fff', fontWeight: '600', fontSize: font.md, textAlign: 'center' },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, gap: space.md },
  stage: { position: 'relative', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#141418' },
  stageInner: { alignItems: 'center', justifyContent: 'center' },
  imageWrap: { alignItems: 'center', justifyContent: 'center' },
  gridOverlay: { overflow: 'hidden' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  hint: { color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  controls: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  zoomBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#fff', fontWeight: '600', fontSize: font.sm, minWidth: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  toolBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  toolCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  toolLabel: { color: '#fff', fontWeight: '500', fontSize: font.xs },
  dim: { opacity: 0.45 },
});
