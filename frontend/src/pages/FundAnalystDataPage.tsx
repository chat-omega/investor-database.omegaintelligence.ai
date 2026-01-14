/**
 * Fund Analyst Data Page
 * View and manipulate exported data from GP/LP Datasets
 */
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, Trash2, Loader2, Plus, Filter, Download, Columns, Sparkles } from 'lucide-react';
import {
  useExportSession,
  useExportData,
  deleteExportSession,
  useExportSessions,
  formatNumber,
  useExportColumns,
  addCustomColumn,
  deleteCustomColumn,
  updateCustomColumn,
} from '@/services/cleanDataApi';
import { CleanDataTable } from '@/components/clean-data/CleanDataTable';
import { ColumnManager } from '@/components/fund-data/ColumnManager';
import { EnrichmentModal } from '@/components/fund-data/EnrichmentModal';
import { useQueryClient } from '@tanstack/react-query';
import type { SheetDataParams } from '@/types/cleanData';

export function FundAnalystDataPage() {
  const { exportId } = useParams<{ exportId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [params, setParams] = useState<SheetDataParams>({ page: 1, page_size: 50 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);

  const { data: session, isLoading: sessionLoading, error: sessionError } = useExportSession(exportId || '');
  const { data: exportData, isLoading: dataLoading } = useExportData(exportId || '', params);
  const { data: columnConfig, refetch: refetchColumns } = useExportColumns(exportId || '');

  // Column management handlers
  const handleAddColumn = async (params: { name: string; type?: 'text' | 'number' | 'enriched'; enrichment_prompt?: string }) => {
    if (!exportId) return;
    await addCustomColumn(exportId, params);
    await refetchColumns();
    queryClient.invalidateQueries({ queryKey: ['clean-data-export-data', exportId] });
  };

  const handleDeleteColumn = async (key: string) => {
    if (!exportId) return;
    await deleteCustomColumn(exportId, key);
    await refetchColumns();
    queryClient.invalidateQueries({ queryKey: ['clean-data-export-data', exportId] });
  };

  const handleRenameColumn = async (key: string, name: string) => {
    if (!exportId) return;
    await updateCustomColumn(exportId, key, { name });
    await refetchColumns();
  };

  const handleEnrichmentComplete = () => {
    // Refresh data after enrichment completes
    refetchColumns();
    queryClient.invalidateQueries({ queryKey: ['clean-data-export-data', exportId] });
  };

  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams(prev => ({ ...prev, page_size: pageSize, page: 1 }));
  };

  const handleSort = (sortBy: string, sortDirection: 'asc' | 'desc') => {
    setParams(prev => ({ ...prev, sort_by: sortBy, sort_direction: sortDirection, page: 1 }));
  };

  const handleDelete = async () => {
    if (!exportId || !confirm('Are you sure you want to delete this export?')) return;

    setIsDeleting(true);
    try {
      await deleteExportSession(exportId);
      queryClient.invalidateQueries({ queryKey: ['clean-data-exports'] });
      navigate('/fund-analyst/data');
    } catch (err) {
      console.error('Failed to delete export:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (sessionLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Error state
  if (sessionError || !session) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileSpreadsheet className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Export not found</h2>
            <p className="text-slate-400 mb-4">The requested export session doesn't exist.</p>
            <Link
              to="/fund-analyst/data"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>View all exports</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const datasetLabel = session.source_dataset === 'gp-dataset' ? 'GP Dataset' : 'LP Dataset';
  const sheetLabel = session.source_sheet.charAt(0).toUpperCase() + session.source_sheet.slice(1);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/fund-analyst/data"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </Link>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{session.name}</h1>
                <p className="text-sm text-slate-400">
                  {datasetLabel} / {sheetLabel} &middot; {formatNumber(session.row_count)} rows
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Add Enriched Column Button */}
            <button
              onClick={() => setShowEnrichmentModal(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Enrich</span>
            </button>
            {/* Manage Columns Button */}
            <button
              onClick={() => setShowColumnManager(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Columns className="w-4 h-4" />
              <span>Columns</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center space-x-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export Info Bar */}
      <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/20 flex items-center space-x-6 text-sm">
        {session.filters && Object.keys(session.filters).length > 0 && (
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Filters:</span>
            {Object.entries(session.filters).map(([key, value]) => (
              <span key={key} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                {key}: {value}
              </span>
            ))}
          </div>
        )}
        <div className="text-slate-400">
          Created: {new Date(session.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <CleanDataTable
          data={exportData?.items ?? []}
          columns={exportData?.columns ?? []}
          isLoading={dataLoading}
          pagination={{
            page: exportData?.page ?? 1,
            pageSize: exportData?.page_size ?? 50,
            total: exportData?.total ?? 0,
            pages: exportData?.pages ?? 0,
          }}
          sortBy={params.sort_by}
          sortDirection={params.sort_direction}
          onPageChange={handlePageChange}
          onSort={handleSort}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Column Manager Modal */}
      <ColumnManager
        isOpen={showColumnManager}
        onClose={() => setShowColumnManager(false)}
        customColumns={columnConfig?.custom_columns ?? []}
        onAddColumn={handleAddColumn}
        onDeleteColumn={handleDeleteColumn}
        onRenameColumn={handleRenameColumn}
      />

      {/* Enrichment Modal */}
      {exportId && session && (
        <EnrichmentModal
          isOpen={showEnrichmentModal}
          onClose={() => setShowEnrichmentModal(false)}
          exportId={exportId}
          sampleRow={exportData?.items?.[0]}
          totalRows={session.row_count || 0}
          onComplete={handleEnrichmentComplete}
        />
      )}
    </div>
  );
}

/**
 * Fund Analyst Data List Page
 * Shows all export sessions
 */
export function FundAnalystDataListPage() {
  const navigate = useNavigate();
  const { data: exports, isLoading, error } = useExportSessions();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">My Data</h1>
              <p className="text-sm text-slate-400">Exported datasets from GP/LP pages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!exports || exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileSpreadsheet className="w-16 h-16 text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No exports yet</h2>
            <p className="text-slate-400 mb-6 max-w-md">
              Export data from the GP Dataset or LP Dataset pages to create a data workspace
              for manipulation and enrichment.
            </p>
            <div className="flex space-x-3">
              <Link
                to="/clean-data/gp"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Go to GP Dataset
              </Link>
              <Link
                to="/clean-data/lp"
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Go to LP Dataset
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exports.map((exp) => {
              const datasetLabel = exp.source_dataset === 'gp-dataset' ? 'GP Dataset' : 'LP Dataset';
              const sheetLabel = exp.source_sheet.charAt(0).toUpperCase() + exp.source_sheet.slice(1);

              return (
                <button
                  key={exp.id}
                  onClick={() => navigate(`/fund-analyst/data/${exp.id}`)}
                  className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl p-5 text-left transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(exp.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    {exp.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    {datasetLabel} / {sheetLabel}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-medium">
                      {formatNumber(exp.row_count)} rows
                    </span>
                    {exp.filters && Object.keys(exp.filters).length > 0 && (
                      <span className="text-xs text-slate-500 flex items-center">
                        <Filter className="w-3 h-3 mr-1" />
                        {Object.keys(exp.filters).length} filters
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
