/**
 * 语言检测和转换工具
 */

export const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  
  // 中文 variants 映射
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  
  // 日语 variants 映射
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  
  // 其他所有语言默认使用英语
  return 'en';
};

export const getSupportedLanguage = (lang: string): string => {
  const supportedLanguages = ['zh', 'ja', 'en'];
  return supportedLanguages.includes(lang) ? lang : 'en';
};

export const getLanguageFromUrl = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  
  if (langParam && ['zh', 'ja', 'en'].includes(langParam)) {
    return langParam;
  }
  
  return null;
};
