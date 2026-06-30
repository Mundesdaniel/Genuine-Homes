import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeLanguage, type LanguageCode } from '@/lib/i18n';

/** Compact language picker (English / Kiswahili / Luganda). */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label="Language"
      className="input w-auto py-1 text-sm"
      value={i18n.language}
      onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
