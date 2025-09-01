import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { detectBrowserLanguage, getLanguageFromUrl, getSupportedLanguage } from '../utils/languageUtils';

import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

const resources = {
  en: {
    translation: en
  },
  zh: {
    translation: zh
  },
  ja: {
    translation: ja
  }
};

// 自定义语言检测器
const customLanguageDetector = {
  name: 'customDetector',
  lookup() {
    // 1. 检查 URL 参数
    const urlLang = getLanguageFromUrl();
    if (urlLang) {
      return urlLang;
    }
    
    // 2. 检查本地存储
    const stored = localStorage.getItem('i18nextLng');
    if (stored) {
      return getSupportedLanguage(stored);
    }
    
    // 3. 检查浏览器语言
    return detectBrowserLanguage();
  },
  
  cacheUserLanguage(lng: string) {
    localStorage.setItem('i18nextLng', lng);
  }
};

i18n
  .use({
    type: 'languageDetector',
    async: false,
    init() {},
    detect: customLanguageDetector.lookup,
    cacheUserLanguage: customLanguageDetector.cacheUserLanguage
  })
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['customDetector', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;
