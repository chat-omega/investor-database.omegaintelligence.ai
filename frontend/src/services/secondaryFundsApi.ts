/**
 * API service for Secondary Funds Database
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  SecondaryFund,
  SecondaryGP,
  SecondaryLP,
  SecondaryFundListResponse,
  SecondaryGPListResponse,
  SecondaryLPListResponse,
  SecondaryStats,
  NLQResponse,
  MetaOption,
  FundStatusFilter,
  StrategyFilter,
  SectorFilter,
} from '@/types/secondaryFund';

const API_BASE = '/api/secondary-funds';

// Funds API
export interface FundsParams {
  page?: number;
  page_size?: number;
  search?: string;
  fund_manager_name?: string;
  status?: FundStatusFilter;
  strategy?: StrategyFilter;
  sector?: SectorFilter;
  vintage_year_min?: number;
  vintage_year_max?: number;
  fund_size_min?: number;
  fund_size_max?: number;
  irr_min?: number;
  irr_max?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export async function fetchSecondaryFunds(params: FundsParams = {}): Promise<SecondaryFundListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const response = await fetch(`${API_BASE}/funds?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch funds');
  return response.json();
}

export function useSecondaryFunds(params: FundsParams = {}) {
  return useQuery({
    queryKey: ['secondary-funds', params],
    queryFn: () => fetchSecondaryFunds(params),
  });
}

export async function fetchSecondaryFund(id: number): Promise<SecondaryFund> {
  const response = await fetch(`${API_BASE}/funds/${id}`);
  if (!response.ok) throw new Error('Failed to fetch fund');
  return response.json();
}

export function useSecondaryFund(id: number) {
  return useQuery({
    queryKey: ['secondary-fund', id],
    queryFn: () => fetchSecondaryFund(id),
    enabled: !!id,
  });
}

// GPs API
export interface GPsParams {
  page?: number;
  page_size?: number;
  search?: string;
  country?: string;
  aum_min?: number;
  aum_max?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export async function fetchSecondaryGPs(params: GPsParams = {}): Promise<SecondaryGPListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const response = await fetch(`${API_BASE}/gps?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch GPs');
  return response.json();
}

export function useSecondaryGPs(params: GPsParams = {}) {
  return useQuery({
    queryKey: ['secondary-gps', params],
    queryFn: () => fetchSecondaryGPs(params),
  });
}

export async function fetchSecondaryGP(id: number): Promise<SecondaryGP> {
  const response = await fetch(`${API_BASE}/gps/${id}`);
  if (!response.ok) throw new Error('Failed to fetch GP');
  return response.json();
}

export function useSecondaryGP(id: number) {
  return useQuery({
    queryKey: ['secondary-gp', id],
    queryFn: () => fetchSecondaryGP(id),
    enabled: !!id,
  });
}

// LPs API
export interface LPsParams {
  page?: number;
  page_size?: number;
  search?: string;
  country?: string;
  aum_min?: number;
  aum_max?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

export async function fetchSecondaryLPs(params: LPsParams = {}): Promise<SecondaryLPListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const response = await fetch(`${API_BASE}/lps?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch LPs');
  return response.json();
}

export function useSecondaryLPs(params: LPsParams = {}) {
  return useQuery({
    queryKey: ['secondary-lps', params],
    queryFn: () => fetchSecondaryLPs(params),
  });
}

export async function fetchSecondaryLP(id: number): Promise<SecondaryLP> {
  const response = await fetch(`${API_BASE}/lps/${id}`);
  if (!response.ok) throw new Error('Failed to fetch LP');
  return response.json();
}

export function useSecondaryLP(id: number) {
  return useQuery({
    queryKey: ['secondary-lp', id],
    queryFn: () => fetchSecondaryLP(id),
    enabled: !!id,
  });
}

// Stats API
export async function fetchSecondaryStats(): Promise<SecondaryStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export function useSecondaryStats() {
  return useQuery({
    queryKey: ['secondary-stats'],
    queryFn: fetchSecondaryStats,
  });
}

// Meta APIs
export async function fetchStatuses(): Promise<{ statuses: MetaOption[] }> {
  const response = await fetch(`${API_BASE}/meta/statuses`);
  if (!response.ok) throw new Error('Failed to fetch statuses');
  return response.json();
}

export function useStatuses() {
  return useQuery({
    queryKey: ['secondary-statuses'],
    queryFn: fetchStatuses,
  });
}

export async function fetchStrategies(): Promise<{ strategies: MetaOption[] }> {
  const response = await fetch(`${API_BASE}/meta/strategies`);
  if (!response.ok) throw new Error('Failed to fetch strategies');
  return response.json();
}

export function useStrategies() {
  return useQuery({
    queryKey: ['secondary-strategies'],
    queryFn: fetchStrategies,
  });
}

export async function fetchSectors(): Promise<{ sectors: MetaOption[] }> {
  const response = await fetch(`${API_BASE}/meta/sectors`);
  if (!response.ok) throw new Error('Failed to fetch sectors');
  return response.json();
}

export function useSectors() {
  return useQuery({
    queryKey: ['secondary-sectors'],
    queryFn: fetchSectors,
  });
}

// NLQ API
export async function executeNLQ(question: string): Promise<NLQResponse> {
  const response = await fetch(`${API_BASE}/nlq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error('Failed to execute NLQ query');
  return response.json();
}

export function useNLQ() {
  return useMutation({
    mutationFn: executeNLQ,
  });
}
