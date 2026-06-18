import React, { useEffect } from 'react';
import HomePage from './HomePage';
import './i18n';
import { initGA, trackPageView } from './utils/analytics';

function App() {
  useEffect(() => {
    const timer = setTimeout(() => {
      initGA();
      trackPageView(window.location.pathname + window.location.search);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <HomePage />;
}

export default App;
