-- Decrement the stock for one sold line.
--
-- Called by the trios-pay edge function only after an order transitions to
-- paid, so the storefront reflects what has actually been sold. The product
-- row is locked for the duration of the transaction, which keeps two
-- simultaneous settlements from both reading the same count.
--
-- Only the service role may execute this; it is not a customer-callable RPC.

create or replace function public.decrement_variant_stock(
  p_product_id text,
  p_color text,
  p_size text,
  p_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty integer := greatest(0, coalesce(p_qty, 0));
  v_colors jsonb;
  v_has_color_stock boolean := false;
  v_remaining integer := 0;
begin
  if v_qty = 0 then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  select coalesce(colors, '[]'::jsonb)
    into v_colors
    from products
   where id = p_product_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_not_found');
  end if;

  if jsonb_typeof(v_colors) = 'array' then
    select exists (
      select 1
        from jsonb_array_elements(v_colors) as c
       where c->>'name' = p_color
         and jsonb_typeof(c->'sizes') = 'object'
    ) into v_has_color_stock;
  end if;

  if v_has_color_stock then
    -- The colour carries its own per-size map: that is the authoritative one.
    update products p
       set colors = (
         select jsonb_agg(
                  case
                    when c->>'name' = p_color
                     and jsonb_typeof(c->'sizes') = 'object'
                    then jsonb_set(
                           c,
                           array['sizes', p_size],
                           to_jsonb(greatest(
                             0,
                             coalesce((c->'sizes'->>p_size)::int, 0) - v_qty
                           )),
                           true
                         )
                    else c
                  end
                  order by ord
                )
           from jsonb_array_elements(p.colors) with ordinality as t(c, ord)
       )
     where p.id = p_product_id;

    select coalesce((c->'sizes'->>p_size)::int, 0)
      into v_remaining
      from products p,
           jsonb_array_elements(p.colors) as c
     where p.id = p_product_id
       and c->>'name' = p_color
     limit 1;
  else
    -- Older products only have a product-wide size map; decrement that.
    update products
       set stock = jsonb_set(
             coalesce(stock, '{}'::jsonb),
             array[p_size],
             to_jsonb(greatest(
               0,
               coalesce((stock->>p_size)::int, 0) - v_qty
             )),
             true
           )
     where id = p_product_id;

    select coalesce((stock->>p_size)::int, 0)
      into v_remaining
      from products
     where id = p_product_id;
  end if;

  return jsonb_build_object('ok', true, 'changed', true, 'remaining', v_remaining);
end;
$$;

revoke all on function public.decrement_variant_stock(text, text, text, integer) from public;
revoke all on function public.decrement_variant_stock(text, text, text, integer) from anon, authenticated;
grant execute on function public.decrement_variant_stock(text, text, text, integer) to service_role;
