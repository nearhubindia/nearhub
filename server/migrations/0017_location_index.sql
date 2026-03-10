CREATE TABLE IF NOT EXISTS location_index (
  pincode VARCHAR(6) PRIMARY KEY,
  location_name VARCHAR(180) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  district VARCHAR(120) NOT NULL DEFAULT '',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  region VARCHAR(120) NOT NULL DEFAULT '',
  search_text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_index_city ON location_index (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_location_index_state ON location_index (LOWER(state));
CREATE INDEX IF NOT EXISTS idx_location_index_district ON location_index (LOWER(district));
CREATE INDEX IF NOT EXISTS idx_location_index_location_name ON location_index (LOWER(location_name));
CREATE INDEX IF NOT EXISTS idx_location_index_search_text ON location_index (LOWER(search_text));
