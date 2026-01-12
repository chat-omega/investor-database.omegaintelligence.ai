/**
 * Types for Preqin Data Layer
 */

// =============================================================================
// Enums
// =============================================================================

export type FirmType = 'GP' | 'LP' | 'BOTH';
export type EntityType = 'firm' | 'fund' | 'deal' | 'company' | 'person';

// =============================================================================
// Core Entities
// =============================================================================

export interface PreqinFirm {
  id: string;
  source_system: string;
  source_id?: string;
  preqin_id?: string;
  name: string;
  name_normalized?: string;
  firm_type?: FirmType;
  institution_type?: string;
  headquarters_city?: string;
  headquarters_country?: string;
  headquarters_region?: string;
  aum_usd?: number;
  aum_raw?: string;
  dry_powder_usd?: number;
  website?: string;
  description?: string;
  year_founded?: number;
  is_listed?: boolean;
  ticker?: string;
  created_at: string;
  updated_at: string;
  // Computed
  fund_count?: number;
  contact_count?: number;
  deal_count?: number;
}

export interface PreqinFund {
  id: string;
  source_system: string;
  source_id?: string;
  preqin_id?: string;
  name: string;
  name_normalized?: string;
  vintage_year?: number;
  fund_size_usd?: number;
  fund_size_raw?: string;
  target_size_usd?: number;
  currency?: string;
  strategy?: string;
  sub_strategy?: string;
  status?: string;
  domicile_country?: string;
  geography_focus?: string;
  sector_focus?: string;
  irr?: number;
  tvpi?: number;
  dpi?: number;
  first_close_date?: string;
  final_close_date?: string;
  managing_firm_id?: string;
  managing_firm_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PreqinDeal {
  id: string;
  source_system: string;
  source_id?: string;
  preqin_id?: string;
  deal_type?: string;
  deal_date?: string;
  deal_value_usd?: number;
  deal_value_raw?: string;
  stage?: string;
  deal_status?: string;
  primary_industry?: string;
  secondary_industry?: string;
  country?: string;
  region?: string;
  target_company_id?: string;
  target_company_name?: string;
  announced_date?: string;
  closed_date?: string;
  investor_firms?: string[];
  investor_funds?: string[];
  created_at: string;
  updated_at: string;
}

export interface PreqinCompany {
  id: string;
  source_system: string;
  source_id?: string;
  preqin_id?: string;
  name: string;
  name_normalized?: string;
  website?: string;
  description?: string;
  city?: string;
  country?: string;
  region?: string;
  primary_industry?: string;
  secondary_industry?: string;
  status?: string;
  deal_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PreqinPerson {
  id: string;
  source_system: string;
  source_id?: string;
  preqin_id?: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  title?: string;
  seniority_level?: string;
  location_city?: string;
  location_country?: string;
  current_firm_id?: string;
  current_firm_name?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Co-Investment Types
// =============================================================================

export interface CoInvestorSummary {
  firm_id: string;
  firm_name: string;
  firm_type?: string;
  deal_count: number;
  total_value_usd?: number;
  first_deal_date?: string;
  last_deal_date?: string;
}

export interface CoInvestmentNetworkResponse {
  firm_id: string;
  firm_name: string;
  co_investors: CoInvestorSummary[];
  total_co_investors: number;
}

export interface CoInvestmentDrilldown {
  firm_a_id: string;
  firm_a_name: string;
  firm_b_id: string;
  firm_b_name: string;
  deals: DealSummary[];
  total_deals: number;
  total_value_usd?: number;
}

export interface DealSummary {
  id: string;
  deal_type?: string;
  deal_date?: string;
  deal_value_usd?: number;
  target_company_name?: string;
}

// Network graph data for visualization
export interface NetworkGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface NetworkNode {
  id: string;
  name: string;
  firm_type?: string;
  aum_usd?: number;
  hop_level: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  deal_count: number;
  total_value_usd?: number;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SearchFilters {
  min_aum?: number;
  max_aum?: number;
  country?: string;
  countries?: string[];
  firm_type?: string;
  strategy?: string;
  vintage_year_min?: number;
  vintage_year_max?: number;
  industry?: string;
  deal_type?: string;
}

export interface SearchRequest {
  query: string;
  entity_types?: EntityType[];
  filters?: SearchFilters;
  limit?: number;
  use_semantic?: boolean;
}

export interface SearchResult {
  entity_type: EntityType;
  entity_id: string;
  score: number;
  title: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  search_type: 'hybrid' | 'fts_only' | 'semantic_only';
}

// =============================================================================
// Statistics
// =============================================================================

export interface PreqinStats {
  total_firms: number;
  total_gps: number;
  total_lps: number;
  total_funds: number;
  total_deals: number;
  total_persons: number;
  total_companies: number;
  total_aum_usd?: number;
  deals_by_year?: Record<number, number>;
  funds_by_strategy?: Record<string, number>;
  firms_by_country?: Record<string, number>;
}

// =============================================================================
// Paginated Responses
// =============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type PreqinFirmListResponse = PaginatedResponse<PreqinFirm>;
export type PreqinFundListResponse = PaginatedResponse<PreqinFund>;
export type PreqinDealListResponse = PaginatedResponse<PreqinDeal>;
export type PreqinCompanyListResponse = PaginatedResponse<PreqinCompany>;
export type PreqinPersonListResponse = PaginatedResponse<PreqinPerson>;

// =============================================================================
// Request Parameters
// =============================================================================

export interface FirmsParams {
  page?: number;
  page_size?: number;
  firm_type?: string;
  country?: string;
  min_aum?: number;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface FundsParams {
  page?: number;
  page_size?: number;
  strategy?: string;
  vintage_year?: number;
  min_size?: number;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface DealsParams {
  page?: number;
  page_size?: number;
  deal_type?: string;
  industry?: string;
  country?: string;
  min_value?: number;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface CompaniesParams {
  page?: number;
  page_size?: number;
  industry?: string;
  country?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface PeopleParams {
  page?: number;
  page_size?: number;
  seniority?: string;
  country?: string;
  firm_id?: string;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}
