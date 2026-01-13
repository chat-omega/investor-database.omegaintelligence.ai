import { useState } from 'react';
import { Briefcase, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePreqinFunds, usePreqinStats, formatAUM, formatNumber, formatPercent, formatMultiple } from '@/services/preqinApi';
import type { FundsParams } from '@/types/preqin';

export function PreqinFundsPage() {
  const [params, setParams] = useState<FundsParams>({ page: 1, page_size: 20 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = usePreqinFunds(params);
  const { data: stats } = usePreqinStats();

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleFilterChange = (key: keyof FundsParams, value: string | number) => {
    setParams(prev => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  // Generate vintage year options (last 30 years)
  const currentYear = new Date().getFullYear();
  const vintageYears = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Private Equity Funds</h1>
              <p className="text-sm text-slate-400">Private Market Funds Database</p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_funds)}</div>
                <div className="text-slate-400">Total Funds</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-slate-700/20">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search funds..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={params.strategy || ''}
            onChange={(e) => handleFilterChange('strategy', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Strategies</option>
            <option value="Buyout">Buyout</option>
            <option value="Venture Capital">Venture Capital</option>
            <option value="Growth">Growth</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Infrastructure">Infrastructure</option>
            <option value="Private Debt">Private Debt</option>
            <option value="Secondaries">Secondaries</option>
            <option value="Fund of Funds">Fund of Funds</option>
          </select>
          <select
            value={params.vintage_year || ''}
            onChange={(e) => handleFilterChange('vintage_year', e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Vintage Years</option>
            {vintageYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fund Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Manager</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Strategy</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Vintage</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Fund Size</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">IRR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">TVPI</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">DPI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : !data?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No funds found</td>
                  </tr>
                ) : (
                  data.items.map((fund) => (
                    <tr key={fund.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{fund.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fund.managing_firm_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fund.strategy || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-center">{fund.vintage_year || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatAUM(fund.fund_size_usd)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={fund.irr && fund.irr > 0 ? 'text-emerald-400' : fund.irr && fund.irr < 0 ? 'text-red-400' : 'text-slate-400'}>
                          {formatPercent(fund.irr)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatMultiple(fund.tvpi)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatMultiple(fund.dpi)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          fund.status === 'Closed' ? 'bg-emerald-500/20 text-emerald-400' :
                          fund.status?.includes('Raising') ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {fund.status || '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && (
            <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Showing {((data.page - 1) * data.page_size) + 1} to {Math.min(data.page * data.page_size, data.total)} of {data.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  disabled={data.page <= 1}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <span className="text-sm text-white">Page {data.page} of {data.pages}</span>
                <button
                  onClick={() => setParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  disabled={data.page >= data.pages}
                  className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
