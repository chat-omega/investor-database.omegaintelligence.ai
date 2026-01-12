/**
 * API service for Preqin Data Layer
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  PreqinFirm,
  PreqinFirmListResponse,
  FirmsParams,
  PreqinFund,
  PreqinFundListResponse,
  FundsParams,
  PreqinDeal,
  PreqinDealListResponse,
  DealsParams,
  PreqinCompany,
  PreqinCompanyListResponse,
  CompaniesParams,
  PreqinPerson,
  PreqinPersonListResponse,
  PeopleParams,
  CoInvestmentNetworkResponse,
  CoInvestmentDrilldown,
  NetworkGraphData,
  SearchRequest,
  SearchResponse,
  PreqinStats,
} from '@/types/preqin';

const API_BASE = '/api/preqin';

// =============================================================================
// Utility Functions
// =============================================================================

function buildSearchParams(params: object): URLSearchParams {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  return searchParams;
}

export function formatAUM(aum: number | undefined | null): string {
  if (aum === undefined || aum === null) return '-';
  const billion = 1_000_000_000;
  const million = 1_000_000;
  if (aum >= billion) return `$${(aum / billion).toFixed(1)}B`;
  if (aum >= million) return `$${(aum / million).toFixed(0)}M`;
  return `$${aum.toLocaleString()}`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  return `${value.toFixed(1)}%`;
}

export function formatMultiple(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-';
  return `${value.toFixed(2)}x`;
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

// =============================================================================
// Firms API
// =============================================================================

export async function fetchPreqinFirms(params: FirmsParams = {}): Promise<PreqinFirmListResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`${API_BASE}/firms?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin firms');
  return response.json();
}

export function usePreqinFirms(params: FirmsParams = {}) {
  return useQuery({
    queryKey: ['preqin-firms', params],
    queryFn: () => fetchPreqinFirms(params),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchPreqinFirm(firmId: string): Promise<PreqinFirm> {
  const response = await fetch(`${API_BASE}/firms/${firmId}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin firm');
  return response.json();
}

export function usePreqinFirm(firmId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-firm', firmId],
    queryFn: () => fetchPreqinFirm(firmId!),
    enabled: !!firmId,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// Funds API
// =============================================================================

export async function fetchPreqinFunds(params: FundsParams = {}): Promise<PreqinFundListResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`${API_BASE}/funds?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin funds');
  return response.json();
}

export function usePreqinFunds(params: FundsParams = {}) {
  return useQuery({
    queryKey: ['preqin-funds', params],
    queryFn: () => fetchPreqinFunds(params),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchPreqinFund(fundId: string): Promise<PreqinFund> {
  const response = await fetch(`${API_BASE}/funds/${fundId}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin fund');
  return response.json();
}

export function usePreqinFund(fundId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-fund', fundId],
    queryFn: () => fetchPreqinFund(fundId!),
    enabled: !!fundId,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// Deals API
// =============================================================================

export async function fetchPreqinDeals(params: DealsParams = {}): Promise<PreqinDealListResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`${API_BASE}/deals?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin deals');
  return response.json();
}

export function usePreqinDeals(params: DealsParams = {}) {
  return useQuery({
    queryKey: ['preqin-deals', params],
    queryFn: () => fetchPreqinDeals(params),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchPreqinDeal(dealId: string): Promise<PreqinDeal> {
  const response = await fetch(`${API_BASE}/deals/${dealId}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin deal');
  return response.json();
}

export function usePreqinDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-deal', dealId],
    queryFn: () => fetchPreqinDeal(dealId!),
    enabled: !!dealId,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// Companies API
// =============================================================================

export async function fetchPreqinCompanies(params: CompaniesParams = {}): Promise<PreqinCompanyListResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`${API_BASE}/companies?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin companies');
  return response.json();
}

export function usePreqinCompanies(params: CompaniesParams = {}) {
  return useQuery({
    queryKey: ['preqin-companies', params],
    queryFn: () => fetchPreqinCompanies(params),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchPreqinCompany(companyId: string): Promise<PreqinCompany> {
  const response = await fetch(`${API_BASE}/companies/${companyId}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin company');
  return response.json();
}

export function usePreqinCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-company', companyId],
    queryFn: () => fetchPreqinCompany(companyId!),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// People API
// =============================================================================

export async function fetchPreqinPeople(params: PeopleParams = {}): Promise<PreqinPersonListResponse> {
  const searchParams = buildSearchParams(params);
  const response = await fetch(`${API_BASE}/people?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin people');
  return response.json();
}

export function usePreqinPeople(params: PeopleParams = {}) {
  return useQuery({
    queryKey: ['preqin-people', params],
    queryFn: () => fetchPreqinPeople(params),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchPreqinPerson(personId: string): Promise<PreqinPerson> {
  const response = await fetch(`${API_BASE}/people/${personId}`);
  if (!response.ok) throw new Error('Failed to fetch Preqin person');
  return response.json();
}

export function usePreqinPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-person', personId],
    queryFn: () => fetchPreqinPerson(personId!),
    enabled: !!personId,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// Co-Investment Network API
// =============================================================================

export async function fetchCoInvestors(
  firmId: string,
  minDeals: number = 1,
  limit: number = 50
): Promise<CoInvestmentNetworkResponse> {
  const params = new URLSearchParams({ min_deals: String(minDeals), limit: String(limit) });
  const response = await fetch(`${API_BASE}/firms/${firmId}/co-investors?${params}`);
  if (!response.ok) throw new Error('Failed to fetch co-investors');
  return response.json();
}

export function useCoInvestors(firmId: string | undefined, minDeals: number = 1, limit: number = 50) {
  return useQuery({
    queryKey: ['preqin-co-investors', firmId, minDeals, limit],
    queryFn: () => fetchCoInvestors(firmId!, minDeals, limit),
    enabled: !!firmId,
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchFirmNetwork(
  firmId: string,
  maxHops: number = 2,
  minDeals: number = 1
): Promise<NetworkGraphData> {
  const params = new URLSearchParams({
    max_hops: String(maxHops),
    min_deals: String(minDeals),
  });
  const response = await fetch(`${API_BASE}/firms/${firmId}/network?${params}`);
  if (!response.ok) throw new Error('Failed to fetch firm network');
  return response.json();
}

export function useFirmNetwork(firmId: string | undefined, maxHops: number = 2, minDeals: number = 1) {
  return useQuery({
    queryKey: ['preqin-firm-network', firmId, maxHops, minDeals],
    queryFn: () => fetchFirmNetwork(firmId!, maxHops, minDeals),
    enabled: !!firmId,
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchCoInvestmentDetails(
  firmAId: string,
  firmBId: string
): Promise<CoInvestmentDrilldown> {
  const response = await fetch(`${API_BASE}/firms/${firmAId}/co-investments/${firmBId}`);
  if (!response.ok) throw new Error('Failed to fetch co-investment details');
  return response.json();
}

export function useCoInvestmentDetails(firmAId: string | undefined, firmBId: string | undefined) {
  return useQuery({
    queryKey: ['preqin-co-investment-details', firmAId, firmBId],
    queryFn: () => fetchCoInvestmentDetails(firmAId!, firmBId!),
    enabled: !!firmAId && !!firmBId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// Search API
// =============================================================================

export async function executeHybridSearch(request: SearchRequest): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}

export function usePreqinSearch() {
  return useMutation({
    mutationFn: executeHybridSearch,
  });
}

// =============================================================================
// Stats API
// =============================================================================

export async function fetchPreqinStats(): Promise<PreqinStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to fetch Preqin stats');
  return response.json();
}

export function usePreqinStats() {
  return useQuery({
    queryKey: ['preqin-stats'],
    queryFn: fetchPreqinStats,
    staleTime: 10 * 60 * 1000,
  });
}
