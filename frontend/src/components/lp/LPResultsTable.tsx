import { Building2, AlertCircle, MapPin, DollarSign } from 'lucide-react';
import type { LP } from '@/types/lp';
import { formatCommitment } from '@/services/lpsApi';

interface LPResultsTableProps {
  lps: LP[];
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  className?: string;
}

/**
 * Get badge color classes for relationship status
 */
function getStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case 'Active':
      return 'bg-green-500/20 text-green-400';
    case 'Prospective':
      return 'bg-blue-500/20 text-blue-400';
    case 'Inactive':
      return 'bg-gray-500/20 text-gray-400';
    case 'Former':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}

/**
 * Get badge color classes for tier
 */
function getTierBadgeClass(tier: string | undefined): string {
  switch (tier) {
    case 'Tier 1':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Tier 2':
      return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    case 'Tier 3':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

/**
 * Loading skeleton for the table
 */
function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b border-slate-700/20"
        >
          <div className="w-10 h-10 bg-slate-700/50 rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700/50 rounded w-1/4" />
            <div className="h-3 bg-slate-700/50 rounded w-1/2" />
          </div>
          <div className="w-20 h-4 bg-slate-700/50 rounded" />
          <div className="w-20 h-4 bg-slate-700/50 rounded" />
        </div>
      ))}
    </div>
  );
}

export function LPResultsTable({
  lps,
  isLoading = false,
  error = null,
  emptyMessage = 'No LPs found',
  className = '',
}: LPResultsTableProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={`bg-slate-800/30 border border-slate-700/20 rounded-lg overflow-hidden ${className}`}
      >
        <TableSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-700/30 rounded-lg p-8 ${className}`}>
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold mb-1">Failed to load LPs</h3>
            <p className="text-sm text-red-300">
              {error.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (lps.length === 0) {
    return (
      <div
        className={`bg-slate-800/30 border border-slate-700/20 rounded-lg p-12 text-center ${className}`}
      >
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-white font-semibold mb-1">No LPs Found</h3>
        <p className="text-slate-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  // Table view
  return (
    <div
      className={`bg-slate-800/30 border border-slate-700/20 rounded-lg overflow-hidden ${className}`}
    >
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/20 bg-slate-800/50">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                Name
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                Type
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                Location
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-300">
                Commitment
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">
                Status
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {lps.map((lp) => (
              <tr
                key={lp.id}
                className="border-b border-slate-700/10 hover:bg-slate-700/30 transition-colors"
              >
                {/* LP Name */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{lp.name}</h3>
                      {lp.primary_contact_name && (
                        <p className="text-xs text-slate-400 truncate">
                          {lp.primary_contact_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="py-3 px-4">
                  {lp.type ? (
                    <span className="text-sm text-slate-300">{lp.type}</span>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </td>

                {/* Location */}
                <td className="py-3 px-4">
                  {lp.location ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300 truncate max-w-[150px]">
                        {lp.location}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </td>

                {/* Commitment */}
                <td className="py-3 px-4 text-right">
                  {lp.total_committed_capital ? (
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="w-3 h-3 text-green-400" />
                      <span className="text-sm font-medium text-white">
                        {formatCommitment(lp.total_committed_capital)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3 px-4 text-center">
                  {lp.relationship_status ? (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(
                        lp.relationship_status
                      )}`}
                    >
                      {lp.relationship_status}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </td>

                {/* Tier */}
                <td className="py-3 px-4 text-center">
                  {lp.tier ? (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getTierBadgeClass(
                        lp.tier
                      )}`}
                    >
                      {lp.tier}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {lps.map((lp) => (
          <div
            key={lp.id}
            className="p-4 border-b border-slate-700/10 last:border-b-0 hover:bg-slate-700/30 transition-colors"
          >
            {/* LP Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-md bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-1">{lp.name}</h3>
                {lp.type && (
                  <span className="text-xs text-slate-400">{lp.type}</span>
                )}
              </div>
            </div>

            {/* LP Details */}
            <div className="space-y-2 text-sm">
              {lp.location && (
                <div className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-xs">{lp.location}</span>
                </div>
              )}
              {lp.primary_contact_name && (
                <p className="text-xs text-slate-400">
                  Contact: {lp.primary_contact_name}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/20">
                <div className="flex items-center gap-1 text-slate-300">
                  <DollarSign className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-medium">
                    {formatCommitment(lp.total_committed_capital)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {lp.relationship_status && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getStatusBadgeClass(
                        lp.relationship_status
                      )}`}
                    >
                      {lp.relationship_status}
                    </span>
                  )}
                  {lp.tier && (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getTierBadgeClass(
                        lp.tier
                      )}`}
                    >
                      {lp.tier}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Results Summary */}
      <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-700/20 text-center">
        <p className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{lps.length}</span>{' '}
          {lps.length === 1 ? 'LP' : 'LPs'}
        </p>
      </div>
    </div>
  );
}
