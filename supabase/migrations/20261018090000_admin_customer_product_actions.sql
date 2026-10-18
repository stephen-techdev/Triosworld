-- Admin customer actions + runtime products.
--
-- 1. Customer moderation: mute (block sign-in, keep the data) and soft-delete.
--    Orders keep their own copy of name/mobile/address, so order history and
--    revenue reporting survive a deletion intact.
-- 2. A `products` table for items created from the admin dashboard. The 12
--    catalog products still live in src/data/catalog.ts; these are additions
--    that exist only in the database.
-- 3. `product_overrides.deleted_at` so a catalog product can be retired without
--    deleting the row that holds its price and stock edits.

-- ─────────────────────────────── customers ───────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_muted    boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS muted_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS muted_at     timestamptz;

-- Soft delete. Kept rather than hard so past orders still resolve a customer.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

CREATE INDEX IF NOT EXISTS profiles_is_muted_idx  ON public.profiles (is_muted)  WHERE is_muted;
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────── products ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  price       integer NOT NULL CHECK (price >= 0),
  mrp         integer CHECK (mrp IS NULL OR mrp >= 0),
  category    text NOT NULL DEFAULT 'new-arrivals',
  colors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock       jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Readable by the storefront so admin-created products actually appear.
DROP POLICY IF EXISTS "read_products" ON public.products;
CREATE POLICY "read_products" ON public.products FOR SELECT
TO anon, authenticated USING (is_active);
-- No INSERT/UPDATE/DELETE policies: only the admin edge function (service role)
-- writes this table.

-- Retire a catalog product (soft) — keeps its price/stock overrides.
ALTER TABLE public.product_overrides ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Reject duplicate slugs so the storefront never shows two identical cards.
CREATE OR REPLACE FUNCTION public.reject_duplicate_product_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products p WHERE p.slug = NEW.slug AND p.id <> NEW.id) THEN
    RAISE EXCEPTION 'A product with the slug "%" already exists', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_unique_slug ON public.products;
CREATE TRIGGER products_unique_slug
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.reject_duplicate_product_slug();

-- ──────────────────────────────── audits ──────────────────────────────────
-- Append-only trail of every moderation and product action.
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
-- RLS on with no policies: written by the service role, never readable from a browser.