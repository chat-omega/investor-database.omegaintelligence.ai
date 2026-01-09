import { useState } from 'react';
import { Search, TrendingUp, Calendar, DollarSign, BarChart } from 'lucide-react';
import type { LPHolding } from '@/types/lp';
import { formatCommitment } from '@/services/lpsApi';

interface LPHoldingsTableProps {
  holdings: LPHolding[];
  isLoading: boolean;
  stats?: {
    total_capital_committed: number;
    total_capital_contributed: number;
    total_capital_distributed: number;
    total_market_value: number;
    average_irr: number;
    count: number;
  };
}

export function LPHoldingsTable({
  holdings,
  isLoading,
  stats,
}: LPHoldingsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'fund_name' | 'vintage' | 'capital_committed' | 'market_value' | 'inception_irr'>('vintage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter holdings based on search term
  const filteredHoldings = holdings.filter(holding =>
    holding.fund_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    holding.vintage?.toString().includes(searchTerm)
  );

  // Sort holdings
  const sortedHoldings = [...filteredHoldings].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'fund_name':
        compareValue = (a.fund_name || '').localeCompare(b.fund_name || '');
        break;
      case 'vintage':
        compareValue = (a.vintage || 0) - (b.vintage || 0);
        break;
      case 'capital_committed':
        compareValue = (a.capital_committed || 0) - (b.capital_committed || 0);
        break;
      case 'market_value':
        compareValue = (a.market_value || 0) - (b.market_value || 0);
        break;
      case 'inception_irr':
        compareValue = (a.inception_irr || 0) - (b.inception_irr || 0);
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number | undefined, rawValue?: string | undefined): string => {
    if (rawValue) return rawValue;
    if (!value && value !== 0) return 'N/A';
    if (value === 0) return '-';
    return formatCommitment(value);
  };

  const formatIRR = (irr: number | undefined): string => {
    if (irr === undefined || irr === null) return 'N/A';
    return `${irr.toFixed(2)}%`;
  };

  const getIRRColor = (irr: number | undefined): string => {
    if (!irr) return 'text-slate-400';
    if (irr > 15) return 'text-green-400';
    if (irr > 10) return 'text-blue-400';
    if (irr > 5) return 'text-yellow-400';
    if (irr < 0) return 'text-red-400';
    return 'text-slate-300';
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return null;
    return (
      <span className="ml-1 text-blue-400">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading holdings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Summary Cards */}
      {stats && (
        <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Committed</div>
              <div className="text-lg font-semibold text-white">{formatCommitment(stats.total_capital_committed)}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Contributed</div>
              <div className="text-lg font-semibold text-white">{formatCommitment(stats.total_capital_contributed)}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Distributed</div>
              <div className="text-lg font-semibold text-white">{formatCommitment(stats.total_capital_distributed)}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Market Value</div>
              <div className="text-lg font-semibold text-green-400">{formatCommitment(stats.total_market_value)}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg IRR</div>
              <div className={`text-lg font-semibold ${getIRRColor(stats.average_irr)}`}>{formatIRR(stats.average_irr)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Title Section */}
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-bold text-white">Portfolio Holdings</h2>
              <p className="text-sm text-slate-400">
                {sortedHoldings.length} holdings
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by fund name or vintage..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-md pl-10 pr-4 py-3 w-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('fund_name')}
              >
                Fund Name <SortIcon column="fund_name" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('vintage')}
              >
                Vintage <SortIcon column="vintage" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('capital_committed')}
              >
                Committed <SortIcon column="capital_committed" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Contributed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Distributed
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('market_value')}
              >
                Market Value <SortIcon column="market_value" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('inception_irr')}
              >
                IRR <SortIcon column="inception_irr" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedHoldings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <BarChart className="w-12 h-12 text-slate-600" />
                    <p className="text-slate-400">
                      {searchTerm ? 'No holdings match your search' : 'No holdings data available'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedHoldings.map((holding) => (
                <tr key={holding.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{holding.fund_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-sm text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{holding.vintage || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-white font-medium">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span>{formatCurrency(holding.capital_committed, holding.capital_committed_raw)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">
                      {formatCurrency(holding.capital_contributed, holding.capital_contributed_raw)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">
                      {formatCurrency(holding.capital_distributed, holding.capital_distributed_raw)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-green-400">
                      {formatCurrency(holding.market_value, holding.market_value_raw)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <BarChart className={`w-4 h-4 ${getIRRColor(holding.inception_irr)}`} />
                      <span className={`text-sm font-semibold ${getIRRColor(holding.inception_irr)}`}>
                        {formatIRR(holding.inception_irr)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {sortedHoldings.length > 0 && (
        <div className="px-6 py-5 border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-6 text-sm text-slate-400">
              <div className="flex items-center space-x-2">
                <span>
                  Showing <span className="font-semibold text-white">{filteredHoldings.length}</span> of{' '}
                  <span className="font-semibold text-white">{holdings.length}</span> holdings
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
