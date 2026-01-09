/**
 * Types for Secondary Funds Database (Preqin data)
 */

export interface SecondaryFund {
  id: number;
  fund_name: string;
  gp_id: number | null;
  fund_manager_name: string | null;
  status: string | null;
  vintage_year: number | null;
  fund_close_year: number | null;
  launch_year: number | null;
  fund_size_raw: string | null;
  fund_size_usd: number | null;
  target_size_raw: string | null;
  target_size_usd: number | null;
  dpi: number | null;
  tvpi: number | null;
  irr: number | null;
  strategies: string[];
  sectors: string[];
  data_source: string | null;
  last_reporting_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecondaryGP {
  id: number;
  institution_name: string;
  city: string | null;
  country: string | null;
  institution_type: string | null;
  aum_usd: number | null;
  aum_raw: string | null;
  fund_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SecondaryLP {
  id: number;
  institution_name: string;
  city: string | null;
  country: string | null;
  institution_type: string | null;
  aum_usd: number | null;
  aum_raw: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecondaryFundListResponse {
  items: SecondaryFund[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SecondaryGPListResponse {
  items: SecondaryGP[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SecondaryLPListResponse {
  items: SecondaryLP[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SecondaryStats {
  total_funds: number;
  total_gps: number;
  total_lps: number;
  total_aum_gps: number | null;
  total_aum_lps: number | null;
  funds_by_status: Record<string, number>;
  funds_by_strategy: Record<string, number>;
  funds_by_sector: Record<string, number>;
  avg_fund_size: number | null;
  avg_irr: number | null;
  avg_tvpi: number | null;
}

export interface NLQResponse {
  question: string;
  sql: string;
  results: Record<string, unknown>[];
  execution_time: number;
  error: string | null;
}

export interface MetaOption {
  code: string;
  name: string;
}

// Filter types
export type FundStatusFilter = 'CLOSED' | 'CLOSED_ENDED_IN_MARKET' | 'OPEN_ENDED_IN_MARKET';
export type StrategyFilter = 'LP_STAKES' | 'GP_LED' | 'DIRECT_SECONDARIES' | 'PREFERRED_EQUITY';
export type SectorFilter = 'PRIVATE_EQUITY' | 'VENTURE_CAPITAL' | 'REAL_ESTATE' | 'INFRASTRUCTURE' | 'PRIVATE_DEBT' | 'AGRICULTURE';
