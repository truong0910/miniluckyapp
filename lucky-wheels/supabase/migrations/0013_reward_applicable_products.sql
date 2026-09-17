-- Migration 0013: Add applicable_products and discount_rate columns to reward_catalog and awards
ALTER TABLE public.reward_catalog
ADD COLUMN IF NOT EXISTS applicable_products text DEFAULT 'Tất cả sản phẩm Kính Hồng Phúc',
ADD COLUMN IF NOT EXISTS discount_rate text DEFAULT '100';

ALTER TABLE public.awards
ADD COLUMN IF NOT EXISTS applicable_products_snapshot text DEFAULT 'Tất cả sản phẩm Kính Hồng Phúc',
ADD COLUMN IF NOT EXISTS discount_rate_snapshot text DEFAULT '100';

-- Backfill award snapshots from catalog where missing
UPDATE public.awards a
SET 
  applicable_products_snapshot = COALESCE(NULLIF(rc.applicable_products, ''), 'Tất cả sản phẩm Kính Hồng Phúc'),
  discount_rate_snapshot = COALESCE(NULLIF(rc.discount_rate, ''), '100')
FROM public.reward_catalog rc
WHERE a.reward_id = rc.id;
