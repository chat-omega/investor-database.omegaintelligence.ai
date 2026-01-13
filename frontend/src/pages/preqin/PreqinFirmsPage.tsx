import { useState } from 'react';
import { Building2, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { usePreqinFirms, usePreqinStats, formatAUM, formatNumber } from '@/services/preqinApi';
import type { FirmsParams } from '@/types/preqin';

export function PreqinFirmsPage() {
  const [params, setParams] = useState<FirmsParams>({ page: 1, page_size: 20 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = usePreqinFirms(params);
  const { data: stats } = usePreqinStats();

  const handleSearch = () => {
    setParams(prev => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleFilterChange = (key: keyof FirmsParams, value: string) => {
    setParams(prev => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Preqin Firms</h1>
              <p className="text-sm text-slate-400">GP & LP Firms Database</p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_firms)}</div>
                <div className="text-slate-400">Total Firms</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">{formatNumber(stats.total_gps)}</div>
                <div className="text-slate-400">GPs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">{formatNumber(stats.total_lps)}</div>
                <div className="text-slate-400">LPs</div>
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
              placeholder="Search firms..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={params.firm_type || ''}
            onChange={(e) => handleFilterChange('firm_type', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Types</option>
            <option value="GP">GP</option>
            <option value="LP">LP</option>
            <option value="BOTH">Both</option>
          </select>
          <select
            value={params.country || ''}
            onChange={(e) => handleFilterChange('country', e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Countries</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Firm Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Institution Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">AUM</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Dry Powder</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Founded</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Funds</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : !data?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No firms found</td>
                  </tr>
                ) : (
                  data.items.map((firm) => (
                    <tr key={firm.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{firm.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          firm.firm_type === 'GP' ? 'bg-blue-500/20 text-blue-400' :
                          firm.firm_type === 'LP' ? 'bg-green-500/20 text-green-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {firm.firm_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{firm.institution_type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {[firm.headquarters_city, firm.headquarters_country].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatAUM(firm.aum_usd)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatAUM(firm.dry_powder_usd)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-center">{firm.year_founded || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 text-center">{firm.fund_count || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {firm.website ? (
                          <a
                            href={firm.website.startsWith('http') ? firm.website : `https://${firm.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300"
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </a>
                        ) : '-'}
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
