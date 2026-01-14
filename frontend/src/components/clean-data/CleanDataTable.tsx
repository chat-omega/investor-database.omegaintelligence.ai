/**
 * Generic table component for displaying Clean Data sheets
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Columns, Loader2, Linkedin, Mail, ExternalLink, Filter } from 'lucide-react';
import type { ColumnDef, EnrichmentMetadata } from '@/types/cleanData';
import { formatNumber, formatCurrency, formatDate, truncateText } from '@/services/cleanDataApi';
import { ColumnFilter } from './ColumnFilter';
import { ExportButton } from './ExportButton';
import { CitationTooltip } from '@/components/ui/CitationTooltip';
import { CellExpandModal, useCellExpandModal } from './CellExpandModal';

interface CleanDataTableProps {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  isLoading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSort: (column: string, direction: 'asc' | 'desc') => void;
  onPageSizeChange?: (pageSize: number) => void;
  // Filter props
  datasetId?: string;
  sheetId?: string;
  filterableColumns?: string[];
  filters?: Record<string, string>;
  onFilterChange?: (columnKey: string, value: string | null) => void;
  // Export props
  searchQuery?: string;
  // Enrichment metadata for citations
  enrichmentMetadata?: EnrichmentMetadata;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function CleanDataTable({
  data,
  columns,
  isLoading,
  pagination,
  sortBy,
  sortDirection,
  onPageChange,
  onSort,
  onPageSizeChange,
  datasetId,
  sheetId,
  filterableColumns = [],
  filters = {},
  onFilterChange,
  searchQuery,
  enrichmentMetadata,
}: CleanDataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Load saved column widths from localStorage
  useEffect(() => {
    const savedWidths = localStorage.getItem('cleanDataTableWidths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save column widths to localStorage when changed
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem('cleanDataTableWidths', JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  // Reset visible columns when columns prop changes (e.g., switching tabs)
  useEffect(() => {
    if (columns.length > 0) {
      const defaultVisible = new Set(columns.filter(c => c.is_visible).map(c => c.key));
      setVisibleColumns(defaultVisible);
    }
  }, [columns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const showAllColumns = () => {
    setVisibleColumns(new Set(columns.map(c => c.key)));
  };

  const resetColumns = () => {
    setVisibleColumns(new Set(columns.filter(c => c.is_visible).map(c => c.key)));
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(colKey);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const diff = e.clientX - startXRef.current;
    const newWidth = Math.max(80, startWidthRef.current + diff); // Min 80px
    setColumnWidths(prev => ({ ...prev, [isResizing]: newWidth }));
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
  }, []);

  // Attach global mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const resetColumnWidths = () => {
    setColumnWidths({});
    localStorage.removeItem('cleanDataTableWidths');
  };

  // Cell expand modal
  const { modalState, openModal, closeModal } = useCellExpandModal();

  const handleCellClick = (col: ColumnDef, value: unknown) => {
    const strValue = String(value ?? '');
    // Only open modal for text content that might be truncated (> 50 chars)
    if (strValue.length > 50 && col.data_type !== 'number') {
      openModal(col.name, strValue);
    }
  };

  const displayColumns = columns.filter(c => visibleColumns.has(c.key));

  const formatCellValue = (value: unknown, dataType: string, columnKey?: string): string => {
    if (value === null || value === undefined) return '-';

    const strValue = String(value);
    const keyLower = columnKey?.toLowerCase() || '';

    // Check if this is an ID column - never format as currency
    const isIdColumn = keyLower.includes('_id') || keyLower.endsWith('id') || keyLower === 'id';

    // Check if this is a year column - format without commas
    const isYearColumn = keyLower.includes('year') || keyLower.includes('vintage') || keyLower.includes('inception');

    // Check if this is a currency column - format with $ and M/B
    const isCurrencyColumn = keyLower.includes('_usd_') || keyLower.includes('_mn') ||
                             keyLower.includes('size') || keyLower.includes('aum') ||
                             keyLower.includes('allocation') || keyLower.includes('dry_powder');

    // Check if this looks like an ISO date string (e.g., 2025-12-04T00:00:00)
    const isIsoDate = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(strValue);
    if (isIsoDate) {
      return formatDate(strValue);
    }

    switch (dataType) {
      case 'number':
        const num = parseFloat(strValue);
        if (isNaN(num)) return strValue;
        // Don't format IDs as currency
        if (isIdColumn) {
          return strValue;
        }
        // Year columns - no commas, just the plain number
        if (isYearColumn) {
          return Math.round(num).toString();
        }
        // Currency columns - format with $ and M/B
        if (isCurrencyColumn || strValue.includes('MN') || strValue.includes('USD') || num > 100000) {
          return formatCurrency(num);
        }
        return formatNumber(num);
      case 'date':
        return formatDate(strValue);
      default:
        // Allow longer text - CSS will handle overflow with ellipsis
        return truncateText(strValue, 500);
    }
  };

  // Helper functions for detecting special column types
  const isEmailColumn = (key: string): boolean => {
    return key.toLowerCase().includes('email');
  };

  const isLinkedInColumn = (key: string): boolean => {
    return key.toLowerCase().includes('linkedin');
  };

  const isUrlColumn = (key: string): boolean => {
    return key.toLowerCase().includes('website') ||
           (key.toLowerCase().includes('url') && !key.toLowerCase().includes('linkedin'));
  };

  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  // Render cell content with special handling for links and citations
  const renderCellContent = (value: unknown, col: ColumnDef, rowId?: string): React.ReactNode => {
    if (value === null || value === undefined || value === '') return '-';

    const strValue = String(value);

    // Check if this cell has citations
    const cellMetadata = rowId && enrichmentMetadata?.[rowId]?.[col.key];
    const citations = cellMetadata?.citations || [];

    // Helper to wrap content with CitationTooltip if citations exist
    const wrapWithCitations = (content: React.ReactNode) => {
      if (citations.length > 0) {
        return <CitationTooltip citations={citations}>{content}</CitationTooltip>;
      }
      return content;
    };

    // Email column - render as mailto link
    if (isEmailColumn(col.key)) {
      return wrapWithCitations(
        <a
          href={`mailto:${strValue}`}
          className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          title={strValue}
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="w-4 h-4 flex-shrink-0" />
          <span className="truncate max-w-[150px]">{strValue}</span>
        </a>
      );
    }

    // LinkedIn column - render as external link
    if (isLinkedInColumn(col.key)) {
      return wrapWithCitations(
        <a
          href={normalizeUrl(strValue)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          title={strValue}
          onClick={(e) => e.stopPropagation()}
        >
          <Linkedin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate max-w-[100px]">LinkedIn</span>
        </a>
      );
    }

    // Website/URL column - render as external link
    if (isUrlColumn(col.key) && strValue.includes('.')) {
      return wrapWithCitations(
        <a
          href={normalizeUrl(strValue)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          title={strValue}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span className="truncate max-w-[100px]">Link</span>
        </a>
      );
    }

    // Default: use existing formatCellValue for plain text, wrap with citations if present
    return wrapWithCitations(
      <span>{formatCellValue(value, col.data_type, col.key)}</span>
    );
  };

  const handleSort = (column: ColumnDef) => {
    const newDirection = sortBy === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newDirection);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column Selector & Export */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
        <div className="text-sm text-slate-400">
          Showing {displayColumns.length} of {columns.length} columns
        </div>
        <div className="flex items-center space-x-2">
          {/* Export Button */}
          {datasetId && sheetId && (
            <ExportButton
              datasetId={datasetId}
              sheetId={sheetId}
              filters={filters}
              visibleColumns={Array.from(visibleColumns)}
              totalRows={pagination.total}
              sortBy={sortBy}
              sortDirection={sortDirection}
              searchQuery={searchQuery}
              page={pagination.page}
              pageSize={pagination.pageSize}
            />
          )}
          <div className="relative">
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            <Columns className="w-4 h-4" />
            <span>Columns</span>
          </button>

          {showColumnSelector && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
              <div className="p-3 border-b border-slate-700 flex justify-between items-center">
                <button
                  onClick={showAllColumns}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Show All
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={resetColumnWidths}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Reset Widths
                  </button>
                  <button
                    onClick={resetColumns}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    Reset Columns
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {columns.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-300 truncate" title={col.name}>
                      {col.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              {displayColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => !isResizing && handleSort(col)}
                  style={{
                    width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : 'auto',
                    minWidth: '80px',
                    position: 'relative',
                  }}
                  className={`px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors select-none ${isResizing === col.key ? 'bg-slate-700' : ''}`}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span title={col.name} className="truncate">{truncateText(col.name, 25)}</span>
                    {sortBy === col.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                      )
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => handleResizeStart(e, col.key, columnWidths[col.key] || 150)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                  >
                    <div className="h-full w-0.5 bg-transparent group-hover:bg-emerald-500/50 transition-colors ml-auto" />
                  </div>
                </th>
              ))}
            </tr>
            {/* Filter Row */}
            {filterableColumns.length > 0 && datasetId && sheetId && onFilterChange && (
              <tr className="bg-slate-800/80">
                {displayColumns.map(col => (
                  <th key={`filter-${col.key}`} className="px-2 py-1.5">
                    {filterableColumns.includes(col.key) ? (
                      <ColumnFilter
                        datasetId={datasetId}
                        sheetId={sheetId}
                        columnKey={col.key}
                        columnName={col.name}
                        selectedValue={filters[col.key] ?? null}
                        onFilterChange={(value) => onFilterChange(col.key, value)}
                      />
                    ) : (
                      <div className="h-6" /> // Spacer for non-filterable columns
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.map((row, rowIndex) => {
              const rowId = row._id as string;
              return (
                <tr key={rowId || rowIndex} className="hover:bg-slate-700/30 transition-colors">
                  {displayColumns.map(col => {
                    const cellValue = row[col.key];
                    const strValue = String(cellValue ?? '');
                    const isExpandable = strValue.length > 50 && col.data_type !== 'number';
                    return (
                      <td
                        key={col.key}
                        style={{
                          width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : 'auto',
                          minWidth: '80px',
                          maxWidth: columnWidths[col.key] ? `${columnWidths[col.key]}px` : '400px',
                        }}
                        className={`px-3 py-2 text-sm text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap ${isExpandable ? 'cursor-pointer hover:bg-slate-700/50' : ''}`}
                        title={strValue}
                        onClick={() => isExpandable && handleCellClick(col, cellValue)}
                      >
                        {renderCellContent(cellValue, col, rowId)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-400">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {formatNumber(pagination.total)}
          </div>
          {onPageSizeChange && (
            <div className="flex items-center space-x-2">
              <label htmlFor="page-size-select" className="text-sm text-slate-400">
                Rows per page:
              </label>
              <select
                id="page-size-select"
                aria-label="Rows per page"
                value={pagination.pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            aria-label="Previous page"
            className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <span className="text-sm text-white px-3">
            Page {pagination.page} of {formatNumber(pagination.pages)}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            aria-label="Next page"
            className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Cell Expand Modal */}
      <CellExpandModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        columnName={modalState.columnName}
        value={modalState.value}
      />
    </div>
  );
}
