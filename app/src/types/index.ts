export interface Country {
  iso_alpha3: string;
  iso_alpha2: string;
  name: string;
  region: string | null;
  income_group: string | null;
}

export interface Indicator {
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  source: string | null;
  source_code?: string | null;
  category: string | null;
}
