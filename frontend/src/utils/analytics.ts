/**
 * Google Analytics 4 配置 - 仅用于页面浏览量统计
 * 使用双重跟踪：gtag 脚本 + React GA4
 */
import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-WW90Y5RHLE';

export const initGA = () => {
  try {
    // 初始化 React GA4
    ReactGA.initialize(MEASUREMENT_ID);
    console.log('React GA4 initialized successfully');
  } catch (error) {
    console.error('Failed to initialize React GA4:', error);
  }
};

export const trackPageView = (path: string) => {
  try {
    // 使用 React GA4 跟踪
    ReactGA.send({ 
      hitType: 'pageview', 
      page: path,
      title: document.title
    });
    
    // 也使用原生 gtag 跟踪（备用）
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', MEASUREMENT_ID, {
        page_path: path,
        page_title: document.title
      });
    }
    
    console.log('Page view tracked:', path);
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
};
