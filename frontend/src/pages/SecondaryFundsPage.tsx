import { useState } from 'react';
import { Database, Building2, Users, MessageSquare, TrendingUp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useSecondaryFunds,
  useSecondaryGPs,
  useSecondaryLPs,
  useSecondaryStats,
  useNLQ,
  useStatuses,
  useStrategies,
  useSectors,
  type FundsParams,
  type GPsParams,
  type LPsParams,
} from '@/services/secondaryFundsApi';
import type { FundStatusFilter, StrategyFilter, SectorFilter } from '@/types/secondaryFund';

type TabType = 'funds' | 'gps' | 'lps' | 'nlq';

export function SecondaryFundsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('funds');

  // Funds tab state
  const [fundsParams, setFundsParams] = useState<FundsParams>({ page: 1, page_size: 20 });
  const [fundsSearch, setFundsSearch] = useState('');

  // GPs tab state
  const [gpsParams, setGpsParams] = useState<GPsParams>({ page: 1, page_size: 20 });
  const [gpsSearch, setGpsSearch] = useState('');

  // LPs tab state
  const [lpsParams, setLpsParams] = useState<LPsParams>({ page: 1, page_size: 20 });
  const [lpsSearch, setLpsSearch] = useState('');

  // NLQ tab state
  const [nlqQuestion, setNlqQuestion] = useState('');

  // Fetch data
  const { data: fundsData, isLoading: fundsLoading } = useSecondaryFunds(fundsParams);
  const { data: gpsData, isLoading: gpsLoading } = useSecondaryGPs(gpsParams);
  const { data: lpsData, isLoading: lpsLoading } = useSecondaryLPs(lpsParams);
  const { data: stats } = useSecondaryStats();
  const { data: statusesData } = useStatuses();
  const { data: strategiesData } = useStrategies();
  const { data: sectorsData } = useSectors();
  const nlqMutation = useNLQ();

  // Handlers
  const handleFundsSearch = () => {
    setFundsParams(prev => ({ ...prev, search: fundsSearch, page: 1 }));
  };

  const handleGpsSearch = () => {
    setGpsParams(prev => ({ ...prev, search: gpsSearch, page: 1 }));
  };

  const handleLpsSearch = () => {
    setLpsParams(prev => ({ ...prev, search: lpsSearch, page: 1 }));
  };

  const handleNlqSubmit = () => {
    if (nlqQuestion.trim()) {
      nlqMutation.mutate(nlqQuestion);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatCurrency = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}B`;
    return `$${num.toFixed(0)}M`;
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return `${num.toFixed(1)}%`;
  };

  const formatMultiple = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return `${num.toFixed(2)}x`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Secondary Funds Database</h1>
              <p className="text-sm text-slate-400">LP/GP/Fund Data</p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center space-x-6 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_funds)}</div>
                <div className="text-slate-400">Funds</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_gps)}</div>
                <div className="text-slate-400">GPs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">{formatNumber(stats.total_lps)}</div>
                <div className="text-slate-400">LPs</div>
              </div>
              {stats.avg_irr && (
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{formatPercent(stats.avg_irr)}</div>
                  <div className="text-slate-400">Avg IRR</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/20">
        {[
          { id: 'funds' as TabType, label: 'Funds', icon: TrendingUp },
          { id: 'gps' as TabType, label: 'GPs', icon: Building2 },
          { id: 'lps' as TabType, label: 'LPs', icon: Users },
          { id: 'nlq' as TabType, label: 'NLQ Query', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Funds Tab */}
        {activeTab === 'funds' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search funds..."
                  value={fundsSearch}
                  onChange={(e) => setFundsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFundsSearch()}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={fundsParams.status || ''}
                onChange={(e) => setFundsParams(prev => ({ ...prev, status: e.target.value as FundStatusFilter || undefined, page: 1 }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                {statusesData?.statuses.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <select
                value={fundsParams.strategy || ''}
                onChange={(e) => setFundsParams(prev => ({ ...prev, strategy: e.target.value as StrategyFilter || undefined, page: 1 }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Strategies</option>
                {strategiesData?.strategies.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <select
                value={fundsParams.sector || ''}
                onChange={(e) => setFundsParams(prev => ({ ...prev, sector: e.target.value as SectorFilter || undefined, page: 1 }))}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Sectors</option>
                {sectorsData?.sectors.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleFundsSearch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Search
              </button>
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Fund Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Manager</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Vintage</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">IRR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">TVPI</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">DPI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {fundsLoading ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                    ) : fundsData?.items.map((fund) => (
                      <tr key={fund.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{fund.fund_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{fund.fund_manager_name || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            fund.status === 'Closed' ? 'bg-emerald-500/20 text-emerald-400' :
                            fund.status?.includes('In Market') ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {fund.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{fund.vintage_year || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatCurrency(fund.fund_size_usd)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={fund.irr && fund.irr > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                            {formatPercent(fund.irr)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatMultiple(fund.tvpi)}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatMultiple(fund.dpi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {fundsData && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    Showing {((fundsData.page - 1) * fundsData.page_size) + 1} to {Math.min(fundsData.page * fundsData.page_size, fundsData.total)} of {fundsData.total}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setFundsParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                      disabled={fundsData.page <= 1}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-sm text-white">Page {fundsData.page} of {fundsData.pages}</span>
                    <button
                      onClick={() => setFundsParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                      disabled={fundsData.page >= fundsData.pages}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GPs Tab */}
        {activeTab === 'gps' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search GPs..."
                  value={gpsSearch}
                  onChange={(e) => setGpsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGpsSearch()}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleGpsSearch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Search
              </button>
            </div>

            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Institution Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Country</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">AUM</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Funds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {gpsLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                    ) : gpsData?.items.map((gp) => (
                      <tr key={gp.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{gp.institution_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{gp.institution_type || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{gp.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{gp.country || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatCurrency(gp.aum_usd)}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{gp.fund_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {gpsData && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    Showing {((gpsData.page - 1) * gpsData.page_size) + 1} to {Math.min(gpsData.page * gpsData.page_size, gpsData.total)} of {gpsData.total}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setGpsParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                      disabled={gpsData.page <= 1}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-sm text-white">Page {gpsData.page} of {gpsData.pages}</span>
                    <button
                      onClick={() => setGpsParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                      disabled={gpsData.page >= gpsData.pages}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LPs Tab */}
        {activeTab === 'lps' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search LPs..."
                  value={lpsSearch}
                  onChange={(e) => setLpsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLpsSearch()}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={handleLpsSearch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Search
              </button>
            </div>

            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Institution Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Country</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">AUM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {lpsLoading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                    ) : lpsData?.items.map((lp) => (
                      <tr key={lp.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-white font-medium">{lp.institution_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{lp.institution_type || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{lp.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{lp.country || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-300 text-right">{formatCurrency(lp.aum_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {lpsData && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="text-sm text-slate-400">
                    Showing {((lpsData.page - 1) * lpsData.page_size) + 1} to {Math.min(lpsData.page * lpsData.page_size, lpsData.total)} of {lpsData.total}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setLpsParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                      disabled={lpsData.page <= 1}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-sm text-white">Page {lpsData.page} of {lpsData.pages}</span>
                    <button
                      onClick={() => setLpsParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                      disabled={lpsData.page >= lpsData.pages}
                      className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NLQ Tab */}
        {activeTab === 'nlq' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Natural Language Query</h3>
              <p className="text-sm text-slate-400 mb-4">
                Ask questions about the secondary funds database in plain English. Examples:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  'Show me all GP-led funds with IRR > 15%',
                  'What are the top 10 funds by size?',
                  'List LPs from United States',
                  'Show funds by Lexington Partners',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setNlqQuestion(example)}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 rounded-full transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Ask a question about the database..."
                  value={nlqQuestion}
                  onChange={(e) => setNlqQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNlqSubmit()}
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleNlqSubmit}
                  disabled={nlqMutation.isPending || !nlqQuestion.trim()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{nlqMutation.isPending ? 'Querying...' : 'Ask'}</span>
                </button>
              </div>
            </div>

            {nlqMutation.data && (
              <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-6">
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Generated SQL:</h4>
                  <pre className="bg-slate-900 p-3 rounded text-sm text-emerald-400 overflow-x-auto">
                    {nlqMutation.data.sql}
                  </pre>
                </div>
                {nlqMutation.data.error ? (
                  <div className="text-red-400 text-sm">{nlqMutation.data.error}</div>
                ) : (
                  <>
                    <div className="text-sm text-slate-400 mb-2">
                      {nlqMutation.data.results.length} results in {nlqMutation.data.execution_time.toFixed(3)}s
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-800">
                          <tr>
                            {nlqMutation.data.results[0] && Object.keys(nlqMutation.data.results[0]).map((key) => (
                              <th key={key} className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {nlqMutation.data.results.slice(0, 50).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-700/30">
                              {Object.values(row).map((value, j) => (
                                <td key={j} className="px-4 py-2 text-sm text-slate-300">
                                  {String(value ?? '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
