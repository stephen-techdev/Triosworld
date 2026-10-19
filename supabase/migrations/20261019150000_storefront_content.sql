-- Everything the storefront says and shows outside of the products themselves
-- becomes operator-owned content instead of literals in the React bundle.
--
-- Until now the hero headline, the ticker lines, the category cards, every
-- section heading, the editorial and story copy, the benefit tiles, the product
-- page size guide and reviews, the footer columns and contact details, the
-- newsletter blurb and the whole of the static pages (about, shipping, returns,
-- privacy, terms, contact, FAQs) were written in code. Changing a single word
-- meant a code edit and a redeploy, and two of those literals already disagreed
-- with the database: the footer advertised a phone number the operator had no
-- way to change, and the announcement bar carried a promo code that was never
-- configured anywhere.
--
-- They now live in `store_settings.content` as one JSONB document, fetched with
-- the same public SELECT policy the shipping figures already use. Only the
-- admin edge function (service role) writes, exactly as before.
--
-- NULL means "never edited": the storefront then renders the defaults compiled
-- into src/lib/siteContent.ts, which are the current copy verbatim. A database
-- that has not been populated therefore looks identical to the deployed site.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS content jsonb;

COMMENT ON COLUMN public.store_settings.content IS
  'Operator-owned storefront copy: hero, ticker, categories, section headings, '
  'editorial/story blocks, benefits, product-page size guide and reviews, '
  'footer, newsletter and static pages. NULL renders the code defaults.';
