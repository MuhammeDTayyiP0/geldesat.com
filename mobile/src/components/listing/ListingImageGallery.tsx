import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, Dimensions, FlatList, TouchableOpacity, Modal, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageIcon, X, Maximize2 } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { API_BASE_URL } from '@/src/api/client';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 280;

interface ListingImageGalleryProps {
  images: string[];
  title: string;
}

export function ListingImageGallery({ images, title }: ListingImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewport, setViewport] = useState({ width: SCREEN_WIDTH, height: 1 });
  const zoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);

  const resetZoom = () => {
    zoomScale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    baseScale.value = 1;
    baseX.value = 0;
    baseY.value = 0;
    setIsZoomed(false);
  };

  const clampOffset = (offset: number, scale: number, length: number) => {
    'worklet';
    const limit = Math.max(0, (length * (scale - 1)) / 2);
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
      translateX.value = clampOffset(event.focalX - centerX - (event.focalX - centerX - baseX.value) * factor, nextScale, viewport.width);
      translateY.value = clampOffset(event.focalY - centerY - (event.focalY - centerY - baseY.value) * factor, nextScale, viewport.height);
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
      translateX.value = clampOffset(baseX.value + event.translationX, zoomScale.value, viewport.width);
      translateY.value = clampOffset(baseY.value + event.translationY, zoomScale.value, viewport.height);
    });

  const doubleTapGesture = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    if (zoomScale.value > 1.02) {
      zoomScale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(setIsZoomed)(false);
    } else {
      zoomScale.value = withSpring(2);
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

  const validImages = images?.length
    ? images.map((image) => image.startsWith('/') ? `${API_BASE_URL}${image}` : image)
    : [];

  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (slide !== activeIndex) {
      resetZoom();
      setActiveIndex(slide);
    }
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
        <TouchableOpacity activeOpacity={0.9} onPress={() => { resetZoom(); setIsFullscreen(true); }} style={styles.imageSlide}>
              <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.emptyGallery}>
          <ImageIcon size={38} color="#8a929e" />
          <Text style={styles.emptyGalleryText}>Bu ilan için fotoğraf eklenmemiş.</Text>
        </View>
      )}

      {/* Sayfa Sayacı Rozeti (Örn: 1 / 5) */}
      {validImages.length > 0 ? <View style={styles.counterBadge}>
        <Text style={styles.counterText}>
          {activeIndex + 1} / {validImages.length}
        </Text>
      </View> : null}

      {/* Büyütme İkonu */}
      {validImages.length > 0 ? <TouchableOpacity style={styles.expandButton} onPress={() => { resetZoom(); setIsFullscreen(true); }}>
        <Maximize2 size={16} color="#ffffff" />
      </TouchableOpacity> : null}

      {/* Tam Ekran Galeri Modalı */}
      <Modal visible={isFullscreen && validImages.length > 0} transparent={false} animationType="fade">
        <SafeAreaView style={styles.fullscreenContainer}>
          {/* Üst Bar: Kapat Butonu ve Başlık */}
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenCounter}>
              {activeIndex + 1} / {validImages.length}
            </Text>
            <TouchableOpacity onPress={() => setIsFullscreen(false)} style={styles.closeButton}>
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Tam Ekran Kaydırıcı */}
          <FlatList
            data={validImages}
            horizontal
            pagingEnabled
            initialScrollIndex={activeIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            keyExtractor={(_, index) => `fs-${index}`}
            renderItem={({ item }) => (
              <GestureDetector gesture={fullscreenGesture}>
                <View style={styles.fullscreenSlide} onLayout={onViewportLayout}>
                  <Animated.Image source={{ uri: item }} style={[styles.fullscreenImage, animatedImageStyle]} resizeMode="contain" />
                </View>
              </GestureDetector>
            )}
          />
        </SafeAreaView>
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
    width: SCREEN_WIDTH,
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
    width: SCREEN_WIDTH,
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

  // Tam Ekran Stilleri
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fullscreenCounter: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
});
