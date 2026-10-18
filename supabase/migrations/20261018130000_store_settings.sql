-- Store-wide settings the operator owns, so nothing about a card or the basket
-- is hardcoded in the frontend.
--
-- Until now shipping was three literals in the bundle: a flat ₹79 and a ₹1499
-- free-shipping threshold, repeated across the announcement bar, cart drawer,
-- checkout, homepage, product page and the shipping FAQ. Changing them meant a
-- code edit and a deploy, and they could drift out of step with each other.
--
-- This table holds the values instead. The storefront reads them through the
-- same public SELECT policy as products; only the admin edge function (service
-- role) writes.

CREATE TABLE IF NOT EXISTS public.store_settings (
  id                      boolean PRIMARY KEY DEFAULT true CHECK (id),
  shipping_fee            integer NOT NULL DEFAULT 79  CHECK (shipping_fee >= 0),
  free_shipping_threshold integer NOT NULL DEFAULT 1499 CHECK (free_shipping_threshold >= 0),
  -- A threshold of 0 means every order ships free.
  announcement            text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              text
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Readable by the storefront so the cart and checkout show the operator's real
-- numbers. No write policies: the admin edge function is the only writer.
DROP POLICY IF EXISTS "read_store_settings" ON public.store_settings;
CREATE POLICY "read_store_settings" ON public.store_settings FOR SELECT
  TO anon, authenticated USING (true);

-- Exactly one row, enforced so a second insert cannot fork the values.
DROP TRIGGER IF EXISTS store_settings_singleton ON public.store_settings;
CREATE OR REPLACE FUNCTION public.store_settings_singleton_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM public.store_settings) > 1 THEN
    RAISE EXCEPTION 'store_settings holds a single row; update it instead of inserting'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER store_settings_singleton
AFTER INSERT OR UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.store_settings_singleton_guard();

-- Seed the row the storefront falls back to, so a fresh database is never empty.
INSERT INTO public.store_settings (id, shipping_fee, free_shipping_threshold)
VALUES (true, 79, 1499)
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at honest without the caller having to remember it.
CREATE OR REPLACE FUNCTION public.touch_store_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_settings_touch ON public.store_settings;
CREATE TRIGGER store_settings_touch
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_store_settings();
