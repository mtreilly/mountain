# API Endpoints

Cloudflare Pages Functions serving D1 data.

## Base URL

- Local: `http://localhost:8788/api`
- Production: `https://mountain.pages.dev/api`

## Endpoints

### GET /api/countries

List all countries.

**Response:**
```json
{
  "data": [
    {
      "iso_alpha3": "USA",
      "name": "United States",
      "region": "North America",
      "income_group": "High income"
    }
  ]
}
```

### GET /api/indicators

List all available indicators.

**Response:**
```json
{
  "data": [
    {
      "code": "GDP_PCAP_PPP",
      "name": "GDP per capita (PPP)",
      "unit": "constant 2021 int$",
      "category": "economic"
    }
  ]
}
```

### GET /api/data/:indicator

Get time-series data for an indicator.

**Query params:**
- `countries` (required): Comma-separated ISO alpha-3 codes
- `start_year` (optional): Default 1960
- `end_year` (optional): Default current year

**Example:**
```
GET /api/data/GDP_PCAP_PPP?countries=NGA,IRL&start_year=1990
```

**Response:**
```json
{
  "indicator": {
    "code": "GDP_PCAP_PPP",
    "name": "GDP per capita (PPP)",
    "unit": "constant 2021 int$"
  },
  "data": {
    "NGA": [
      { "year": 1990, "value": 3200 },
      { "year": 1991, "value": 3150 }
    ],
    "IRL": [
      { "year": 1990, "value": 18500 },
      { "year": 1991, "value": 19200 }
    ]
  }
}
```

### GET /api/convergence

Calculate convergence timeline.

**Query params:**
- `chaser` (required): ISO alpha-3 code of chaser country
- `target` (required): ISO alpha-3 code of target country
- `indicator` (required): Indicator code
- `growth_rate` (optional): Custom growth rate (decimal). If omitted, uses historical average.

**Example:**
```
GET /api/convergence?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&growth_rate=0.05
```

**Response:**
```json
{
  "chaser": {
    "country": "Nigeria",
    "current_value": 5200,
    "current_year": 2023
  },
  "target": {
    "country": "Ireland",
    "current_value": 89000,
    "current_year": 2023
  },
  "indicator": "GDP_PCAP_PPP",
  "growth_rate": 0.05,
  "years_to_convergence": 58,
  "convergence_year": 2081,
  "projection": [
    { "year": 2023, "chaser": 5200, "target": 89000 },
    { "year": 2030, "chaser": 7318, "target": 89000 },
    { "year": 2040, "chaser": 11922, "target": 89000 }
  ]
}
```

### GET /api/growth-rates/:country/:indicator

Get historical growth rates for a country-indicator pair.

**Response:**
```json
{
  "country": "Nigeria",
  "indicator": "GDP_PCAP_PPP",
  "rates": {
    "historical_average": 0.018,
    "last_10_years": 0.012,
    "last_20_years": 0.025,
    "best_decade": { "period": "2000-2010", "rate": 0.045 }
  }
}
```

## Error Responses

```json
{
  "error": {
    "code": "COUNTRY_NOT_FOUND",
    "message": "Country with ISO code 'XYZ' not found"
  }
}
```

## Rate Limiting

- 100 requests per minute per IP
- Responses include `X-RateLimit-Remaining` header
