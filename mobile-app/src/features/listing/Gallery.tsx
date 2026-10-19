import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageOff, X } from 'lucide-react-native';
import { mediaUrl } from '@/lib/config';
import { IconButton, Text, radius, space, useTheme } from '@/ui';

/** Swipeable photo strip for the listing page; tapping opens the full-screen viewer. */
export function Gallery({ images, height }: { images: string[]; height: number }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  if (!images.length) {
    return (
      <View style={[styles.empty, { height, backgroundColor: c.elevated }]}>
        <ImageOff size={36} color={c.subtle} />
        <Text tone="subtle">Fotoğraf eklenmemiş</Text>
      </View>
    );
  }

  return (
    <View style={{ height, backgroundColor: '#0d1117' }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item}-${i}`}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Fotoğraf ${i + 1}, büyüt`} onPress={() => setViewer(i)}>
            <Image source={mediaUrl(item, 1200)} style={{ width, height }} contentFit="cover" transition={150} />
          </Pressable>
        )}
      />
      {images.length > 1 ? (
        <View style={styles.counter}>
          <Text variant="small" style={styles.counterText}>
            {index + 1} / {images.length}
          </Text>
        </View>
      ) : null}
      <PhotoViewer images={images} start={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/** Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom. */
export function PhotoViewer({
  images,
  start,
  onClose,
  headers,
}: {
  images: string[];
  start: number | null;
  onClose: () => void;
  /** Request headers for private photos (chat images need the session). */
  headers?: Record<string, string>;
}) {
  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait']}>
      {start !== null ? <ViewerBody key={start} images={images} start={start} onClose={onClose} headers={headers} /> : null}
    </Modal>
  );
}

function ViewerBody({ images, start, onClose, headers }: { images: string[]; start: number; onClose: () => void; headers?: Record<string, string> }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  return (
    <GestureHandlerRootView style={styles.viewer}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item}-${i}`}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <ZoomableImage uri={mediaUrl(item) ?? ''} headers={headers} width={width} height={height} onZoomChange={setZoomed} />
        )}
      />
      <View style={[styles.viewerTop, { paddingTop: insets.top + space.sm }]}>
        <Text variant="label" style={styles.counterText}>
          {index + 1} / {images.length}
        </Text>
        <IconButton icon={X} label="Kapat" tone="onImage" onPress={onClose} />
      </View>
    </GestureHandlerRootView>
  );
}

function ZoomableImage({
  uri,
  headers,
  width,
  height,
  onZoomChange,
}: {
  uri: string;
  headers?: Record<string, string>;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const setZoom = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    setZoom(false);
  };

  const clampTranslate = (s: number) => {
    const maxX = ((s - 1) * width) / 2;
    const maxY = ((s - 1) * height) / 2;
    tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onUpdate: (e) => {
      scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale));
    },
    onDeactivate: () => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) reset();
      else {
        clampTranslate(scale.value);
        savedTx.value = tx.value;
        savedTy.value = ty.value;
        setZoom(true);
      }
    },
  });

  const pan = usePanGesture({
    runOnJS: true,
    enabled: zoomed,
    onUpdate: (e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    },
    onDeactivate: () => {
      clampTranslate(scale.value);
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    },
  });

  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: () => {
      if (savedScale.value > 1) reset();
      else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        setZoom(true);
      }
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={{ uri, headers }} style={{ width, height }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  counter: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    backgroundColor: 'rgba(13,17,23,0.6)',
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  counterText: { color: '#fff' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
});
