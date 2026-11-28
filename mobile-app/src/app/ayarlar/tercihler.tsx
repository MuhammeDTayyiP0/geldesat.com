import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUpDown, BadgePercent, Clock, LayoutGrid, MapPin, Plane } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { AccountSettings, BrowsePrefs, BrowseSort, BrowseView, SellerPrefs } from '@/api/types';
import { OptionPicker } from '@/features/location/OptionPicker';
import { useViewLayout } from '@/lib/storage';
import { ErrorState, Header, Input, ListRow, Loading, RowGroup, space, toast, useTheme } from '@/ui';
import { RequireSignIn } from '@/auth/RequireSignIn';

const SORT_LABELS: Record<BrowseSort, string> = {
  date_desc: 'En yeni ilanlar',
  price_asc: 'Fiyat: Düşükten yükseğe',
  price_desc: 'Fiyat: Yüksekten düşüğe',
  distance: 'Konuma en yakın',
};
const SORT_OPTIONS = Object.values(SORT_LABELS);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

const DEFAULT_BROWSE: BrowsePrefs = { default_city: '', default_sort: 'date_desc', default_view: 'grid' };
const DEFAULT_SELLER: SellerPrefs = {
  accept_offers: true,
  call_hours_enabled: false,
  call_hours_start: '09:00',
  call_hours_end: '21:00',
  away_mode: false,
  away_message: '',
};

export default function PreferencesScreen() {
  return (
    <RequireSignIn title="Alışveriş ve satıcı">
      <Preferences />
    </RequireSignIn>
  );
}

function Preferences() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const settings = useQuery({ queryKey: keys.settings, queryFn: account.settings });
  const [, setViewLayout] = useViewLayout();
  const [picker, setPicker] = useState<'city' | 'sort' | 'view' | 'start' | 'end' | null>(null);
  const [awayDraft, setAwayDraft] = useState<string | null>(null);

  const browse = settings.data?.user_prefs?.browse_prefs ?? DEFAULT_BROWSE;
  const seller = settings.data?.user_prefs?.seller_prefs ?? DEFAULT_SELLER;

  const savePrefs = useMutation({
    mutationFn: (patch: { browse_prefs?: BrowsePrefs; seller_prefs?: SellerPrefs }) => account.updateUserPrefs(patch),
    onMutate: (patch) => {
      const prev = queryClient.getQueryData<AccountSettings>(keys.settings);
      queryClient.setQueryData<AccountSettings>(keys.settings, (d) => {
        if (!d) return d;
        const current = d.user_prefs ?? {
          quiet_hours: { enabled: false, start: '23:00', end: '08:00' },
          browse_prefs: DEFAULT_BROWSE,
          seller_prefs: DEFAULT_SELLER,
        };
        return {
          ...d,
          user_prefs: {
            ...current,
            ...(patch.browse_prefs ? { browse_prefs: patch.browse_prefs } : {}),
            ...(patch.seller_prefs ? { seller_prefs: patch.seller_prefs } : {}),
          },
        };
      });
      return { prev };
    },
    onError: (e, _, ctx) => {
      queryClient.setQueryData(keys.settings, ctx?.prev);
      toast.error(errorMessage(e));
    },
  });

  const awayText = awayDraft ?? seller.away_message;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="Alışveriş ve satıcı" />
      {settings.isLoading && !settings.data ? (
        <Loading />
      ) : settings.isError && !settings.data ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
          <RowGroup title="Alışveriş ve arama">
            <ListRow
              icon={MapPin}
              label="Varsayılan şehir"
              value={browse.default_city || 'Tüm Türkiye'}
              onPress={() => setPicker('city')}
            />
            <ListRow
              icon={ArrowUpDown}
              label="Varsayılan sıralama"
              value={SORT_LABELS[browse.default_sort]}
              onPress={() => setPicker('sort')}
            />
            <ListRow
              icon={LayoutGrid}
              label="İlan görünümü"
              value={browse.default_view === 'list' ? 'Liste' : 'Kart'}
              onPress={() => setPicker('view')}
            />
          </RowGroup>

          <RowGroup title="Satıcı iletişim tercihleri">
            <ListRow
              icon={BadgePercent}
              label="Sohbette fiyat teklifi al"
              detail="Kapatırsanız alıcılar fiyat teklifi gönderemez"
              switchValue={seller.accept_offers}
              onSwitch={(v) => savePrefs.mutate({ seller_prefs: { ...seller, accept_offers: v } })}
            />
            <ListRow
              icon={Clock}
              label="Aranabilir saat aralığı"
              detail="Profilinizde uygun arama saatlerinizi gösterir"
              switchValue={seller.call_hours_enabled}
              onSwitch={(v) => savePrefs.mutate({ seller_prefs: { ...seller, call_hours_enabled: v } })}
            />
            {seller.call_hours_enabled ? (
              <>
                <ListRow label="Başlangıç saati" value={seller.call_hours_start} onPress={() => setPicker('start')} />
                <ListRow label="Bitiş saati" value={seller.call_hours_end} onPress={() => setPicker('end')} />
              </>
            ) : null}
            <ListRow
              icon={Plane}
              label="Müsait değil / Tatil modu"
              detail="Profilinizde geçici bilgi mesajı gösterir"
              switchValue={seller.away_mode}
              onSwitch={(v) => savePrefs.mutate({ seller_prefs: { ...seller, away_mode: v } })}
            />
          </RowGroup>

          {seller.away_mode ? (
            <Input
              label="Tatil / müsait değil mesajı"
              multiline
              placeholder="Örn. Şu an şehir dışındayım, mesajlarınıza akşam dönüş yapacağım."
              value={awayText}
              onChangeText={(t) => setAwayDraft(t.slice(0, 200))}
              onBlur={() => {
                if (awayDraft !== null) {
                  savePrefs.mutate({ seller_prefs: { ...seller, away_message: awayDraft.trim() } });
                }
              }}
              maxLength={200}
              hint={`${awayText.length}/200`}
            />
          ) : null}
        </ScrollView>
      )}

      <OptionPicker
        visible={picker === 'city'}
        onClose={() => setPicker(null)}
        title="Varsayılan şehir"
        allLabel="Tüm Türkiye"
        value={browse.default_city || null}
        onSelect={(val) => savePrefs.mutate({ browse_prefs: { ...browse, default_city: val ?? '' } })}
      />
      <OptionPicker
        visible={picker === 'sort'}
        onClose={() => setPicker(null)}
        title="Varsayılan sıralama"
        options={SORT_OPTIONS}
        value={SORT_LABELS[browse.default_sort]}
        onSelect={(val) => {
          const entry = Object.entries(SORT_LABELS).find(([, label]) => label === val);
          if (entry) savePrefs.mutate({ browse_prefs: { ...browse, default_sort: entry[0] as BrowseSort } });
        }}
      />
      <OptionPicker
        visible={picker === 'view'}
        onClose={() => setPicker(null)}
        title="İlan görünümü"
        options={['Kart görünümü', 'Liste görünümü']}
        value={browse.default_view === 'list' ? 'Liste görünümü' : 'Kart görünümü'}
        onSelect={(val) => {
          const nextView: BrowseView = val === 'Liste görünümü' ? 'list' : 'grid';
          setViewLayout(nextView);
          savePrefs.mutate({ browse_prefs: { ...browse, default_view: nextView } });
        }}
      />
      <OptionPicker
        visible={picker === 'start' || picker === 'end'}
        onClose={() => setPicker(null)}
        title={picker === 'start' ? 'Aranabilir başlangıç saati' : 'Aranabilir bitiş saati'}
        options={HOUR_OPTIONS}
        value={picker === 'start' ? seller.call_hours_start : seller.call_hours_end}
        onSelect={(val) => {
          if (!val) return;
          const field = picker === 'start' ? 'call_hours_start' : 'call_hours_end';
          savePrefs.mutate({ seller_prefs: { ...seller, [field]: val } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
});
