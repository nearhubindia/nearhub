-- Update Basic plan to have 0 featured listings
UPDATE subscription_tiers 
SET featured_listings_per_month = 0 
WHERE LOWER(name) LIKE '%basic%';

-- Show updated tiers
SELECT id, name, max_listings, featured_listings_per_month 
FROM subscription_tiers 
ORDER BY price;
