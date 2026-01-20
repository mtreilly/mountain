-- Convergence Explorer Database Schema
-- Run with: npx wrangler d1 execute convergence-db --local --file=./schema.sql

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iso_alpha3 TEXT NOT NULL UNIQUE,
    iso_alpha2 TEXT NOT NULL,
    name TEXT NOT NULL,
    region TEXT,
    income_group TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indicators catalog
CREATE TABLE IF NOT EXISTS indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    source TEXT,
    source_code TEXT,
    category TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Time-series data points
CREATE TABLE IF NOT EXISTS data_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    indicator_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    value REAL NOT NULL,
    is_projection INTEGER DEFAULT 0,
    source_vintage TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (indicator_id) REFERENCES indicators(id),
    UNIQUE(country_id, indicator_id, year)
);

CREATE INDEX IF NOT EXISTS idx_data_country ON data_points(country_id);
CREATE INDEX IF NOT EXISTS idx_data_indicator ON data_points(indicator_id);
CREATE INDEX IF NOT EXISTS idx_data_year ON data_points(year);
CREATE INDEX IF NOT EXISTS idx_data_lookup ON data_points(country_id, indicator_id, year);

-- Pre-computed growth rates
CREATE TABLE IF NOT EXISTS growth_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER NOT NULL,
    indicator_id INTEGER NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    rate REAL NOT NULL,
    rate_type TEXT NOT NULL,
    FOREIGN KEY (country_id) REFERENCES countries(id),
    FOREIGN KEY (indicator_id) REFERENCES indicators(id)
);

-- Seed core indicators
INSERT OR IGNORE INTO indicators (code, name, unit, source, source_code, category) VALUES
    ('GDP_PCAP_PPP', 'GDP per capita (PPP)', 'constant 2021 int$', 'World Bank', 'NY.GDP.PCAP.PP.KD', 'economic'),
    ('POPULATION', 'Total population', 'persons', 'World Bank', 'SP.POP.TOTL', 'demographic'),
    ('LIFE_EXPECT', 'Life expectancy at birth', 'years', 'World Bank', 'SP.DYN.LE00.IN', 'health'),
    ('HDI', 'Human Development Index', 'index 0-1', 'UNDP', NULL, 'composite'),
    ('LITERACY', 'Literacy rate (adult)', 'percent', 'World Bank', 'SE.ADT.LITR.ZS', 'education'),
    ('INTERNET', 'Internet users', 'percent of population', 'World Bank', 'IT.NET.USER.ZS', 'infrastructure'),
    ('CO2_PCAP', 'CO2 emissions per capita', 'metric tons', 'World Bank', 'EN.ATM.CO2E.PC', 'environment'),
    ('FERTILITY', 'Fertility rate', 'births per woman', 'World Bank', 'SP.DYN.TFRT.IN', 'demographic');

-- Seed sample countries (full list should be imported from World Bank)
INSERT OR IGNORE INTO countries (iso_alpha3, iso_alpha2, name, region, income_group) VALUES
    ('USA', 'US', 'United States', 'North America', 'High income'),
    ('GBR', 'GB', 'United Kingdom', 'Europe & Central Asia', 'High income'),
    ('IRL', 'IE', 'Ireland', 'Europe & Central Asia', 'High income'),
    ('DEU', 'DE', 'Germany', 'Europe & Central Asia', 'High income'),
    ('FRA', 'FR', 'France', 'Europe & Central Asia', 'High income'),
    ('CHN', 'CN', 'China', 'East Asia & Pacific', 'Upper middle income'),
    ('IND', 'IN', 'India', 'South Asia', 'Lower middle income'),
    ('NGA', 'NG', 'Nigeria', 'Sub-Saharan Africa', 'Lower middle income'),
    ('BRA', 'BR', 'Brazil', 'Latin America & Caribbean', 'Upper middle income'),
    ('ZAF', 'ZA', 'South Africa', 'Sub-Saharan Africa', 'Upper middle income'),
    ('KOR', 'KR', 'South Korea', 'East Asia & Pacific', 'High income'),
    ('JPN', 'JP', 'Japan', 'East Asia & Pacific', 'High income'),
    ('MEX', 'MX', 'Mexico', 'Latin America & Caribbean', 'Upper middle income'),
    ('IDN', 'ID', 'Indonesia', 'East Asia & Pacific', 'Upper middle income'),
    ('TUR', 'TR', 'Türkiye', 'Europe & Central Asia', 'Upper middle income');

-- Sample GDP per capita data (in constant 2021 international $)
-- Nigeria
INSERT OR IGNORE INTO data_points (country_id, indicator_id, year, value) VALUES
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2000, 3800),
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2005, 4500),
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2010, 5200),
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2015, 5800),
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2020, 4900),
    ((SELECT id FROM countries WHERE iso_alpha3='NGA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2023, 5200);

-- Ireland
INSERT OR IGNORE INTO data_points (country_id, indicator_id, year, value) VALUES
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2000, 38000),
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2005, 48000),
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2010, 48500),
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2015, 62000),
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2020, 85000),
    ((SELECT id FROM countries WHERE iso_alpha3='IRL'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2023, 89000);

-- China
INSERT OR IGNORE INTO data_points (country_id, indicator_id, year, value) VALUES
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2000, 3600),
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2005, 5400),
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2010, 9200),
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2015, 14200),
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2020, 17200),
    ((SELECT id FROM countries WHERE iso_alpha3='CHN'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2023, 21500);

-- USA
INSERT OR IGNORE INTO data_points (country_id, indicator_id, year, value) VALUES
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2000, 45000),
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2005, 50000),
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2010, 52000),
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2015, 57000),
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2020, 63000),
    ((SELECT id FROM countries WHERE iso_alpha3='USA'), (SELECT id FROM indicators WHERE code='GDP_PCAP_PPP'), 2023, 76000);
