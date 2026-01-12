import { PieChart, Building2, Briefcase, ArrowLeftRight, Factory, UserCircle, TrendingUp, Globe, DollarSign } from 'lucide-react';
import { usePreqinStats, formatAUM, formatNumber } from '@/services/preqinApi';

export function PreqinStatsPage() {
  const { data: stats, isLoading } = usePreqinStats();

  const statCards = stats ? [
    { label: 'Total Firms', value: formatNumber(stats.total_firms), icon: Building2, color: 'from-blue-500 to-blue-600' },
    { label: 'GPs', value: formatNumber(stats.total_gps), icon: TrendingUp, color: 'from-green-500 to-green-600' },
    { label: 'LPs', value: formatNumber(stats.total_lps), icon: DollarSign, color: 'from-purple-500 to-purple-600' },
    { label: 'Total Funds', value: formatNumber(stats.total_funds), icon: Briefcase, color: 'from-amber-500 to-orange-600' },
    { label: 'Total Deals', value: formatNumber(stats.total_deals), icon: ArrowLeftRight, color: 'from-rose-500 to-rose-600' },
    { label: 'Companies', value: formatNumber(stats.total_companies), icon: Factory, color: 'from-cyan-500 to-cyan-600' },
    { label: 'People', value: formatNumber(stats.total_persons), icon: UserCircle, color: 'from-pink-500 to-pink-600' },
    { label: 'Total AUM', value: formatAUM(stats.total_aum_usd), icon: Globe, color: 'from-indigo-500 to-indigo-600' },
  ] : [];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
            <PieChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Preqin Stats Dashboard</h1>
            <p className="text-sm text-slate-400">Aggregate Statistics Overview</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading statistics...</div>
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">No statistics available</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">{stat.label}</p>
                        <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funds by Strategy */}
              {stats.funds_by_strategy && Object.keys(stats.funds_by_strategy).length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                    <Briefcase className="w-5 h-5 text-amber-400" />
                    <span>Funds by Strategy</span>
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(stats.funds_by_strategy)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([strategy, count]) => {
                        const total = Object.values(stats.funds_by_strategy!).reduce((a, b) => a + b, 0);
                        const percentage = (count / total) * 100;
                        return (
                          <div key={strategy} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{strategy}</span>
                              <span className="text-slate-400">{formatNumber(count)} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Firms by Country */}
              {stats.firms_by_country && Object.keys(stats.firms_by_country).length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    <span>Firms by Country</span>
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(stats.firms_by_country)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([country, count]) => {
                        const total = Object.values(stats.firms_by_country!).reduce((a, b) => a + b, 0);
                        const percentage = (count / total) * 100;
                        return (
                          <div key={country} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{country}</span>
                              <span className="text-slate-400">{formatNumber(count)} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Deals by Year */}
            {stats.deals_by_year && Object.keys(stats.deals_by_year).length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <ArrowLeftRight className="w-5 h-5 text-rose-400" />
                  <span>Deals by Year</span>
                </h3>
                <div className="overflow-x-auto">
                  <div className="flex items-end space-x-2 min-w-max h-48">
                    {Object.entries(stats.deals_by_year)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([year, count]) => {
                        const maxCount = Math.max(...Object.values(stats.deals_by_year!));
                        const height = (count / maxCount) * 100;
                        return (
                          <div key={year} className="flex flex-col items-center">
                            <div
                              className="w-12 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg transition-all duration-500 hover:from-rose-500 hover:to-rose-300"
                              style={{ height: `${height}%`, minHeight: '8px' }}
                              title={`${year}: ${formatNumber(count)} deals`}
                            />
                            <div className="text-xs text-slate-400 mt-2 -rotate-45 origin-top-left w-8">
                              {year}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6">
                <h4 className="text-sm text-blue-400 font-medium">GP / LP Ratio</h4>
                <p className="text-2xl font-bold text-white mt-2">
                  {stats.total_lps > 0 ? (stats.total_gps / stats.total_lps).toFixed(2) : '-'}
                </p>
                <p className="text-sm text-slate-400 mt-1">GPs per LP</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-xl p-6">
                <h4 className="text-sm text-amber-400 font-medium">Avg Funds per Firm</h4>
                <p className="text-2xl font-bold text-white mt-2">
                  {stats.total_firms > 0 ? (stats.total_funds / stats.total_firms).toFixed(1) : '-'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Funds managed per firm</p>
              </div>
              <div className="bg-gradient-to-br from-rose-500/20 to-rose-600/20 border border-rose-500/30 rounded-xl p-6">
                <h4 className="text-sm text-rose-400 font-medium">Deals per Company</h4>
                <p className="text-2xl font-bold text-white mt-2">
                  {stats.total_companies > 0 ? (stats.total_deals / stats.total_companies).toFixed(1) : '-'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Average transactions</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
