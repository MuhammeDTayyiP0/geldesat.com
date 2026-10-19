import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { previewTiles } from './tiles';

/** Small static map centred on a point, with a pin (chat location bubbles). */
export function MapThumb({ lat, lng, width = 230, height = 135, radius = 14 }: { lat: number; lng: number; width?: number; height?: number; radius?: number }) {
  const tiles = previewTiles(lat, lng, 16, width, height);
  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tiles.map((t) => (
        <Image key={t.key} source={t.url} style={{ position: 'absolute', left: t.left, top: t.top, width: 256, height: 256 }} cachePolicy="disk" />
      ))}
      <View style={[styles.pin, { left: width / 2 - 16, top: height / 2 - 30 }]}>
        <MapPin size={32} color="#ffffff" fill="#e5484d" strokeWidth={1.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#e9edf2' },
  pin: { position: 'absolute' },
});
