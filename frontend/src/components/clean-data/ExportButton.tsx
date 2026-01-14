/**
 * ExportButton component
 * Button with modal for exporting table data to Fund Analyst
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, X, Loader2, FileSpreadsheet } from 'lucide-react';
import { createExportSession } from '@/services/cleanDataApi';
import { formatNumber } from '@/services/cleanDataApi';
import { useQueryClient } from '@tanstack/react-query';

interface ExportButtonProps {
  datasetId: string;
  sheetId: string;
  filters: Record<string, string>;
  visibleColumns: string[];
  totalRows: number;
  sortBy?: string;
  sortDirection?: string;
  searchQuery?: string;
  page: number;      // Current page number (1-indexed)
  pageSize: number;  // Rows per page
}

export function ExportButton({
  datasetId,
  sheetId,
  filters,
  visibleColumns,
  totalRows,
  sortBy,
  sortDirection,
  searchQuery,
  page,
  pageSize,
}: ExportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportName, setExportName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleExport = async () => {
    if (!exportName.trim()) return;

    setIsExporting(true);
    setError(null);

    try {
      const session = await createExportSession({
        name: exportName.trim(),
        source_dataset: datasetId,
        source_sheet: sheetId,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        visible_columns: visibleColumns,
        sort_by: sortBy,
        sort_direction: sortDirection,
        search_query: searchQuery,
        page: page,         // Export only current page
        page_size: pageSize,
      });

      // Invalidate export sessions cache
      queryClient.invalidateQueries({ queryKey: ['clean-data-exports'] });

      // Navigate to the Fund Analyst Data page
      navigate(`/fund-analyst/data/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create export');
    } finally {
      setIsExporting(false);
    }
  };

  const activeFiltersCount = Object.keys(filters).filter(k => filters[k]).length;
  const datasetLabel = datasetId === 'gp-dataset' ? 'GP Dataset' : 'LP Dataset';
  const sheetLabel = sheetId.charAt(0).toUpperCase() + sheetId.slice(1);

  // Calculate actual rows to export (current page only)
  const offset = (page - 1) * pageSize;
  const remainingRows = Math.max(0, totalRows - offset);
  const rowsToExport = Math.min(pageSize, remainingRows);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
        aria-label="Export to Fund Analyst"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Export to Fund Analyst</h2>
                  <p className="text-sm text-slate-400">Create a data workspace</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Export Summary */}
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-medium text-slate-300">Export Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-400">Source:</div>
                  <div className="text-white">{datasetLabel} / {sheetLabel}</div>
                  <div className="text-slate-400">Page:</div>
                  <div className="text-white">Page {page} of {Math.ceil(totalRows / pageSize)}</div>
                  <div className="text-slate-400">Rows to export:</div>
                  <div className="text-emerald-400 font-medium">{formatNumber(rowsToExport)} rows</div>
                  <div className="text-slate-400">Columns:</div>
                  <div className="text-white">{visibleColumns.length} columns</div>
                  {activeFiltersCount > 0 && (
                    <>
                      <div className="text-slate-400">Filters:</div>
                      <div className="text-white">{activeFiltersCount} active</div>
                    </>
                  )}
                </div>
              </div>

              {/* Export Name Input */}
              <div>
                <label htmlFor="export-name" className="block text-sm font-medium text-slate-300 mb-2">
                  Export Name
                </label>
                <input
                  id="export-name"
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="Export name (e.g., 'US GP Firms Q1')"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!exportName.trim() || isExporting}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Create Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
