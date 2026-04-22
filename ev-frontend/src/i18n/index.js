import React, { createContext, useContext, useMemo, useState } from 'react';
import en from './en.json';
import hi from './hi.json';

const I18N_STORAGE_KEY = 'ev-language';
const dictionaries = { en, hi };

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'en';
  const persisted = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (persisted === 'en' || persisted === 'hi') return persisted;
  const browser = String(window.navigator.language || 'en').toLowerCase();
  return browser.startsWith('hi') ? 'hi' : 'en';
}

function resolveKey(dict, key) {
  return key.split('.').reduce((acc, part) => acc?.[part], dict);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  function setLanguage(next) {
    const resolved = next === 'hi' ? 'hi' : 'en';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(I18N_STORAGE_KEY, resolved);
    }
    setLanguageState(resolved);
  }

  const value = useMemo(() => {
    const dict = dictionaries[language] || dictionaries.en;

    function t(key, vars = {}) {
      let template = resolveKey(dict, key);
      if (typeof template !== 'string') {
        template = resolveKey(dictionaries.en, key);
      }
      if (typeof template !== 'string') return key;
      return Object.keys(vars).reduce(
        (acc, k) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(vars[k])),
        template
      );
    }

    return {
      language,
      locale: language,
      isHindi: language === 'hi',
      setLanguage,
      setLocale: setLanguage,
      t,
    };
  }, [language]);

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(I18nContext);
  if (context) return context;

  const language = getInitialLanguage();
  const dict = dictionaries[language] || dictionaries.en;
  function t(key, vars = {}) {
    let template = resolveKey(dict, key);
    if (typeof template !== 'string') template = resolveKey(dictionaries.en, key);
    if (typeof template !== 'string') return key;
    return Object.keys(vars).reduce(
      (acc, k) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(vars[k])),
      template
    );
  }
  return {
    language,
    locale: language,
    isHindi: language === 'hi',
    setLanguage: () => {},
    setLocale: () => {},
    t,
  };
}

export function useI18n() {
  return useLanguage();
}

export default useI18n;
