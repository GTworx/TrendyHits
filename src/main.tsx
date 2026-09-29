import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, detectLang, langFromPath } from './i18n';
import { App } from './App';
import './index.css';

// Netlify redirects "/" by browser language; this covers plain `vite` dev and unknown paths.
let initialLang = langFromPath(window.location.pathname);
if (!initialLang) {
  initialLang = detectLang();
  window.history.replaceState(null, '', `/${initialLang}/`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider initialLang={initialLang}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
