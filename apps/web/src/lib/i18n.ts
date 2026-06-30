import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * i18n scaffolding. English is the complete reference bundle; Swahili and
 * Luganda are partially translated for the launch-critical chrome and fall back
 * to English for everything else (fallbackLng), so adding a key never breaks a
 * locale. Translations for `sw`/`lg` should be reviewed by native speakers
 * before launch — the spec calls for Luganda/Swahili support, this lays the
 * pipes for it.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'lg', label: 'Luganda' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'gh-lang';

const en = {
  nav: {
    browse: 'Browse',
    saved: 'Saved',
    messages: 'Messages',
    payments: 'Payments',
    dashboard: 'Dashboard',
    admin: 'Admin',
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    account: 'Account',
  },
  hero: {
    title: 'Find your next home in Uganda',
    subtitle:
      'Rent, buy outright, or buy in installments — from verified listings, paid with Mobile Money.',
  },
};

// Partial — unset keys fall back to English.
const sw: typeof en = {
  nav: {
    browse: 'Vinjari',
    saved: 'Zilizohifadhiwa',
    messages: 'Ujumbe',
    payments: 'Malipo',
    dashboard: 'Dashibodi',
    admin: 'Msimamizi',
    login: 'Ingia',
    signup: 'Jisajili',
    logout: 'Toka',
    account: 'Akaunti',
  },
  hero: {
    title: 'Pata nyumba yako ijayo nchini Uganda',
    subtitle:
      'Kodisha, nunua moja kwa moja, au nunua kwa awamu — kutoka matangazo yaliyothibitishwa, kulipa kwa Pesa za Simu.',
  },
};

const lg: Partial<typeof en> = {
  nav: {
    browse: 'Noonya',
    saved: 'Ebitereke',
    messages: 'Obubaka',
    payments: 'Ebisasulwa',
    dashboard: 'Dashiboodi',
    admin: 'Omukulu',
    login: 'Yingira',
    signup: 'Wewandiise',
    logout: 'Fuluma',
    account: 'Akawunti',
  },
};

const stored =
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) as LanguageCode | null)
    : null;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sw: { translation: sw },
    lg: { translation: lg },
  },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function changeLanguage(code: LanguageCode): void {
  void i18n.changeLanguage(code);
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, code);
}

export default i18n;
