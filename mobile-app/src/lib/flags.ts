import { useConfig } from '@/api/queries';

/**
 * Feature flags from the admin panel (Ayarlar → Özellik anahtarları). The
 * server decides per person (rollout %, platform, app version, admins first),
 * so the app only asks "is it on for me?":
 *
 *   const offers = useFlag('teklif_ver');
 *   return offers ? <OfferButton /> : null;
 *
 * Unknown flags and flags not loaded yet are off, so new code stays hidden
 * until the server turns it on.
 */
export function useFlag(name: string): boolean {
  const { data } = useConfig();
  return data?.features?.[name] === true;
}

export function useFlags(): Record<string, boolean> {
  const { data } = useConfig();
  return data?.features ?? {};
}
