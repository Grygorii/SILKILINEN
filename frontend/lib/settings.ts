const API = process.env.NEXT_PUBLIC_API_URL;

export type SiteSettings = {
  welcomeOfferPercent: number;
  welcomeOfferCode: string;
  supportEmail: string;
  brandTagline: string;
  brandLocation: string;
  freeShippingThreshold: number;
};

export const SETTINGS_FALLBACK: SiteSettings = {
  welcomeOfferPercent: 10,
  welcomeOfferCode: 'SILK10',
  supportEmail: 'hello@silkilinen.com',
  brandTagline: 'Pure silk & linen intimates',
  brandLocation: 'Donegal, Ireland',
  freeShippingThreshold: 150,
};

// Server components: fetch the editable site settings (welcome offer, business
// details) with ISR. Falls back so a page never renders empty. The client hook
// lives in ./useSiteSettings (separate file so this stays a server module).
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API}/api/settings`, { next: { revalidate: 300 } });
    if (!res.ok) return SETTINGS_FALLBACK;
    return { ...SETTINGS_FALLBACK, ...(await res.json()) };
  } catch {
    return SETTINGS_FALLBACK;
  }
}
