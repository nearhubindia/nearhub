INSERT INTO listing_attribute_values (
  listing_id,
  attribute_id,
  text_value,
  number_value,
  boolean_value,
  created_at,
  updated_at
)
SELECT
  l.id AS listing_id,
  a.id AS attribute_id,
  CASE
    WHEN jsonb_typeof(attr.value) = 'string' THEN attr.value #>> '{}'
    ELSE NULL
  END AS text_value,
  CASE
    WHEN jsonb_typeof(attr.value) = 'number' THEN (attr.value #>> '{}')::numeric
    ELSE NULL
  END AS number_value,
  CASE
    WHEN jsonb_typeof(attr.value) = 'boolean' THEN (attr.value #>> '{}')::boolean
    ELSE NULL
  END AS boolean_value,
  COALESCE(l.created_at, CURRENT_TIMESTAMP) AS created_at,
  COALESCE(l.updated_at, CURRENT_TIMESTAMP) AS updated_at
FROM listings l
JOIN master_listing_categories c
  ON c.name = COALESCE(
    NULLIF(btrim(l.main_category), ''),
    NULLIF(btrim(l.category), ''),
    NULLIF(btrim(l.sub_category), '')
  )
JOIN master_listing_subcategories s
  ON s.category_id = c.id
 AND s.name = COALESCE(NULLIF(btrim(l.sub_category), ''), NULLIF(btrim(l.category), ''))
JOIN master_listing_attributes a
  ON a.subcategory_id = s.id
JOIN LATERAL jsonb_each(l.attributes) AS attr(key, value)
  ON TRUE
WHERE l.attributes IS NOT NULL
  AND jsonb_typeof(l.attributes) = 'object'
  AND a.name = attr.key
  AND jsonb_typeof(attr.value) IN ('string', 'number', 'boolean')
ON CONFLICT (listing_id, attribute_id) DO UPDATE SET
  text_value = EXCLUDED.text_value,
  number_value = EXCLUDED.number_value,
  boolean_value = EXCLUDED.boolean_value,
  updated_at = CURRENT_TIMESTAMP;

ALTER TABLE listings DROP COLUMN IF EXISTS attributes;
