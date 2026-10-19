import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareText, Plus, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { chat } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { MAX_TEMPLATES, MAX_TEMPLATE_LENGTH } from '@/features/chat/shared';
import { Button, Card, EmptyState, Header, IconButton, Input, Loading, Text, space, toast, useTheme } from '@/ui';

/** Saved reply templates, offered as quick replies in chats (same list as on the website). */
export default function TemplatesScreen() {
  const { c } = useTheme();
  const query = useQuery({ queryKey: keys.templates, queryFn: chat.templates });
  const [saved, setItems] = useState<string[] | null>(null);
  const items = saved ?? query.data ?? [];
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const persist = async (next: string[]) => {
    setSaving(true);
    try {
      const result = await chat.saveTemplates(next);
      setItems(result);
      queryClient.setQueryData(keys.templates, result);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Hazır mesajlarım" />
      {query.isLoading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text tone="muted">Sık yazdığınız mesajları kaydedin; sohbette ⚡ simgesiyle tek dokunuşla gönderin.</Text>
          <Input
            multiline
            placeholder="Örn. Merhaba, ürün hâlâ satılık. Akşam 18:00’den sonra görüşebiliriz."
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, MAX_TEMPLATE_LENGTH))}
            hint={`${draft.length}/${MAX_TEMPLATE_LENGTH}`}
          />
          <Button
            title="Ekle"
            icon={Plus}
            disabled={!draft.trim() || items.length >= MAX_TEMPLATES}
            loading={saving}
            onPress={async () => {
              await persist([...items, draft.trim()]);
              setDraft('');
            }}
          />
          {items.length >= MAX_TEMPLATES ? (
            <Text variant="caption" tone="warn">
              En fazla {MAX_TEMPLATES} hazır mesaj kaydedebilirsiniz.
            </Text>
          ) : null}
          {items.length ? (
            items.map((t, i) => (
              <Card key={`${i}-${t}`} style={styles.item}>
                <Text style={styles.flex}>{t}</Text>
                <IconButton icon={Trash2} label="Sil" tone="danger" size={34} onPress={() => void persist(items.filter((_, j) => j !== i))} />
              </Card>
            ))
          ) : (
            <EmptyState compact icon={MessageSquareText} title="Henüz hazır mesajınız yok" />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
