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
  category: string | null;
}

export interface DataPoint {
  year: number;
  value: number;
}

export interface ConvergenceResult {
  chaser: {
    country: string;
    iso: string;
    current_value: number;
    current_year: number;
  };
  target: {
    country: string;
    iso: string;
    current_value: number;
    current_year: number;
  };
  indicator: string;
  growth_rate: number;
  years_to_convergence: number;
  convergence_year: number | null;
  projection: Array<{
    year: number;
    chaser: number;
    target: number;
  }>;
}
