import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') as Record<string, string>;
  const sbUrl = String(env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const sbKey = String(env.VITE_SUPABASE_ANON_KEY ?? '');

  return {
    plugins: [
      react(),
      {
        name: 'tw-boot-fetch',
        /**
         * Emits an ES5 `dist/boot.js` — a classic script index.html loads in
         * <head>, which evaluates at document parse time, BEFORE the ~170KB
         * module bundle has even downloaded, and starts the two Supabase reads
         * ("+" is the shop grid's critical path) so they parallelise with the
         * bundle transfer. The storefront libs consume it through
         * src/lib/bootGate.ts and each keep their own supabase-js query as a
         * fallback, so a stale or failed boot can only ever be "no earlier",
         * never wrong. The anon key is public by design and already ships
         * inline in the bundle; it is injected here from the same VITE_ env.
         */
        generateBundle() {
          if (!sbUrl || !sbKey) return; // no key, no boot cache
          const productsSelect = 'id,slug,name,description,care,fit,fabric,badge,price,mrp,category,colors,stock,images,is_active,bestseller,new_arrival,created_at';
          const settingsSelect = 'content,shipping_fee,free_shipping_threshold,announcement';
          const encoding = (s: string) => encodeURIComponent(s);
          const bootJs = `/* Generated at build time by vite.config.ts (tw-boot-fetch) — do not edit by hand.
 * Fires the two Supabase reads the shop grid waits on, in parallel with the
 * main bundle download. Consumers: src/lib/bootGate.ts + the storefront libs. */
(function () {
  var SB = ${JSON.stringify(sbUrl)}, K = ${JSON.stringify(sbKey)};
  var h = { apikey: K, Authorization: 'Bearer ' + K, Accept: 'application/json' };
  var b = window.__twBoot = { done: false, ok: false, promise: null };
  var pUrl = SB + '/rest/v1/products?select=' + ${JSON.stringify(encoding(productsSelect))} + '&is_active=eq.true&order=' + ${JSON.stringify(encoding('created_at.desc'))};
  var sUrl = SB + '/rest/v1/store_settings?select=' + ${JSON.stringify(encoding(settingsSelect))};
  b.promise = Promise.all([
    fetch(pUrl, { headers: h }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; }),
    fetch(sUrl, { headers: h }).then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
  ]).then(function (rs) {
    b.products = rs[0]; b.storeRow = rs[1]; b.ok = rs[0] !== null || rs[1] !== null;
    /* Preload the first four card thumbnails: on the shop front door the LCP
       is one of the first four card images (the first two grid rows on
       mobile), and without this they wait for the bundle to parse and React
       to paint before the request even starts. Same thumbnail URL mapping as
       src/lib imgUrl.productThumb; only on shop pages, so other routes never
       download images they will not show. */
    try {
      var path = (location.pathname || '');
      var isShop = path === '/' || path.indexOf('/shop') === 0;
      if (isShop && rs[0] && rs[0][0] && rs[0][0].images && rs[0][0].images[0]) {
        var feeds = rs[0].slice(0, 4);
        for (var i = 0; i < feeds.length && feeds[i].images && feeds[i].images[0]; i++) {
          var u = String(feeds[i].images[0]).replace('/storage/v1/object/public/product-images/', '/storage/v1/object/public/product-images-opt/').replace(/\\.(jpe?g|png|webp)(\\?.*)?$/i, '.webp');
          if (u.indexOf('/product-images-opt/') === -1) continue;
          var l = document.createElement('link');
          l.rel = 'preload'; l.as = 'image'; l.href = u;
          /* The DOM property is fetchPriority — the all-lowercase form is a
             no-op, so the hint must go on as an attribute to reach the
             request (Lighthouse flags a priority-less preload as false). */
          l.setAttribute('fetchpriority', 'high');
          document.head.appendChild(l);
        }
      }
    } catch (e) {}
  }).catch(function () {}).then(function () { b.done = true; });
})();
`;
          this.emitFile({ type: 'asset', fileName: 'boot.js', source: bootJs });
        },
      } as PluginOption,
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      sourcemap: 'hidden',
    },
  };
});
