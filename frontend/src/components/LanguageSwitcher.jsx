import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const isHebrew = i18n.language?.startsWith('he');

  return (
    <button
      type="button"
      className="secondary"
      onClick={() => i18n.changeLanguage(isHebrew ? 'en' : 'he')}
      aria-label={t('common.switchLanguage')}
    >
      {isHebrew ? 'English' : 'עברית'}
    </button>
  );
}
