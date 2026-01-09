import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Building2, ExternalLink, Loader2, Search, TrendingUp, MapPin, Calendar } from 'lucide-react';
import { useFundPortfolio, formatValuation } from '@/services/fundsApi';
import type { PortfolioCompany } from '@/types/fund';

interface FundPortfolioTableProps {
  fundId: string;
  fundName: string;
}

export function FundPortfolioTable({ fundId, fundName }: FundPortfolioTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const { data, isLoading, error } = useFundPortfolio(fundId, {
    search: searchQuery || undefined,
    sector: selectedSector || undefined,
    status: selectedStatus || undefined,
    limit: 100,
  });

  const companies = data?.companies || [];

  // Get unique sectors and statuses for filters
  const sectors = useMemo(() => {
    const unique = new Set(companies.map(c => c.sector).filter(Boolean));
    return Array.from(unique).sort();
  }, [companies]);

  const statuses = ['Active', 'Exited', 'IPO'];

  // AG-Grid column definitions
  const columnDefs = useMemo<ColDef<PortfolioCompany>[]>(() => [
    {
      headerName: 'Company',
      field: 'name',
      flex: 2,
      minWidth: 180,
      cellRenderer: (params: { data: PortfolioCompany }) => {
        const company = params.data;
        return (
          <div className="flex items-center gap-2 py-1">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.name} className="w-6 h-6 rounded" />
              ) : (
                <Building2 className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">{company.name}</span>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>
          </div>
        );
      },
    },
    {
      headerName: 'Sector',
      field: 'sector',
      flex: 1.5,
      minWidth: 140,
      cellRenderer: (params: { value: string }) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-700 text-slate-300">
          {params.value || 'N/A'}
        </span>
      ),
    },
    {
      headerName: 'Stage',
      field: 'stage',
      flex: 1,
      minWidth: 100,
      cellRenderer: (params: { value: string }) => {
        const stage = params.value;
        const colors: Record<string, string> = {
          'Series A': 'bg-green-900/50 text-green-400',
          'Series B': 'bg-blue-900/50 text-blue-400',
          'Series C': 'bg-purple-900/50 text-purple-400',
          'Series D': 'bg-pink-900/50 text-pink-400',
          'Growth': 'bg-orange-900/50 text-orange-400',
          'IPO': 'bg-yellow-900/50 text-yellow-400',
        };
        const colorClass = colors[stage] || 'bg-slate-700 text-slate-300';
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {stage || 'N/A'}
          </span>
        );
      },
    },
    {
      headerName: 'Location',
      field: 'location',
      flex: 1.2,
      minWidth: 120,
      cellRenderer: (params: { value: string }) => (
        <div className="flex items-center gap-1 text-slate-300 text-sm">
          <MapPin className="w-3 h-3 text-slate-500" />
          {params.value || 'N/A'}
        </div>
      ),
    },
    {
      headerName: 'Valuation',
      field: 'valuation',
      flex: 1,
      minWidth: 100,
      cellRenderer: (params: { data: PortfolioCompany }) => (
        <div className="flex items-center gap-1 text-emerald-400 font-medium text-sm">
          <TrendingUp className="w-3 h-3" />
          {formatValuation(params.data.valuation, params.data.valuation_raw)}
        </div>
      ),
      comparator: (valueA: number, valueB: number) => (valueA || 0) - (valueB || 0),
    },
    {
      headerName: 'Investment Date',
      field: 'investment_date',
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return <span className="text-slate-500">N/A</span>;
        const date = new Date(params.value);
        return (
          <div className="flex items-center gap-1 text-slate-300 text-sm">
            <Calendar className="w-3 h-3 text-slate-500" />
            {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
        );
      },
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.8,
      minWidth: 80,
      cellRenderer: (params: { value: string }) => {
        const status = params.value || 'Active';
        const colors: Record<string, string> = {
          'Active': 'bg-green-900/50 text-green-400 border-green-700',
          'Exited': 'bg-blue-900/50 text-blue-400 border-blue-700',
          'IPO': 'bg-purple-900/50 text-purple-400 border-purple-700',
        };
        const colorClass = colors[status] || 'bg-slate-700 text-slate-300 border-slate-600';
        return (
          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colorClass}`}>
            {status}
          </span>
        );
      },
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    suppressMovable: true,
  }), []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading portfolio for {fundName}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to load portfolio companies</p>
          <p className="text-sm text-slate-500 mt-1">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sector Filter */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sectors</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {/* Results Count */}
          <span className="text-sm text-slate-400 ml-auto">
            {data?.total || 0} companies
          </span>
        </div>
      </div>

      {/* Table */}
      {companies.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No portfolio companies found</p>
            {searchQuery && (
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 ag-theme-alpine-dark" style={{ height: '500px', width: '100%' }}>
          <AgGridReact<PortfolioCompany>
            rowData={companies}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={56}
            headerHeight={40}
            animateRows={true}
            suppressCellFocus={true}
            pagination={true}
            paginationPageSize={25}
            paginationPageSizeSelector={[10, 25, 50, 100]}
          />
        </div>
      )}
    </div>
  );
}
