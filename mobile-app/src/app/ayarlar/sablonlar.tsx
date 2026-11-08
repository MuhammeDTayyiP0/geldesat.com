import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareText, Plus, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { chat } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import { MAX_TEMPLATES, MAX_TEMPLATE_LENGTH } from '@/features/chat/shared';
import { Button, Card, EmptyState, ErrorState, Header, IconButton, Input, Loading, Text, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

/** Saved reply templates, offered as quick replies in chats (same list as on the website). */
export default function TemplatesScreenScreen() {
  return (
    <RequireSignIn title="Hazır mesajlarım">
      <TemplatesScreen />
    </RequireSignIn>
  );
}

function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const query = useQuery({ queryKey: keys.templates, queryFn: chat.templates });
  const [saved, setItems] = useState<string[] | null>(null);
  // Saving replaces the whole list, so nothing is saved before the real list is known.
  const known = saved ?? query.data ?? null;
  const items = known ?? [];
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  /** One save at a time, from the latest list; true when it worked. */
  const persist = async (next: string[]): Promise<boolean> => {
    if (saving || !known) return false;
    setSaving(true);
    try {
      const result = await chat.saveTemplates(next);
      setItems(result);
      queryClient.setQueryData(keys.templates, result);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Hazır mesajlarım" />
      {query.isLoading ? (
        <Loading />
      ) : !known ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
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
            disabled={!draft.trim() || items.length >= MAX_TEMPLATES || saving}
            loading={saving}
            onPress={async () => {
              // The text stays when saving fails, so it can be sent again.
              if (await persist([...items, draft.trim()])) setDraft('');
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
                <IconButton
                  icon={Trash2}
                  label={`"${t.slice(0, 30)}" mesajını sil`}
                  tone="danger"
                  size={34}
                  disabled={saving}
                  onPress={() => void persist(items.filter((_, j) => j !== i))}
                />
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
