/**
 * Limited Partner (LP) TypeScript interfaces
 * Matches the backend LP model and API responses
 */

export interface LP {
  id: string;
  name: string;

  // Organization details
  type?: 'Individual' | 'Family Office' | 'Institution' | 'Corporate' | 'Foundation' | 'Government' | 'Other';
  description?: string;
  website?: string;

  // Contact information
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  location?: string; // City, Country

  // Investment details
  total_committed_capital_raw?: string; // e.g., "$50M"
  total_committed_capital?: number; // e.g., 50000000
  investment_focus?: string; // e.g., "Technology, Healthcare"
  first_investment_year?: number;

  // Relationship tracking
  relationship_status?: 'Active' | 'Prospective' | 'Inactive' | 'Former';
  tier?: 'Tier 1' | 'Tier 2' | 'Tier 3'; // Investment size tiers

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface LPSearchParams {
  search?: string;
  type?: string;
  location?: string;
  relationship_status?: string;
  tier?: string;
  min_commitment?: number;
  max_commitment?: number;
  min_investment_year?: number;
  max_investment_year?: number;
  sort_by?: 'name' | 'total_committed_capital' | 'first_investment_year' | 'created_at';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface LPListResponse {
  lps: LP[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LPStatistics {
  total_lps: number;
  total_committed_capital: number;
  avg_commitment: number;
  type_breakdown: Array<{
    type: string;
    count: number;
  }>;
  tier_breakdown: Array<{
    tier: string;
    count: number;
  }>;
  status_breakdown: Array<{
    status: string;
    count: number;
  }>;
}

export interface LPTypesResponse {
  types: string[];
}

// LP Types constants
export const LP_TYPES = [
  'Individual',
  'Family Office',
  'Institution',
  'Corporate',
  'Foundation',
  'Government',
  'Other'
] as const;

export const RELATIONSHIP_STATUSES = [
  'Active',
  'Prospective',
  'Inactive',
  'Former'
] as const;

export const TIERS = [
  'Tier 1',
  'Tier 2',
  'Tier 3'
] as const;

// Fund Commitment interface for LP investments
export interface FundCommitment {
  id: string;
  lp_id: string;
  fund_id: string;
  fund_name?: string; // Denormalized for display
  fund_strategy?: string; // Denormalized for display
  commitment_amount_raw?: string; // e.g., "$10M"
  commitment_amount?: number; // e.g., 10000000
  commitment_date?: string; // ISO date string
  capital_called?: number; // Amount of capital called to date
  capital_called_raw?: string; // Formatted display
  percent_called?: number; // Calculated: capital_called / commitment_amount * 100
  status?: 'Active' | 'Fully Called' | 'Cancelled';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// LP Holding interface for portfolio holdings
export interface LPHolding {
  id: string;
  fund_id?: string;
  fund_name: string;
  vintage?: number; // Fund vintage year

  // Capital flows
  capital_committed?: number;
  capital_committed_raw?: string;

  capital_contributed?: number;
  capital_contributed_raw?: string;

  capital_distributed?: number;
  capital_distributed_raw?: string;

  market_value?: number;
  market_value_raw?: string;

  // Performance
  inception_irr?: number; // Percentage

  // Optional LP linkage
  lp_id?: string;
  lp_name?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface LPHoldingsListResponse {
  holdings: LPHolding[];
  total: number;
  limit: number;
  offset: number;
}

export interface LPHoldingsStats {
  total_capital_committed: number;
  total_capital_contributed: number;
  total_capital_distributed: number;
  total_market_value: number;
  average_irr: number;
  count: number;
  by_vintage: Record<string, number>;
}

export interface LPHoldingsSearchParams {
  lp_id?: string;
  vintage?: number;
  min_value?: number;
  max_value?: number;
  search?: string;
  sort_by?: 'vintage' | 'fund_name' | 'market_value' | 'inception_irr' | 'capital_committed' | 'capital_contributed';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
