/**
 * Generic table component for displaying Clean Data sheets
 */
import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Columns, Loader2, Linkedin, Mail, ExternalLink } from 'lucide-react';
import type { ColumnDef } from '@/types/cleanData';
import { formatNumber, formatCurrency, formatDate, truncateText } from '@/services/cleanDataApi';

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
}

export function CleanDataTable({
  data,
  columns,
  isLoading,
  pagination,
  sortBy,
  sortDirection,
  onPageChange,
  onSort,
}: CleanDataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);

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

  const displayColumns = columns.filter(c => visibleColumns.has(c.key));

  const formatCellValue = (value: unknown, dataType: string, columnKey?: string): string => {
    if (value === null || value === undefined) return '-';

    const strValue = String(value);
    const keyLower = columnKey?.toLowerCase() || '';

    // Check if this is an ID column - never format as currency
    const isIdColumn = keyLower.includes('_id') || keyLower.endsWith('id') || keyLower === 'id';

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
        // Check if it looks like currency (contains M, B, or large number)
        if (strValue.includes('MN') || strValue.includes('USD') || num > 100000) {
          return formatCurrency(num);
        }
        return formatNumber(num);
      case 'date':
        return formatDate(strValue);
      default:
        return truncateText(strValue, 100);
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

  // Render cell content with special handling for links
  const renderCellContent = (value: unknown, col: ColumnDef): React.ReactNode => {
    if (value === null || value === undefined || value === '') return '-';

    const strValue = String(value);

    // Email column - render as mailto link
    if (isEmailColumn(col.key)) {
      return (
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
      return (
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
      return (
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

    // Default: use existing formatCellValue for plain text
    return formatCellValue(value, col.data_type, col.key);
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
      {/* Column Selector */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
        <div className="text-sm text-slate-400">
          Showing {displayColumns.length} of {columns.length} columns
        </div>
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
              <div className="p-3 border-b border-slate-700 flex justify-between">
                <button
                  onClick={showAllColumns}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Show All
                </button>
                <button
                  onClick={resetColumns}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Reset to Default
                </button>
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

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr>
              {displayColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span title={col.name}>{truncateText(col.name, 25)}</span>
                    {sortBy === col.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.map((row, rowIndex) => (
              <tr key={row._id as string || rowIndex} className="hover:bg-slate-700/30 transition-colors">
                {displayColumns.map(col => (
                  <td
                    key={col.key}
                    className="px-3 py-2 text-sm text-slate-300 whitespace-nowrap max-w-xs overflow-hidden"
                    title={String(row[col.key] ?? '')}
                  >
                    {renderCellContent(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {formatNumber(pagination.total)}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
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
            className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
