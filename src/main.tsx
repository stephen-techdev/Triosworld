import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { primeLiveCatalog } from '@/lib/storefrontCatalog';
import { primeSiteContent } from '@/lib/siteContent';
import { primeStoreSettings } from '@/lib/storeSettings';

// Kick every first-paint fetch off at module scope, before React renders.
// The anchored route ("= shop grid") waits on the product list, so this
// parallelises the Supabase reads with the bundle parse instead of starting
// them only once a component mounts. Each prime is idempotent — the same
// in-flight promise the hooks fire on mount.
primeLiveCatalog();
primeSiteContent();
primeStoreSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
