import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import he from './he.json';

const STORAGE_KEY = 'scholarslink.locale';

function normalize(language) {
  return String(language || '').startsWith('he') ? 'he' : 'en';
}

function applyDocumentDirection(language) {
  const lang = normalize(language);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

function resolveInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'he' || saved === 'en') {
      return saved;
    }
  } catch {
    // Storage unavailable; fall back to the default.
  }
  return 'he';
}

const initialLanguage = resolveInitialLanguage();
applyDocumentDirection(initialLanguage);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (language) => {
  const lang = normalize(language);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors.
  }
  applyDocumentDirection(lang);
});

export default i18n;
