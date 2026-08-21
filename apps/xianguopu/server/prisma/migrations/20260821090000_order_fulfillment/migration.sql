-- Keep fulfillment requirements queryable instead of mixing them into customer remarks.
ALTER TABLE "Order"
ADD COLUMN "isGift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deliverySlot" TEXT;

-- Preserve gift and delivery information already saved by previous client versions.
-- Only remove exact legacy system-generated segments; customer-written notes remain.
UPDATE "Order" AS existing_order
SET
    "isGift" = EXISTS (
        SELECT 1
        FROM regexp_split_to_table(COALESCE(existing_order."remark", ''), '[；;]') AS segments(segment)
        WHERE btrim(segment) = '礼赠包装'
    ),
    "deliverySlot" = (
        SELECT btrim(regexp_replace(btrim(segment), '^期望配送[：:]', ''))
        FROM regexp_split_to_table(COALESCE(existing_order."remark", ''), '[；;]') AS segments(segment)
        WHERE btrim(segment) ~ '^期望配送[：:]'
        LIMIT 1
    ),
    "remark" = (
        SELECT NULLIF(string_agg(btrim(segment), '；' ORDER BY position), '')
        FROM regexp_split_to_table(COALESCE(existing_order."remark", ''), '[；;]')
            WITH ORDINALITY AS segments(segment, position)
        WHERE btrim(segment) <> ''
          AND btrim(segment) <> '礼赠包装'
          AND btrim(segment) !~ '^期望配送[：:]'
    )
WHERE existing_order."remark" LIKE '%礼赠包装%'
   OR existing_order."remark" LIKE '%期望配送%';
