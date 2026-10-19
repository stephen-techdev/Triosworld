-- Product colours become { name, hex } pairs so the swatch a customer taps and
-- the colour filter in the shop are the colour the operator actually picked.
--
-- The admin dashboard accepted a comma-separated list of names and stored those
-- names alone; the storefront then hardcoded hex '#171717' for every variant.
-- Every swatch on the site rendered black and custom colours never made it into
-- the shop's colour filter, which is the bug this migration exists to repair.
--
-- The column is JSONB, so both shapes were always legal to store. Rows written
-- as bare names are converted here through a common-name lookup; anything the
-- lookup does not know falls back to ink, the same neutral the card used before.
-- Rows already stored as objects keep their hex when it is well-formed.

CREATE OR REPLACE FUNCTION public.color_hex_for(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(trim(p_name), ''))
    WHEN 'black'    THEN '#171717'
    WHEN 'white'    THEN '#ffffff'
    WHEN 'ivory'    THEN '#f7f5f0'
    WHEN 'off-white' THEN '#f7f5f0'
    WHEN 'cream'    THEN '#efe9dc'
    WHEN 'olive'    THEN '#5b5f3a'
    WHEN 'stone'    THEN '#ddd8ce'
    WHEN 'navy'     THEN '#1f2a44'
    WHEN 'lime'     THEN '#b7ff43'
    WHEN 'rust'     THEN '#9e4a2e'
    WHEN 'sage'     THEN '#9caf88'
    WHEN 'sand'     THEN '#d8c4a0'
    WHEN 'beige'    THEN '#d8c4a0'
    WHEN 'cobalt'   THEN '#2b4cb8'
    WHEN 'blue'     THEN '#2b4cb8'
    WHEN 'burgundy' THEN '#5e1f2a'
    WHEN 'maroon'   THEN '#5e1f2a'
    WHEN 'charcoal' THEN '#2d2d2d'
    WHEN 'grey'     THEN '#9a9a9a'
    WHEN 'gray'     THEN '#9a9a9a'
    WHEN 'red'      THEN '#a5281b'
    WHEN 'green'    THEN '#4a6741'
    WHEN 'yellow'   THEN '#e8c33c'
    ELSE '#171717'
  END;
$$;

UPDATE public.products
SET colors = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(e) = 'object'
         AND NULLIF(trim(coalesce(e ->> 'name', '')), '') IS NOT NULL
        THEN jsonb_build_object(
               'name', trim(e ->> 'name'),
               'hex', CASE
                        WHEN coalesce(e ->> 'hex', '') ~ '^#[0-9a-fA-F]{6}$'
                          THEN lower(e ->> 'hex')
                        ELSE public.color_hex_for(e ->> 'name')
                      END)
        WHEN jsonb_typeof(e) = 'string'
         AND NULLIF(trim(e #>> '{}'), '') IS NOT NULL
        THEN jsonb_build_object(
               'name', trim(e #>> '{}'),
               'hex', public.color_hex_for(e #>> '{}'))
        ELSE NULL
      END),
    '[]'::jsonb)
  FROM jsonb_array_elements(colors) AS e
)
WHERE jsonb_typeof(colors) = 'array';
