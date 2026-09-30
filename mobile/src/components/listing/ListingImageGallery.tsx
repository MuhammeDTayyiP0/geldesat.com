import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Image, FlatList, TouchableOpacity, Modal, LayoutChangeEvent, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageIcon, X, Maximize2 } from 'lucide-react-native';
import { API_BASE_URL } from '@/src/api/client';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const GALLERY_HEIGHT = 280;

interface ListingImageGalleryProps {
  images: string[];
  title: string;
}

export function ListingImageGallery({ images, title }: ListingImageGalleryProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewport, setViewport] = useState({ width: screenWidth, height: 1 });
  const [naturalSize, setNaturalSize] = useState({ width: screenWidth, height: 1 });
  const zoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const imageWidth = useSharedValue(screenWidth);
  const imageHeight = useSharedValue(1);

  const validImages = useMemo(
    () => images?.length ? images.map((image) => image.startsWith('/') ? `${API_BASE_URL}${image}` : image) : [],
    [images],
  );

  const resetZoom = () => {
    zoomScale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    baseScale.value = 1;
    baseX.value = 0;
    baseY.value = 0;
    setIsZoomed(false);
  };

  const clampOffset = (offset: number, scale: number, imageLength: number, viewportLength: number) => {
    'worklet';
    const limit = Math.max(0, (imageLength * scale - viewportLength) / 2);
    return Math.max(-limit, Math.min(limit, offset));
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      baseScale.value = zoomScale.value;
      baseX.value = translateX.value;
      baseY.value = translateY.value;
      runOnJS(setIsZoomed)(true);
    })
    .onUpdate((event) => {
      const nextScale = Math.max(1, Math.min(4, baseScale.value * event.scale));
      const factor = nextScale / baseScale.value;
      const centerX = viewport.width / 2;
      const centerY = viewport.height / 2;
      translateX.value = clampOffset(
        event.focalX - centerX - (event.focalX - centerX - baseX.value) * factor,
        nextScale,
        imageWidth.value,
        viewport.width,
      );
      translateY.value = clampOffset(
        event.focalY - centerY - (event.focalY - centerY - baseY.value) * factor,
        nextScale,
        imageHeight.value,
        viewport.height,
      );
      zoomScale.value = nextScale;
    })
    .onEnd(() => {
      if (zoomScale.value <= 1.02) {
        zoomScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        runOnJS(setIsZoomed)(false);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      baseX.value = translateX.value;
      baseY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clampOffset(baseX.value + event.translationX, zoomScale.value, imageWidth.value, viewport.width);
      translateY.value = clampOffset(baseY.value + event.translationY, zoomScale.value, imageHeight.value, viewport.height);
    });

  const doubleTapGesture = Gesture.Tap().numberOfTaps(2).onEnd((event) => {
    if (zoomScale.value > 1.02) {
      zoomScale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(setIsZoomed)(false);
    } else {
      zoomScale.value = withSpring(2);
      translateX.value = withSpring(clampOffset(viewport.width / 2 - event.x, 2, imageWidth.value, viewport.width));
      translateY.value = withSpring(clampOffset(viewport.height / 2 - event.y, 2, imageHeight.value, viewport.height));
      runOnJS(setIsZoomed)(true);
    }
  });

  const fullscreenGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: zoomScale.value }],
  }));

  const onViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  useEffect(() => {
    if (!isFullscreen || !validImages[activeIndex]) return;
    let mounted = true;
    Image.getSize(validImages[activeIndex], (width, height) => {
      if (mounted) setNaturalSize({ width, height });
    }, () => {
      if (mounted) setNaturalSize({ width: screenWidth, height: viewport.height || 1 });
    });
    return () => { mounted = false; };
  }, [activeIndex, isFullscreen, screenWidth, validImages, viewport.height]);

  useEffect(() => {
    if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return;
    const containScale = Math.min(viewport.width / naturalSize.width, viewport.height / naturalSize.height);
    imageWidth.value = naturalSize.width * containScale;
    imageHeight.value = naturalSize.height * containScale;
  }, [imageHeight, imageWidth, naturalSize, viewport]);

  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (slide !== activeIndex) {
      resetZoom();
      setActiveIndex(slide);
    }
  };

  const openFullscreen = () => {
    resetZoom();
    setIsFullscreen(true);
  };
  const closeFullscreen = () => {
    resetZoom();
    setIsFullscreen(false);
  };

  return (
    <View style={styles.container}>
      {/* Yatay Kaydırılabilir Galeri */}
      {validImages.length ? (
        <FlatList
          data={validImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          keyExtractor={(_, index) => String(index)}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={openFullscreen} style={[styles.imageSlide, { width: screenWidth }]}>
              <Image source={{ uri: item }} style={[styles.galleryImage, { width: screenWidth }]} resizeMode="cover" accessibilityLabel={`${title} fotoğrafı`} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyGallery}>
          <ImageIcon size={38} color="#8a929e" />
          <Text style={styles.emptyGalleryText}>Bu ilan için fotoğraf eklenmemiş.</Text>
        </View>
      )}

      {validImages.length > 0 ? <View style={styles.counterBadge}>
        <Text style={styles.counterText}>{activeIndex + 1} / {validImages.length}</Text>
      </View> : null}
      {validImages.length > 0 ? <TouchableOpacity style={styles.expandButton} onPress={openFullscreen} accessibilityRole="button" accessibilityLabel="Fotoğrafı tam ekran aç">
        <Maximize2 size={16} color="#ffffff" />
      </TouchableOpacity> : null}

      <Modal
        visible={isFullscreen && validImages.length > 0}
        transparent={false}
        animationType="fade"
        statusBarTranslucent={Platform.OS === 'android'}
        navigationBarTranslucent={Platform.OS === 'android'}
        onRequestClose={closeFullscreen}>
        {/* Native Modal creates a separate native root; gesture handlers must be
            mounted under a root inside the modal as well as in the app shell. */}
        <GestureHandlerRootView style={styles.fullscreenContainer}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <View style={[styles.fullscreenHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.fullscreenCounter}>{activeIndex + 1} / {validImages.length}</Text>
            <TouchableOpacity onPress={closeFullscreen} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Fotoğrafı kapat">
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <FlatList
            style={styles.fullscreenList}
            data={validImages}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed}
            initialScrollIndex={activeIndex}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            keyExtractor={(_, index) => `fs-${index}`}
            renderItem={({ item }) => (
              <GestureDetector gesture={fullscreenGesture}>
                <View style={[styles.fullscreenSlide, { width: screenWidth }]} onLayout={onViewportLayout}>
                  <Animated.Image source={{ uri: item }} style={[styles.fullscreenImage, animatedImageStyle, { width: screenWidth }]} resizeMode="contain" accessibilityLabel={`${title} fotoğrafı`} />
                </View>
              </GestureDetector>
            )}
          />
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: GALLERY_HEIGHT,
    backgroundColor: '#000000',
    position: 'relative',
  },
  imageSlide: {
    height: GALLERY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGallery: {
    width: '100%',
    height: GALLERY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8ecf2',
  },
  emptyGalleryText: { color: '#5a6270', fontSize: 13 },
  galleryImage: {
    height: GALLERY_HEIGHT,
  },
  counterBadge: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  expandButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenContainer: { flex: 1, backgroundColor: '#000000' },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  fullscreenCounter: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenList: { flex: 1 },
  fullscreenSlide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { height: '100%' },
});
