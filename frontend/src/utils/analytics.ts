/**
 * Google Analytics 4 配置 - 仅用于页面浏览量统计
 * 使用双重跟踪：gtag 脚本 + React GA4
 */
import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-WW90Y5RHLE';

export const initGA = () => {
  try {
    ReactGA.initialize(MEASUREMENT_ID);
  } catch (error) {
    console.error('Failed to initialize React GA4:', error);
  }
};

export const trackPageView = (path: string) => {
  try {
    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: document.title,
    });

    // Fallback path for the inline gtag snippet in index.html.
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', MEASUREMENT_ID, {
        page_path: path,
        page_title: document.title,
      });
    }
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
};
