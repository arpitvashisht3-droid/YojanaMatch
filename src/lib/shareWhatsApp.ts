import type { AppLanguage, MatchedSchemeResult } from '../types';
import { translations } from './translations';

const MAX_SHARED = 5;

function getPublicAppUrl(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return '';
  return window.location.origin;
}

export function buildWhatsAppMessage(results: MatchedSchemeResult[], language: AppLanguage): string {
  const t = translations[language];
  // Hindi names are used for Hindi and Marathi (same script) until Marathi data exists.
  const useHindi = language === 'hi' || language === 'mr';
  const top = results.slice(0, MAX_SHARED);

  const lines: string[] = [];
  lines.push(t.share_wa_intro.replace('{count}', String(results.length)));
  lines.push('');

  top.forEach((r, i) => {
    const name = useHindi ? r.scheme.hindi_name || r.scheme.name : r.scheme.name;
    const headline = useHindi
      ? r.scheme.hindi_benefit_headline || r.scheme.benefit_headline
      : r.scheme.benefit_headline;
    lines.push((i + 1) + '. *' + name + '*');
    lines.push(headline);
    lines.push(r.scheme.official_link);
    lines.push('');
  });

  lines.push(t.share_wa_footer);
  const appUrl = getPublicAppUrl();
  if (appUrl) lines.push(appUrl);

  return lines.join('\n');
}

export function openWhatsAppShare(message: string): void {
  if (typeof window === 'undefined') return;
  const url = 'https://wa.me/?text=' + encodeURIComponent(message);
  window.open(url, '_blank', 'noopener,noreferrer');
}
