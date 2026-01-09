// LPs (Limited Partners) API Service
// Handles communication with the LP database backend

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LP,
  LPListResponse,
  LPSearchParams,
  LPTypesResponse,
  LPStatistics,
  FundCommitment,
  LPHolding,
  LPHoldingsListResponse,
  LPHoldingsStats,
  LPHoldingsSearchParams,
} from '@/types/lp';

// Use environment variable or fallback to proxy
// In development, Vite will proxy /api to the backend
// In production, this should be configured via environment variable
const LPS_API_BASE = import.meta.env.VITE_RESEARCH_SERVICE_URL || '';

// Debug logging to verify configuration
console.log('[lpsApi] Configuration:', {
  VITE_RESEARCH_SERVICE_URL: import.meta.env.VITE_RESEARCH_SERVICE_URL,
  LPS_API_BASE: LPS_API_BASE,
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

/**
 * Search/list LPs with advanced filtering and pagination
 */
export async function searchLPs(
  params: LPSearchParams = {},
  signal?: AbortSignal
): Promise<LPListResponse> {
  // Build query string from params
  const queryParams = new URLSearchParams();

  if (params.search) queryParams.append('search', params.search);
  if (params.type) queryParams.append('type', params.type);
  if (params.location) queryParams.append('location', params.location);
  if (params.relationship_status) queryParams.append('relationship_status', params.relationship_status);
  if (params.tier) queryParams.append('tier', params.tier);
  if (params.min_commitment !== undefined) queryParams.append('min_commitment', params.min_commitment.toString());
  if (params.max_commitment !== undefined) queryParams.append('max_commitment', params.max_commitment.toString());
  if (params.min_investment_year !== undefined) queryParams.append('min_investment_year', params.min_investment_year.toString());
  if (params.max_investment_year !== undefined) queryParams.append('max_investment_year', params.max_investment_year.toString());
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.order) queryParams.append('order', params.order);
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());

  const url = `${LPS_API_BASE}/api/lps${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    console.log('[lpsApi] Fetching from URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal, // Add abort signal for request cancellation
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to search LPs' }));
      throw new Error(error.message || `Failed to search LPs: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Search results:', {
      total: data.total,
      count: data.lps?.length,
      page: data.page,
    });
    return data;
  } catch (error) {
    console.error('[lpsApi] Search failed:', error);
    throw error;
  }
}

/**
 * Get a single LP by ID
 */
export async function getLP(id: string): Promise<LP> {
  const url = `${LPS_API_BASE}/api/lps/${id}`;

  try {
    console.log('[lpsApi] Fetching LP:', id);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch LP' }));
      throw new Error(error.message || `Failed to fetch LP: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Fetched LP:', data.name);
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch failed:', error);
    throw error;
  }
}

/**
 * Get available LP types
 */
export async function getLPTypes(): Promise<LPTypesResponse> {
  const url = `${LPS_API_BASE}/api/lps/meta/types`;

  try {
    console.log('[lpsApi] Fetching LP types');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch LP types' }));
      throw new Error(error.message || `Failed to fetch LP types: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Fetched LP types:', {
      count: data.types?.length,
    });
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch LP types failed:', error);
    throw error;
  }
}

/**
 * Get LP statistics
 */
export async function getLPStats(): Promise<LPStatistics> {
  const url = `${LPS_API_BASE}/api/lps/meta/stats`;

  try {
    console.log('[lpsApi] Fetching LP stats');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch LP stats' }));
      throw new Error(error.message || `Failed to fetch LP stats: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Fetched LP stats:', data);
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch LP stats failed:', error);
    throw error;
  }
}

/**
 * Custom hook for searching LPs with automatic caching
 * @param params - Search parameters
 * @returns Query result with LPs data, loading state, and error
 */
export function useLPSearch(params: LPSearchParams) {
  return useQuery({
    queryKey: ['lps', 'search', params],
    queryFn: async ({ signal }) => {
      // Add signal for request cancellation
      const result = await searchLPs(params, signal);
      return result;
    },
    enabled: (params.search?.length ?? 0) >= 1 || Object.keys(params).length > 1, // Search if query exists or filters applied
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes (formerly cacheTime)
  });
}

/**
 * Custom hook for fetching a single LP by ID
 */
export function useLP(lpId: string | undefined) {
  return useQuery({
    queryKey: ['lps', lpId],
    queryFn: () => {
      if (!lpId) throw new Error('LP ID is required');
      return getLP(lpId);
    },
    enabled: !!lpId, // Only fetch if lpId is provided
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
  });
}

/**
 * Helper function to format commitment amount for display
 */
export function formatCommitment(commitment: number | undefined): string {
  if (!commitment) return 'N/A';

  const billion = 1_000_000_000;
  const million = 1_000_000;

  if (commitment >= billion) {
    return `$${(commitment / billion).toFixed(2)}B`;
  } else if (commitment >= million) {
    return `$${(commitment / million).toFixed(0)}M`;
  } else {
    return `$${commitment.toLocaleString()}`;
  }
}

/**
 * Helper function to format LP type for display
 */
export function formatLPType(type: string | undefined): string {
  if (!type) return 'N/A';
  return type;
}

/**
 * Helper function to get badge color for relationship status
 */
export function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'Active':
      return 'green';
    case 'Prospective':
      return 'blue';
    case 'Inactive':
      return 'gray';
    case 'Former':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Helper function to get badge color for tier
 */
export function getTierColor(tier: string | undefined): string {
  switch (tier) {
    case 'Tier 1':
      return 'gold';
    case 'Tier 2':
      return 'silver';
    case 'Tier 3':
      return 'bronze';
    default:
      return 'gray';
  }
}

// ============================================================================
// LP Fund Commitments API
// ============================================================================

/**
 * Get all fund commitments for a specific LP
 */
export async function getLPCommitments(lpId: string): Promise<FundCommitment[]> {
  const url = `${LPS_API_BASE}/api/lps/${lpId}/commitments`;

  try {
    console.log('[lpsApi] Fetching commitments for LP:', lpId);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch LP commitments' }));
      throw new Error(error.message || `Failed to fetch LP commitments: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Fetched commitments:', data.length);
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch commitments failed:', error);
    throw error;
  }
}

/**
 * Create a new fund commitment for an LP
 */
export async function createLPCommitment(
  lpId: string,
  commitmentData: Partial<FundCommitment>
): Promise<FundCommitment> {
  const url = `${LPS_API_BASE}/api/lps/${lpId}/commitments`;

  try {
    console.log('[lpsApi] Creating commitment for LP:', lpId, commitmentData);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitmentData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create commitment' }));
      throw new Error(error.message || `Failed to create commitment: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Created commitment:', data.id);
    return data;
  } catch (error) {
    console.error('[lpsApi] Create commitment failed:', error);
    throw error;
  }
}

/**
 * Update an existing fund commitment
 */
export async function updateLPCommitment(
  lpId: string,
  commitmentId: string,
  commitmentData: Partial<FundCommitment>
): Promise<FundCommitment> {
  const url = `${LPS_API_BASE}/api/lps/${lpId}/commitments/${commitmentId}`;

  try {
    console.log('[lpsApi] Updating commitment:', commitmentId, commitmentData);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitmentData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update commitment' }));
      throw new Error(error.message || `Failed to update commitment: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Updated commitment:', data.id);
    return data;
  } catch (error) {
    console.error('[lpsApi] Update commitment failed:', error);
    throw error;
  }
}

/**
 * Delete a fund commitment
 */
export async function deleteLPCommitment(
  lpId: string,
  commitmentId: string
): Promise<void> {
  const url = `${LPS_API_BASE}/api/lps/${lpId}/commitments/${commitmentId}`;

  try {
    console.log('[lpsApi] Deleting commitment:', commitmentId);
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete commitment' }));
      throw new Error(error.message || `Failed to delete commitment: ${response.statusText}`);
    }

    console.log('[lpsApi] Deleted commitment:', commitmentId);
  } catch (error) {
    console.error('[lpsApi] Delete commitment failed:', error);
    throw error;
  }
}

/**
 * Custom hook for fetching LP commitments with React Query
 */
export function useLPCommitments(lpId: string | undefined) {
  return useQuery({
    queryKey: ['lps', lpId, 'commitments'],
    queryFn: () => {
      if (!lpId) throw new Error('LP ID is required');
      return getLPCommitments(lpId);
    },
    enabled: !!lpId, // Only fetch if lpId is provided
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Custom hook for creating LP commitments with React Query mutation
 */
export function useCreateLPCommitment(lpId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitmentData: Partial<FundCommitment>) =>
      createLPCommitment(lpId, commitmentData),
    onSuccess: () => {
      // Invalidate commitments query to refetch
      queryClient.invalidateQueries({ queryKey: ['lps', lpId, 'commitments'] });
    },
  });
}

/**
 * Custom hook for updating LP commitments with React Query mutation
 */
export function useUpdateLPCommitment(lpId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commitmentId, data }: { commitmentId: string; data: Partial<FundCommitment> }) =>
      updateLPCommitment(lpId, commitmentId, data),
    onSuccess: () => {
      // Invalidate commitments query to refetch
      queryClient.invalidateQueries({ queryKey: ['lps', lpId, 'commitments'] });
    },
  });
}

/**
 * Custom hook for deleting LP commitments with React Query mutation
 */
export function useDeleteLPCommitment(lpId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commitmentId: string) =>
      deleteLPCommitment(lpId, commitmentId),
    onSuccess: () => {
      // Invalidate commitments query to refetch
      queryClient.invalidateQueries({ queryKey: ['lps', lpId, 'commitments'] });
    },
  });
}

// ============================================================================
// LP Holdings API
// ============================================================================

/**
 * Search/list LP holdings with filtering, sorting, and pagination
 */
export async function searchHoldings(
  params: LPHoldingsSearchParams = {},
  signal?: AbortSignal
): Promise<LPHoldingsListResponse> {
  // Build query string from params
  const queryParams = new URLSearchParams();

  if (params.lp_id) queryParams.append('lp_id', params.lp_id);
  if (params.vintage) queryParams.append('vintage', params.vintage.toString());
  if (params.min_value !== undefined) queryParams.append('min_value', params.min_value.toString());
  if (params.max_value !== undefined) queryParams.append('max_value', params.max_value.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params.sort_order) queryParams.append('sort_order', params.sort_order);
  if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
  if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());

  const url = `${LPS_API_BASE}/api/holdings${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    console.log('[lpsApi] Fetching holdings from URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch holdings' }));
      throw new Error(error.message || `Failed to fetch holdings: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Holdings results:', {
      total: data.total,
      count: data.holdings?.length,
      limit: data.limit,
      offset: data.offset,
    });
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch holdings failed:', error);
    throw error;
  }
}

/**
 * Get holdings statistics
 */
export async function getHoldingsStats(lpId?: string): Promise<LPHoldingsStats> {
  const queryParams = new URLSearchParams();
  if (lpId) queryParams.append('lp_id', lpId);

  const url = `${LPS_API_BASE}/api/holdings/stats/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  try {
    console.log('[lpsApi] Fetching holdings stats');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch holdings stats' }));
      throw new Error(error.message || `Failed to fetch holdings stats: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Holdings stats:', data);
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch holdings stats failed:', error);
    throw error;
  }
}

/**
 * Get a single holding by ID
 */
export async function getHolding(holdingId: string): Promise<LPHolding> {
  const url = `${LPS_API_BASE}/api/holdings/${holdingId}`;

  try {
    console.log('[lpsApi] Fetching holding:', holdingId);
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch holding' }));
      throw new Error(error.message || `Failed to fetch holding: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Fetched holding:', data.fund_name);
    return data;
  } catch (error) {
    console.error('[lpsApi] Fetch holding failed:', error);
    throw error;
  }
}

/**
 * Create a new holding
 */
export async function createHolding(holdingData: Partial<LPHolding>): Promise<LPHolding> {
  const url = `${LPS_API_BASE}/api/holdings`;

  try {
    console.log('[lpsApi] Creating holding:', holdingData);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create holding' }));
      throw new Error(error.message || `Failed to create holding: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Created holding:', data.id);
    return data;
  } catch (error) {
    console.error('[lpsApi] Create holding failed:', error);
    throw error;
  }
}

/**
 * Update an existing holding
 */
export async function updateHolding(
  holdingId: string,
  holdingData: Partial<LPHolding>
): Promise<LPHolding> {
  const url = `${LPS_API_BASE}/api/holdings/${holdingId}`;

  try {
    console.log('[lpsApi] Updating holding:', holdingId, holdingData);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdingData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update holding' }));
      throw new Error(error.message || `Failed to update holding: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[lpsApi] Updated holding:', data.id);
    return data;
  } catch (error) {
    console.error('[lpsApi] Update holding failed:', error);
    throw error;
  }
}

/**
 * Delete a holding
 */
export async function deleteHolding(holdingId: string): Promise<void> {
  const url = `${LPS_API_BASE}/api/holdings/${holdingId}`;

  try {
    console.log('[lpsApi] Deleting holding:', holdingId);
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete holding' }));
      throw new Error(error.message || `Failed to delete holding: ${response.statusText}`);
    }

    console.log('[lpsApi] Deleted holding:', holdingId);
  } catch (error) {
    console.error('[lpsApi] Delete holding failed:', error);
    throw error;
  }
}

/**
 * Custom hook for fetching holdings with React Query
 */
export function useHoldings(params: LPHoldingsSearchParams = {}) {
  return useQuery({
    queryKey: ['holdings', params],
    queryFn: async ({ signal }) => {
      const result = await searchHoldings(params, signal);
      return result;
    },
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep cache for 10 minutes
  });
}

/**
 * Custom hook for fetching holdings statistics with React Query
 */
export function useHoldingsStats(lpId?: string) {
  return useQuery({
    queryKey: ['holdings', 'stats', lpId],
    queryFn: () => getHoldingsStats(lpId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Custom hook for fetching a single holding
 */
export function useHolding(holdingId: string | undefined) {
  return useQuery({
    queryKey: ['holdings', holdingId],
    queryFn: () => {
      if (!holdingId) throw new Error('Holding ID is required');
      return getHolding(holdingId);
    },
    enabled: !!holdingId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Custom hook for creating holdings with React Query mutation
 */
export function useCreateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdingData: Partial<LPHolding>) => createHolding(holdingData),
    onSuccess: () => {
      // Invalidate holdings queries to refetch
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}

/**
 * Custom hook for updating holdings with React Query mutation
 */
export function useUpdateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ holdingId, data }: { holdingId: string; data: Partial<LPHolding> }) =>
      updateHolding(holdingId, data),
    onSuccess: () => {
      // Invalidate holdings queries to refetch
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}

/**
 * Custom hook for deleting holdings with React Query mutation
 */
export function useDeleteHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdingId: string) => deleteHolding(holdingId),
    onSuccess: () => {
      // Invalidate holdings queries to refetch
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}
