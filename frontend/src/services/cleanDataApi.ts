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
// Column Values API (for filters)
// =============================================================================

export async function fetchColumnDistinctValues(
  datasetId: string,
  sheetId: string,
  columnKey: string,
  limit: number = 100
): Promise<string[]> {
  const searchParams = new URLSearchParams();
  if (limit) searchParams.set('limit', String(limit));

  const url = `${API_BASE}/datasets/${datasetId}/sheets/${sheetId}/columns/${columnKey}/values?${searchParams}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch column values');
  return response.json();
}

export function useColumnDistinctValues(
  datasetId: string,
  sheetId: string,
  columnKey: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['clean-data-column-values', datasetId, sheetId, columnKey],
    queryFn: () => fetchColumnDistinctValues(datasetId, sheetId, columnKey),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && !!datasetId && !!sheetId && !!columnKey,
  });
}

// =============================================================================
// Export Session APIs
// =============================================================================

export interface ExportSession {
  id: string;
  name: string;
  source_dataset: string;
  source_sheet: string;
  filters?: Record<string, string>;
  visible_columns?: string[];
  sort_by?: string;
  sort_direction?: string;
  search_query?: string;
  custom_columns?: unknown[];
  row_count: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateExportParams {
  name: string;
  source_dataset: string;
  source_sheet: string;
  filters?: Record<string, string>;
  visible_columns?: string[];
  sort_by?: string;
  sort_direction?: string;
  search_query?: string;
  page?: number;      // Current page to export (1-indexed)
  page_size?: number; // Rows per page to export
}

export async function fetchExportSessions(): Promise<ExportSession[]> {
  const response = await fetch(`${API_BASE}/exports`);
  if (!response.ok) throw new Error('Failed to fetch export sessions');
  return response.json();
}

export function useExportSessions() {
  return useQuery({
    queryKey: ['clean-data-exports'],
    queryFn: fetchExportSessions,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export async function createExportSession(params: CreateExportParams): Promise<ExportSession> {
  const searchParams = new URLSearchParams();
  searchParams.set('name', params.name);
  searchParams.set('source_dataset', params.source_dataset);
  searchParams.set('source_sheet', params.source_sheet);
  if (params.filters) searchParams.set('filters', JSON.stringify(params.filters));
  if (params.visible_columns) searchParams.set('visible_columns', JSON.stringify(params.visible_columns));
  if (params.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params.sort_direction) searchParams.set('sort_direction', params.sort_direction);
  if (params.search_query) searchParams.set('search_query', params.search_query);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));

  const response = await fetch(`${API_BASE}/exports?${searchParams}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to create export session');
  return response.json();
}

export async function fetchExportSession(exportId: string): Promise<ExportSession> {
  const response = await fetch(`${API_BASE}/exports/${exportId}`);
  if (!response.ok) throw new Error('Failed to fetch export session');
  return response.json();
}

export function useExportSession(exportId: string) {
  return useQuery({
    queryKey: ['clean-data-export', exportId],
    queryFn: () => fetchExportSession(exportId),
    staleTime: 5 * 60 * 1000,
    enabled: !!exportId,
  });
}

export async function deleteExportSession(exportId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/exports/${exportId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete export session');
}

export async function fetchExportData(
  exportId: string,
  params: SheetDataParams = {}
): Promise<SheetDataResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));

  const response = await fetch(`${API_BASE}/exports/${exportId}/data?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch export data');
  return response.json();
}

export function useExportData(exportId: string, params: SheetDataParams = {}) {
  return useQuery({
    queryKey: ['clean-data-export-data', exportId, params],
    queryFn: () => fetchExportData(exportId, params),
    staleTime: 5 * 60 * 1000,
    enabled: !!exportId,
  });
}

// =============================================================================
// Custom Column Management APIs
// =============================================================================

export interface CustomColumn {
  key: string;
  name: string;
  type: 'text' | 'number' | 'enriched';
  source: 'user' | 'parallel';
  enrichment_prompt?: string;
  created_at?: string;
}

export interface ColumnConfig {
  custom_columns: CustomColumn[];
  visible_columns: string[] | null;
  hidden_source_columns: string[];
}

export interface CreateColumnParams {
  name: string;
  type?: 'text' | 'number' | 'enriched';
  enrichment_prompt?: string;
}

export async function fetchExportColumns(exportId: string): Promise<ColumnConfig> {
  const response = await fetch(`${API_BASE}/exports/${exportId}/columns`);
  if (!response.ok) throw new Error('Failed to fetch export columns');
  return response.json();
}

export function useExportColumns(exportId: string) {
  return useQuery({
    queryKey: ['clean-data-export-columns', exportId],
    queryFn: () => fetchExportColumns(exportId),
    staleTime: 5 * 60 * 1000,
    enabled: !!exportId,
  });
}

export async function addCustomColumn(
  exportId: string,
  params: CreateColumnParams
): Promise<CustomColumn> {
  const response = await fetch(`${API_BASE}/exports/${exportId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to add column');
  }
  return response.json();
}

export async function deleteCustomColumn(
  exportId: string,
  columnKey: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/exports/${exportId}/columns/${columnKey}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to delete column');
  }
}

export async function updateCustomColumn(
  exportId: string,
  columnKey: string,
  params: { name?: string }
): Promise<CustomColumn> {
  const response = await fetch(`${API_BASE}/exports/${exportId}/columns/${columnKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update column');
  }
  return response.json();
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
