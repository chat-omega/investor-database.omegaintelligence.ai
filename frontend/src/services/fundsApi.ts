// Funds API Service
// Handles communication with the fund database backend

import { useQuery } from '@tanstack/react-query';
import type {
  Fund,
  FundListResponse,
  FundSearchParams,
  FundMetadata,
  FundStatistics,
  PortfolioCompany,
  PortfolioCompanyListResponse,
} from '@/types/fund';

// Use environment variable or fallback to proxy
// In development, Vite will proxy /api to the backend
// In production, this should be configured via environment variable
const FUNDS_API_BASE = import.meta.env.VITE_RESEARCH_SERVICE_URL || '';

// Debug logging to verify configuration
console.log('[fundsApi] Configuration:', {
  VITE_RESEARCH_SERVICE_URL: import.meta.env.VITE_RESEARCH_SERVICE_URL,
  FUNDS_API_BASE: FUNDS_API_BASE,
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

/**
 * Search/list funds with advanced filtering and pagination
 */
export async function searchFunds(
  params: FundSearchParams = {},
  signal?: AbortSignal
): Promise<FundListResponse> {
  // Build query string from params
  const queryParams = new URLSearchParams();

  if (params.search) queryParams.append('search', params.search);
  if (params.strategy) queryParams.append('strategy', params.strategy);
  if (params.headquarters) queryParams.append('headquarters', params.headquarters);
  if (params.min_aum !== undefined) queryParams.append('min_aum', params.min_aum.toString());
  if (params.max_aum !== undefined) queryParams.append('max_aum', params.max_aum.toString());
  if (params.min_founded_year !== undefined) queryParams.append('min_founded_year', params.min_founded_year.toString());
  if (params.max_founded_year !== undefined) queryParams.append('max_founded_year', params.max_founded_year.toString());
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.order) queryParams.append('order', params.order);
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());

  const url = `${FUNDS_API_BASE}/api/funds${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    console.log('[fundsApi] Fetching from URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal, // Add abort signal for request cancellation
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to search funds' }));
      throw new Error(error.message || `Failed to search funds: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fundsApi] Search results:', {
      total: data.total,
      count: data.funds?.length,
      page: data.page,
    });
    return data;
  } catch (error) {
    console.error('[fundsApi] Search failed:', error);
    throw error;
  }
}

/**
 * Get a single fund by ID
 */
export async function getFund(id: string): Promise<Fund> {
  const url = `${FUNDS_API_BASE}/api/funds/${id}`;

  try {
    console.log('[fundsApi] Fetching fund:', id);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch fund' }));
      throw new Error(error.message || `Failed to fetch fund: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fundsApi] Fetched fund:', data.name);
    return data;
  } catch (error) {
    console.error('[fundsApi] Fetch failed:', error);
    throw error;
  }
}

/**
 * Get available investment strategies
 */
export async function getStrategies(): Promise<FundMetadata> {
  const url = `${FUNDS_API_BASE}/api/funds/meta/strategies`;

  try {
    console.log('[fundsApi] Fetching strategies');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch strategies' }));
      throw new Error(error.message || `Failed to fetch strategies: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fundsApi] Fetched strategies:', {
      count: data.strategies?.length,
    });
    return data;
  } catch (error) {
    console.error('[fundsApi] Fetch strategies failed:', error);
    throw error;
  }
}

/**
 * Get fund statistics
 */
export async function getFundStats(): Promise<FundStatistics> {
  const url = `${FUNDS_API_BASE}/api/funds/meta/stats`;

  try {
    console.log('[fundsApi] Fetching stats');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch stats' }));
      throw new Error(error.message || `Failed to fetch stats: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fundsApi] Fetched stats:', data);
    return data;
  } catch (error) {
    console.error('[fundsApi] Fetch stats failed:', error);
    throw error;
  }
}

/**
 * Custom hook for searching funds with automatic caching
 * @param params - Search parameters
 * @returns Query result with funds data, loading state, and error
 */
export function useFundSearch(params: FundSearchParams) {
  return useQuery({
    queryKey: ['funds', 'search', params],
    queryFn: async ({ signal }) => {
      // Add signal for request cancellation
      const result = await searchFunds(params, signal);
      return result;
    },
    enabled: (params.search?.length ?? 0) >= 1, // Only search if query has at least 1 character
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes (formerly cacheTime)
  });
}

/**
 * Custom hook for fetching a single fund by ID
 */
export function useFund(fundId: string | undefined) {
  return useQuery({
    queryKey: ['funds', fundId],
    queryFn: () => {
      if (!fundId) throw new Error('Fund ID is required');
      return getFund(fundId);
    },
    enabled: !!fundId, // Only fetch if fundId is provided
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });
}

/**
 * Helper function to format AUM for display
 */
export function formatAUM(aum: number | undefined): string {
  if (!aum) return 'N/A';

  const billion = 1_000_000_000;
  const million = 1_000_000;

  if (aum >= billion) {
    return `$${(aum / billion).toFixed(2)}B`;
  } else if (aum >= million) {
    return `$${(aum / million).toFixed(0)}M`;
  } else {
    return `$${aum.toLocaleString()}`;
  }
}

// ============================================================================
// Portfolio Company API Functions
// ============================================================================

export interface PortfolioSearchParams {
  search?: string;
  sector?: string;
  stage?: string;
  status?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Get portfolio companies for a specific fund
 */
export async function getFundPortfolio(
  fundId: string,
  params: PortfolioSearchParams = {}
): Promise<PortfolioCompanyListResponse> {
  const queryParams = new URLSearchParams();

  if (params.search) queryParams.append('search', params.search);
  if (params.sector) queryParams.append('sector', params.sector);
  if (params.stage) queryParams.append('stage', params.stage);
  if (params.status) queryParams.append('status', params.status);
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.order) queryParams.append('order', params.order);
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());

  const url = `${FUNDS_API_BASE}/api/funds/${fundId}/portfolio${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    console.log('[fundsApi] Fetching portfolio for fund:', fundId);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch portfolio' }));
      throw new Error(error.message || `Failed to fetch portfolio: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fundsApi] Portfolio results:', {
      total: data.total,
      count: data.companies?.length,
    });
    return data;
  } catch (error) {
    console.error('[fundsApi] Fetch portfolio failed:', error);
    throw error;
  }
}

/**
 * Custom hook for fetching fund portfolio companies
 */
export function useFundPortfolio(fundId: string | undefined, params: PortfolioSearchParams = {}) {
  return useQuery({
    queryKey: ['funds', fundId, 'portfolio', params],
    queryFn: () => {
      if (!fundId) throw new Error('Fund ID is required');
      return getFundPortfolio(fundId, params);
    },
    enabled: !!fundId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Format valuation for display
 */
export function formatValuation(valuation: number | undefined, valuationRaw: string | undefined): string {
  if (valuationRaw) return valuationRaw;
  if (!valuation) return 'N/A';

  const billion = 1_000_000_000;
  const million = 1_000_000;

  if (valuation >= billion) {
    return `$${(valuation / billion).toFixed(2)}B`;
  } else if (valuation >= million) {
    return `$${(valuation / million).toFixed(1)}M`;
  } else {
    return `$${valuation.toLocaleString()}`;
  }
}
