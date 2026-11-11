import { headers } from 'next/headers';

export interface Affiliate {
  name: string;
  url: string;
  regions: string[]; // ISO-коды стран, где букмекер лицензирован
  license: string; // номер/описание лицензии — показывается рядом со ссылкой
}

function configured(): Affiliate[] {
  try {
    const arr = JSON.parse(process.env.AFFILIATES_JSON || '[]');
    return Array.isArray(arr)
      ? arr.filter((a) => a && a.name && /^https:\/\//.test(a.url) && Array.isArray(a.regions) && a.license)
      : [];
  } catch {
    return [];
  }
}

/** Страна пользователя из заголовков CDN/прокси. Неизвестна → null (тогда ссылки не показываем). */
export async function userCountry(): Promise<string | null> {
  const h = await headers();
  const c = h.get('cf-ipcountry') || h.get('x-vercel-ip-country') || h.get('x-country-code');
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}

/** Только лицензированные в регионе пользователя. Нет региона или лицензии — пусто. */
export async function affiliatesForUser(): Promise<Affiliate[]> {
  const country = await userCountry();
  if (!country) return [];
  return configured().filter((a) => a.regions.map((r) => r.toUpperCase()).includes(country));
}
