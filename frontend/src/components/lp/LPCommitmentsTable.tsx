import { useState } from 'react';
import { Search, Edit, Trash2, Plus, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { LP, FundCommitment } from '@/types/lp';
import { formatCommitment } from '@/services/lpsApi';

interface LPCommitmentsTableProps {
  lp: LP | null;
  commitments: FundCommitment[];
  onAdd: () => void;
  onEdit: (commitment: FundCommitment) => void;
  onDelete: (commitmentId: string) => void;
}

export function LPCommitmentsTable({
  lp,
  commitments,
  onAdd,
  onEdit,
  onDelete,
}: LPCommitmentsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'fund_name' | 'commitment_date' | 'commitment_amount' | 'percent_called'>('commitment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter commitments based on search term
  const filteredCommitments = commitments.filter(commitment =>
    commitment.fund_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    commitment.fund_strategy?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort commitments
  const sortedCommitments = [...filteredCommitments].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'fund_name':
        compareValue = (a.fund_name || '').localeCompare(b.fund_name || '');
        break;
      case 'commitment_date':
        compareValue = (a.commitment_date || '').localeCompare(b.commitment_date || '');
        break;
      case 'commitment_amount':
        compareValue = (a.commitment_amount || 0) - (b.commitment_amount || 0);
        break;
      case 'percent_called':
        compareValue = (a.percent_called || 0) - (b.percent_called || 0);
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

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string | undefined) => {
    const statusColors = {
      'Active': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Fully Called': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Cancelled': 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    const color = statusColors[status as keyof typeof statusColors] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';

    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${color}`}>
        {status || 'N/A'}
      </span>
    );
  };

  const getPercentCalledBar = (percentCalled: number | undefined) => {
    const percent = percentCalled || 0;
    const barColor = percent >= 75 ? 'bg-green-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-blue-500';

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 w-12 text-right">{percent.toFixed(1)}%</span>
      </div>
    );
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return null;
    return (
      <span className="ml-1 text-blue-400">
        {sortOrder === 'asc' ? '‘' : '“'}
      </span>
    );
  };

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Title Section */}
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-bold text-white">Fund Commitments</h2>
              <p className="text-sm text-slate-400">
                {lp ? `${lp.name} - ${commitments.length} commitments` : `${commitments.length} commitments`}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Add Button */}
        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by fund name or strategy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-md pl-10 pr-4 py-3 w-full text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={onAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Commitment</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('fund_name')}
              >
                Fund Name <SortIcon column="fund_name" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Strategy
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('commitment_amount')}
              >
                Commitment <SortIcon column="commitment_amount" />
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('commitment_date')}
              >
                Date <SortIcon column="commitment_date" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Capital Called
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors"
                onClick={() => handleSort('percent_called')}
              >
                % Called <SortIcon column="percent_called" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedCommitments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <TrendingUp className="w-12 h-12 text-slate-600" />
                    <p className="text-slate-400">
                      {searchTerm ? 'No commitments match your search' : 'No fund commitments yet'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={onAdd}
                        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                      >
                        Add First Commitment
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedCommitments.map((commitment) => (
                <tr key={commitment.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="font-medium text-white">{commitment.fund_name || 'Unknown Fund'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">{commitment.fund_strategy || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-white font-medium">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span>{commitment.commitment_amount_raw || formatCommitment(commitment.commitment_amount)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-sm text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{formatDate(commitment.commitment_date)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">
                      {commitment.capital_called_raw || formatCommitment(commitment.capital_called)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getPercentCalledBar(commitment.percent_called)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(commitment.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onEdit(commitment)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md transition-colors"
                        title="Edit commitment"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(commitment.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete commitment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {sortedCommitments.length > 0 && (
        <div className="px-6 py-5 border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-6 text-sm text-slate-400">
              <div className="flex items-center space-x-2">
                <span>
                  Showing <span className="font-semibold text-white">{filteredCommitments.length}</span> of{' '}
                  <span className="font-semibold text-white">{commitments.length}</span> commitments
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
