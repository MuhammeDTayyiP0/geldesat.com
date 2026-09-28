import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, Dimensions, FlatList, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { ImageIcon, X, Maximize2 } from 'lucide-react-native';
import { BrandColors } from '@/constants/Colors';
import { API_BASE_URL } from '@/src/api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 280;

interface ListingImageGalleryProps {
  images: string[];
  title: string;
}

export function ListingImageGallery({ images, title }: ListingImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const validImages = images?.length
    ? images.map((image) => image.startsWith('/') ? `${API_BASE_URL}${image}` : image)
    : [];

  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (slide !== activeIndex) {
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
            <TouchableOpacity activeOpacity={0.9} onPress={() => setIsFullscreen(true)} style={styles.imageSlide}>
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
      {validImages.length > 0 ? <TouchableOpacity style={styles.expandButton} onPress={() => setIsFullscreen(true)}>
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
              <View style={styles.fullscreenSlide}>
                <Image source={{ uri: item }} style={styles.fullscreenImage} resizeMode="contain" />
              </View>
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
