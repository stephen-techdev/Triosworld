-- Let the dashboard own every field a product card shows.
--
-- Runtime products were being rendered with invented values: fit "Regular",
-- fabric "Cotton", badge "New", a fixed care line and newArrival always true.
-- Those duplicates looked like real data but were not editable and did not match
-- the product. Each is now a real column the operator fills in, and the
-- storefront shows an empty field as empty rather than guessing.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS care         text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fit          text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fabric       text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badge        text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bestseller   boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS new_arrival  boolean NOT NULL DEFAULT false;

-- Constrain the free-text fields to the values the storefront already knows how
-- to render, so a typo cannot produce an unstyled card.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fit_check;
ALTER TABLE public.products ADD CONSTRAINT products_fit_check
  CHECK (fit IS NULL OR fit IN ('Regular', 'Oversized', 'Relaxed', 'Slim'));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fabric_check;
ALTER TABLE public.products ADD CONSTRAINT products_fabric_check
  CHECK (fabric IS NULL OR fabric IN ('Cotton', 'Cotton Blend', 'Heavyweight Cotton', 'French Terry'));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_badge_check;
ALTER TABLE public.products ADD CONSTRAINT products_badge_check
  CHECK (badge IS NULL OR badge IN ('Bestseller', 'New', 'Limited', 'Essential', 'Street', 'Graphic'));