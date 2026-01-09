/**
 * Fund-related TypeScript interfaces
 * Matches the backend Fund model and API responses
 */

export interface Fund {
  id: string;
  name: string;
  description?: string;
  founded_year?: number;
  aum_raw?: string;  // e.g., "$500M"
  aum?: number;  // Parsed float, e.g., 500000000
  strategy?: string;  // e.g., "Growth Equity", "Venture Capital", "Private Equity"
  website?: string;
  headquarters?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FundSearchParams {
  search?: string;
  strategy?: string;
  min_aum?: number;
  max_aum?: number;
  headquarters?: string;
  min_founded_year?: number;
  max_founded_year?: number;
  sort_by?: 'name' | 'aum' | 'founded_year' | 'created_at';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface FundListResponse {
  funds: Fund[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FundMetadata {
  strategies: string[];
}

export interface FundStatistics {
  total_funds: number;
  funds_with_aum: number;
  avg_aum: number;
  avg_founded_year: number | null;
  strategy_breakdown: Array<{
    strategy: string;
    count: number;
  }>;
}

// Portfolio Company types
export interface PortfolioCompany {
  id: string;
  fund_id: string;
  fund_name?: string;
  name: string;
  sector?: string;
  stage?: string;
  location?: string;
  description?: string;
  website?: string;
  logo_url?: string;
  investment_date?: string;
  valuation_raw?: string;
  valuation?: number;
  status?: 'Active' | 'Exited' | 'IPO';
  created_at: string;
  updated_at: string;
}

export interface PortfolioCompanyListResponse {
  companies: PortfolioCompany[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
