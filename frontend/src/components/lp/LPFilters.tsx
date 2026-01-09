import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import type { LPSearchParams, LP_TYPES, RELATIONSHIP_STATUSES, TIERS } from '@/types/lp';

interface LPFiltersProps {
  onFiltersChange: (filters: LPSearchParams) => void;
  className?: string;
}

// Predefined commitment options (in dollars)
const COMMITMENT_OPTIONS = [
  { label: 'Any', value: null },
  { label: '$1M', value: 1_000_000 },
  { label: '$5M', value: 5_000_000 },
  { label: '$10M', value: 10_000_000 },
  { label: '$25M', value: 25_000_000 },
  { label: '$50M', value: 50_000_000 },
  { label: '$100M', value: 100_000_000 },
  { label: '$250M', value: 250_000_000 },
  { label: '$500M', value: 500_000_000 },
  { label: '$1B', value: 1_000_000_000 },
];

const LP_TYPES_LIST = [
  'Individual',
  'Family Office',
  'Institution',
  'Corporate',
  'Foundation',
  'Government',
  'Other',
];

const RELATIONSHIP_STATUSES_LIST = ['Active', 'Prospective', 'Inactive', 'Former'];

const TIERS_LIST = ['Tier 1', 'Tier 2', 'Tier 3'];

const SORT_OPTIONS = [
  { label: 'Name (A-Z)', value: 'name', order: 'asc' as const },
  { label: 'Name (Z-A)', value: 'name', order: 'desc' as const },
  {
    label: 'Commitment (High to Low)',
    value: 'total_committed_capital',
    order: 'desc' as const,
  },
  {
    label: 'Commitment (Low to High)',
    value: 'total_committed_capital',
    order: 'asc' as const,
  },
  {
    label: 'Investment Year (Newest)',
    value: 'first_investment_year',
    order: 'desc' as const,
  },
  {
    label: 'Investment Year (Oldest)',
    value: 'first_investment_year',
    order: 'asc' as const,
  },
];

export function LPFilters({ onFiltersChange, className = '' }: LPFiltersProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [minCommitment, setMinCommitment] = useState<number | null>(null);
  const [maxCommitment, setMaxCommitment] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<{ sort_by: string; order: 'asc' | 'desc' }>(
    SORT_OPTIONS[0]
  );
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Update parent whenever filters change
  useEffect(() => {
    const filters: LPSearchParams = {
      type: selectedType || undefined,
      tier: selectedTier || undefined,
      relationship_status: selectedStatus || undefined,
      location: location || undefined,
      min_commitment: minCommitment ?? undefined,
      max_commitment: maxCommitment ?? undefined,
      sort_by: sortBy.sort_by as any,
      order: sortBy.order,
    };
    onFiltersChange(filters);
  }, [
    selectedType,
    selectedTier,
    selectedStatus,
    location,
    minCommitment,
    maxCommitment,
    sortBy,
    onFiltersChange,
  ]);

  const handleClearAll = () => {
    setSelectedType('');
    setSelectedTier('');
    setSelectedStatus('');
    setLocation('');
    setMinCommitment(null);
    setMaxCommitment(null);
    setSortBy(SORT_OPTIONS[0]);
  };

  const activeFilterCount =
    (selectedType ? 1 : 0) +
    (selectedTier ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (location ? 1 : 0) +
    (minCommitment !== null ? 1 : 0) +
    (maxCommitment !== null ? 1 : 0);

  return (
    <div
      className={`bg-slate-800/30 border border-slate-700/20 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <h3 className="text-white font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Type Filter */}
        <div className="relative">
          <label className="block text-sm text-slate-400 mb-2">Type</label>
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors flex items-center justify-between"
          >
            <span className="truncate">{selectedType || 'All Types'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showTypeDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showTypeDropdown && (
            <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedType('');
                  setShowTypeDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                  selectedType === '' ? 'bg-slate-700/30 text-white' : 'text-slate-300'
                }`}
              >
                All Types
              </button>
              {LP_TYPES_LIST.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setShowTypeDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    selectedType === type
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tier Filter */}
        <div className="relative">
          <label className="block text-sm text-slate-400 mb-2">Tier</label>
          <button
            onClick={() => setShowTierDropdown(!showTierDropdown)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors flex items-center justify-between"
          >
            <span className="truncate">{selectedTier || 'All Tiers'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showTierDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showTierDropdown && (
            <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedTier('');
                  setShowTierDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                  selectedTier === '' ? 'bg-slate-700/30 text-white' : 'text-slate-300'
                }`}
              >
                All Tiers
              </button>
              {TIERS_LIST.map((tier) => (
                <button
                  key={tier}
                  onClick={() => {
                    setSelectedTier(tier);
                    setShowTierDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    selectedTier === tier
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-300'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Relationship Status Filter */}
        <div className="relative">
          <label className="block text-sm text-slate-400 mb-2">Relationship Status</label>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors flex items-center justify-between"
          >
            <span className="truncate">{selectedStatus || 'All Statuses'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showStatusDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showStatusDropdown && (
            <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedStatus('');
                  setShowStatusDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                  selectedStatus === ''
                    ? 'bg-slate-700/30 text-white'
                    : 'text-slate-300'
                }`}
              >
                All Statuses
              </button>
              {RELATIONSHIP_STATUSES_LIST.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setSelectedStatus(status);
                    setShowStatusDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    selectedStatus === status
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location Filter */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors placeholder-slate-500"
          />
        </div>

        {/* Min Commitment */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Min Commitment</label>
          <select
            value={minCommitment ?? ''}
            onChange={(e) =>
              setMinCommitment(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors"
          >
            {COMMITMENT_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Max Commitment */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Max Commitment</label>
          <select
            value={maxCommitment ?? ''}
            onChange={(e) =>
              setMaxCommitment(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors"
          >
            {COMMITMENT_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort By - Full Width Below */}
      <div className="mt-4">
        <label className="block text-sm text-slate-400 mb-2">Sort By</label>
        <select
          value={SORT_OPTIONS.findIndex(
            (opt) => opt.value === sortBy.sort_by && opt.order === sortBy.order
          )}
          onChange={(e) => setSortBy(SORT_OPTIONS[Number(e.target.value)])}
          className="w-full md:w-auto px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-white text-sm hover:border-slate-600 transition-colors"
        >
          {SORT_OPTIONS.map((option, index) => (
            <option key={index} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
