-- Let the operator write their own fit, fabric, badge and collection.
--
-- These four fields were constrained to a fixed list:
--
--   fit     IN ('Regular','Oversized','Relaxed','Slim')
--   fabric  IN ('Cotton','Cotton Blend','Heavyweight Cotton','French Terry')
--   badge   IN ('Bestseller','New','Limited','Essential','Street','Graphic')
--   category had no constraint but the form was a <select> over CATEGORIES
--
-- so a shop that stocks a "Boxy" fit, a "Linen Blend" fabric or a "Sold Out"
-- badge could not record it. The dropdown offered the right answer for a
-- T-shirt label and the wrong answer for everything else.
--
-- The constraints are dropped so the operator's own wording is what is stored.
-- The storefront already renders these as plain text and hides a field that is
-- unset, so an unexpected value needs no new styling.

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fit_check;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fabric_check;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_badge_check;

-- Replace the CHECKs with a length cap, so a pasted paragraph cannot blow up a
-- card header or a filter chip.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fit_len;
ALTER TABLE public.products ADD CONSTRAINT products_fit_len
  CHECK (fit IS NULL OR char_length(fit) <= 40);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fabric_len;
ALTER TABLE public.products ADD CONSTRAINT products_fabric_len
  CHECK (fabric IS NULL OR char_length(fabric) <= 40);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_badge_len;
ALTER TABLE public.products ADD CONSTRAINT products_badge_len
  CHECK (badge IS NULL OR char_length(badge) <= 24);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_len;
ALTER TABLE public.products ADD CONSTRAINT products_category_len
  CHECK (category IS NULL OR char_length(category) <= 40);
