import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react-native';
import { catalog } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { EmptyState, ErrorState, Header, Loading, Text, space, useTheme } from '@/ui';

/**
 * Legal pages are light Markdown (see web/src/routes/sayfa/$slug.tsx):
 * "## " section titles, blank-line paragraphs and "- " / "1. " lists.
 */
function toBlocks(body: string): { heading: boolean; text: string }[] {
  const out: { heading: boolean; text: string }[] = [];
  for (const chunk of body.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (/^#{1,3}\s/.test(lines[0])) {
      out.push({ heading: true, text: lines[0].replace(/^#+\s*/, '') });
      lines.shift();
      if (!lines.length) continue;
    }
    out.push({ heading: false, text: lines.map((l) => l.replace(/^[-*]\s/, '• ').replace(/\*\*(.+?)\*\*/g, '$1')).join('\n') });
  }
  return out;
}

export default function LegalPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const query = useQuery({ queryKey: keys.legal(slug), queryFn: () => catalog.legal(slug), staleTime: 60 * 60_000 });
  const page = query.data;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={page?.title ?? ''} />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !page ? (
        <EmptyState icon={FileText} title="Sayfa bulunamadı" />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="title">{page.title}</Text>
          {toBlocks(page.body).map((p, i) => (
            <Text key={i} variant={p.heading ? 'subheading' : 'body'} selectable style={p.heading ? styles.heading : styles.paragraph}>
              {p.text}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, gap: space.md, paddingBottom: space.xxxl },
  heading: { marginTop: space.md },
  paragraph: { lineHeight: 23 },
});
