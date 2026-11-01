import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { scheduleIdlePrefetch } from '@/lib/routePrefetch';

// The eager Supabase reads moved to ./bootFetch.ts, a tiny entry module listed
// before this one in index.html — it fires the products + store_settings
// fetches while the main bundle is still downloading, and the storefront libs
// race its result with a short gate. No prime calls are needed here: boot and
// the hooks' own fetches share the same module caches.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// After first paint, quietly fetch every storefront route's small JS chunk so
// the first tap on any page is instant (module-cache hit, no spinner). Skips
// save-data/2G connections and automation so it never costs mobile data in
// vain or disturbs lab measurements. See src/lib/routePrefetch.ts.
scheduleIdlePrefetch();
