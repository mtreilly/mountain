# Database Schema

Cloudflare D1 (SQLite) schema for Convergence Explorer.

## Tables

### countries

Stores country metadata and ISO codes.

```sql
CREATE TABLE countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iso_alpha3 TEXT NOT NULL UNIQUE,     -- e.g., 'USA', 'NGA', 'IRL'
    iso_alpha2 TEXT NOT NULL,             -- e.g., 'US', 'NG', 'IE'
    name TEXT NOT NULL,                   -- e.g., 'United States'
    region TEXT,                          -- e.g., 'North America'
    income_group TEXT,                    -- e.g., 'High income'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### indicators

Catalog of available indicators.

```sql
CREATE TABLE indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,            -- e.g., 'GDP_PCAP_PPP'
    name TEXT NOT NULL,                   -- e.g., 'GDP per capita (PPP)'
    description TEXT,
    unit TEXT,                            -- e.g., 'constant 2021 int$'
    source TEXT,                          -- e.g., 'World Bank'
    source_code TEXT,                     -- Original source code, e.g., 'NY.GDP.PCAP.PP.KD'
    category TEXT,                        -- e.g., 'economic', 'demographic'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### data_points

Time-series data for each country-indicator pair.

```sql
CREATE TABLE data_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    indicator_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    value REAL NOT NULL,
    is_projection INTEGER DEFAULT 0,      -- 0 = historical, 1 = projected
    source_vintage TEXT,                  -- When this data was fetched
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (indicator_id) REFERENCES indicators(id),
    UNIQUE(country_id, indicator_id, year)
);

CREATE INDEX idx_data_country ON data_points(country_id);
CREATE INDEX idx_data_indicator ON data_points(indicator_id);
CREATE INDEX idx_data_year ON data_points(year);
```

### growth_rates

Pre-computed growth rates for quick convergence calculations.

```sql
CREATE TABLE growth_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    indicator_id INTEGER NOT NULL,
    period_start INTEGER NOT NULL,        -- e.g., 2000
    period_end INTEGER NOT NULL,          -- e.g., 2020
    rate REAL NOT NULL,                   -- Annual growth rate (decimal)
    rate_type TEXT NOT NULL,              -- 'average', 'cagr', 'best_decade'
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (indicator_id) REFERENCES indicators(id)
);
```

## Seed Data

### Core Indicators

| code | name | source_code | category |
|------|------|-------------|----------|
| GDP_PCAP_PPP | GDP per capita (PPP) | NY.GDP.PCAP.PP.KD | economic |
| POPULATION | Total population | SP.POP.TOTL | demographic |
| LIFE_EXPECT | Life expectancy | SP.DYN.LE00.IN | health |
| HDI | Human Development Index | — | composite |
| LITERACY | Literacy rate | SE.ADT.LITR.ZS | education |
| INTERNET | Internet users (%) | IT.NET.USER.ZS | infrastructure |

## Queries

### Get convergence data for two countries

```sql
SELECT
    c.name as country,
    d.year,
    d.value
FROM data_points d
JOIN countries c ON d.country_id = c.id
JOIN indicators i ON d.indicator_id = i.id
WHERE c.iso_alpha3 IN ('NGA', 'IRL')
  AND i.code = 'GDP_PCAP_PPP'
ORDER BY c.iso_alpha3, d.year;
```

### Get latest value per country for an indicator

```sql
SELECT
    c.iso_alpha3,
    c.name,
    d.value,
    d.year
FROM data_points d
JOIN countries c ON d.country_id = c.id
JOIN indicators i ON d.indicator_id = i.id
WHERE i.code = 'GDP_PCAP_PPP'
  AND d.year = (
      SELECT MAX(year)
      FROM data_points d2
      WHERE d2.country_id = d.country_id
        AND d2.indicator_id = d.indicator_id
        AND d2.is_projection = 0
  )
ORDER BY d.value DESC;
```

### Calculate years to convergence

```sql
-- Given:
-- chaser_value: current GDP of chaser country
-- target_value: current GDP of target country
-- growth_rate: assumed annual growth rate (decimal)

-- Formula: years = ln(target/chaser) / ln(1 + growth_rate)

SELECT
    ROUND(LOG(target.value / chaser.value) / LOG(1 + 0.032), 1) as years_to_convergence
FROM
    (SELECT value FROM data_points WHERE country_id = 1 AND indicator_id = 1 ORDER BY year DESC LIMIT 1) as chaser,
    (SELECT value FROM data_points WHERE country_id = 2 AND indicator_id = 1 ORDER BY year DESC LIMIT 1) as target;
```
