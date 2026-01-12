/**
 * LP Dataset Page
 * Displays LP investors and contacts from Preqin Excel data
 */
import { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { useDataset, useSheetData } from '@/services/cleanDataApi';
import { CleanDataTable } from '@/components/clean-data/CleanDataTable';
import { CleanDataTabs } from '@/components/clean-data/CleanDataTabs';
import type { SheetDataParams } from '@/types/cleanData';

export function CleanDataLPPage() {
  const [activeSheet, setActiveSheet] = useState('investors');
  const [params, setParams] = useState<SheetDataParams>({ page: 1, page_size: 50 });
  const [searchInput, setSearchInput] = useState('');

  const { data: dataset, isLoading: datasetLoading } = useDataset('lp-dataset');
  const { data: sheetData, isLoading: sheetLoading } = useSheetData('lp-dataset', activeSheet, params);

  // Reset pagination when switching sheets
  useEffect(() => {
    setParams(prev => ({ ...prev, page: 1 }));
    setSearchInput('');
  }, [activeSheet]);

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchInput || undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handleSort = (sortBy: string, sortDirection: 'asc' | 'desc') => {
    setParams(prev => ({ ...prev, sort_by: sortBy, sort_direction: sortDirection, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">LP Dataset</h1>
              <p className="text-sm text-slate-400">Limited Partner investor data from Preqin</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {dataset && (
        <CleanDataTabs
          sheets={dataset.sheets}
          activeSheet={activeSheet}
          onTabChange={setActiveSheet}
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <CleanDataTable
          data={sheetData?.items ?? []}
          columns={sheetData?.columns ?? []}
          isLoading={datasetLoading || sheetLoading}
          pagination={{
            page: sheetData?.page ?? 1,
            pageSize: sheetData?.page_size ?? 50,
            total: sheetData?.total ?? 0,
            pages: sheetData?.pages ?? 0,
          }}
          sortBy={params.sort_by}
          sortDirection={params.sort_direction}
          onPageChange={handlePageChange}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
