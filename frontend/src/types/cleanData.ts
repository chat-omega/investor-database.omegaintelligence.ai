/**
 * Types for Clean Data API
 */

export interface SheetInfo {
  id: string;
  name: string;
  display_name: string;
  row_count: number;
  column_count: number;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  icon: string;
  sheets: SheetInfo[];
}

export interface DatasetListResponse {
  datasets: Dataset[];
}

export interface ColumnDef {
  key: string;
  name: string;
  index: number;
  data_type: 'string' | 'number' | 'date' | 'boolean';
  is_visible: boolean;
  width?: number;
}

export interface SheetDataResponse {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  columns: ColumnDef[];
}

export interface SheetDataParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

export interface CleanDataStats {
  total_rows: number;
  by_dataset: Record<string, Record<string, number>>;
}
