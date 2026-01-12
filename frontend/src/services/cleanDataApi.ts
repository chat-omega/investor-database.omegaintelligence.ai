/**
 * API service for Clean Data Layer
 */
import { useQuery } from '@tanstack/react-query';
import type {
  Dataset,
  DatasetListResponse,
  SheetDataResponse,
  SheetDataParams,
  ColumnDef,
  CleanDataStats,
} from '@/types/cleanData';

const API_BASE = '/api/clean-data';

// =============================================================================
// Dataset APIs
// =============================================================================

export async function fetchDatasets(): Promise<Dataset[]> {
  const response = await fetch(`${API_BASE}/datasets`);
  if (!response.ok) throw new Error('Failed to fetch datasets');
  const data: DatasetListResponse = await response.json();
  return data.datasets;
}

export function useDatasets() {
  return useQuery({
    queryKey: ['clean-data-datasets'],
    queryFn: fetchDatasets,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export async function fetchDataset(datasetId: string): Promise<Dataset> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}`);
  if (!response.ok) throw new Error('Failed to fetch dataset');
  return response.json();
}

export function useDataset(datasetId: string) {
  return useQuery({
    queryKey: ['clean-data-dataset', datasetId],
    queryFn: () => fetchDataset(datasetId),
    staleTime: 30 * 60 * 1000,
    enabled: !!datasetId,
  });
}

// =============================================================================
// Sheet Data APIs
// =============================================================================

export async function fetchSheetData(
  datasetId: string,
  sheetId: string,
  params: SheetDataParams = {}
): Promise<SheetDataResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.search) searchParams.set('search', params.search);
  if (params.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params.sort_direction) searchParams.set('sort_direction', params.sort_direction);
  if (params.filters) searchParams.set('filters', JSON.stringify(params.filters));

  const url = `${API_BASE}/datasets/${datasetId}/sheets/${sheetId}?${searchParams}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch sheet data');
  return response.json();
}

export function useSheetData(
  datasetId: string,
  sheetId: string,
  params: SheetDataParams = {}
) {
  return useQuery({
    queryKey: ['clean-data-sheet', datasetId, sheetId, params],
    queryFn: () => fetchSheetData(datasetId, sheetId, params),
    staleTime: 5 * 60 * 1000,
    enabled: !!datasetId && !!sheetId,
  });
}

// =============================================================================
// Column Metadata APIs
// =============================================================================

export async function fetchSheetColumns(
  datasetId: string,
  sheetId: string
): Promise<ColumnDef[]> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}/sheets/${sheetId}/columns`);
  if (!response.ok) throw new Error('Failed to fetch columns');
  return response.json();
}

export function useSheetColumns(datasetId: string, sheetId: string) {
  return useQuery({
    queryKey: ['clean-data-columns', datasetId, sheetId],
    queryFn: () => fetchSheetColumns(datasetId, sheetId),
    staleTime: Infinity, // Columns don't change
    enabled: !!datasetId && !!sheetId,
  });
}

// =============================================================================
// Stats API
// =============================================================================

export async function fetchCleanDataStats(): Promise<CleanDataStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export function useCleanDataStats() {
  return useQuery({
    queryKey: ['clean-data-stats'],
    queryFn: fetchCleanDataStats,
    staleTime: 10 * 60 * 1000,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  const billion = 1_000_000_000;
  const million = 1_000_000;
  if (num >= billion) return `$${(num / billion).toFixed(1)}B`;
  if (num >= million) return `$${(num / million).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
}

export function truncateText(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
