import { useState, useRef, useEffect } from 'react';
import { Search, X, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { Fund } from '@/types/fund';
import { useFundSearch, formatAUM } from '@/services/fundsApi';

interface FundSearchBarProps {
  selectedFund: Fund | null;
  onFundChange: (fund: Fund | null) => void;
  className?: string;
}

export function FundSearchBar({
  selectedFund,
  onFundChange,
  className = '',
}: FundSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use cached search with React Query
  const { data, isLoading, error } = useFundSearch({
    search: debouncedQuery,
    limit: 50,
    offset: 0,
    sort_by: 'name',
    order: 'asc',
  });

  // Filter out already selected fund
  const filteredFunds = data?.funds.filter(f => f.id !== selectedFund?.id) ?? [];

  // Show dropdown when we have results
  useEffect(() => {
    setShowDropdown(filteredFunds.length > 0 && searchQuery.length > 0);
  }, [filteredFunds, searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredFunds.length === 0) {
      if (e.key === 'Backspace' && searchQuery === '' && selectedFund) {
        // Remove selected fund
        onFundChange(null);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev =>
          prev < filteredFunds.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredFunds.length) {
          handleSelectFund(filteredFunds[focusedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setFocusedIndex(-1);
        break;
    }
  };

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  const handleSelectFund = (fund: Fund) => {
    onFundChange(fund);
    setSearchQuery('');
    setShowDropdown(false);
    setFocusedIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleRemoveFund = () => {
    onFundChange(null);
    searchInputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(value.trim().length > 0);
    setFocusedIndex(-1);
  };

  const isSelected = !!selectedFund;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Fund Chip */}
      {selectedFund && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-white text-sm transition-all hover:bg-blue-500/30 group">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{selectedFund.name}</span>
            {selectedFund.aum_raw && (
              <span className="text-xs text-slate-400">({selectedFund.aum_raw})</span>
            )}
            <button
              onClick={handleRemoveFund}
              className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 transition-colors"
              aria-label={`Remove ${selectedFund.name}`}
            >
              <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          {isLoading && (
            <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400 animate-spin" />
          )}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => searchQuery && filteredFunds.length > 0 && setShowDropdown(true)}
            placeholder={
              isSelected
                ? 'Search to change fund...'
                : 'Search for funds...'
            }
            className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all"
            aria-label="Search for funds"
            aria-expanded={showDropdown}
            aria-controls="fund-dropdown"
            role="combobox"
            aria-autocomplete="list"
            aria-activedescendant={
              focusedIndex >= 0 ? `fund-option-${focusedIndex}` : undefined
            }
          />
        </div>

        {/* Dropdown Results */}
        {showDropdown && filteredFunds.length > 0 && (
          <div
            ref={dropdownRef}
            id="fund-dropdown"
            role="listbox"
            className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/20 rounded-lg shadow-xl shadow-black/20 max-h-80 overflow-y-auto"
          >
            {filteredFunds.map((fund, index) => (
              <button
                key={fund.id}
                id={`fund-option-${index}`}
                role="option"
                aria-selected={index === focusedIndex}
                onClick={() => handleSelectFund(fund)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-700/50 transition-colors text-left ${
                  index === focusedIndex ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-md bg-blue-500/20 flex-shrink-0 flex items-center justify-center mt-0.5 border border-blue-500/30">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-semibold text-white truncate">{fund.name}</h3>
                    {fund.aum_raw && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {fund.aum_raw}
                      </span>
                    )}
                  </div>
                  {fund.strategy && (
                    <p className="text-xs text-blue-400 mt-0.5">
                      {fund.strategy}
                    </p>
                  )}
                  {fund.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {fund.description}
                    </p>
                  )}
                  {fund.headquarters && (
                    <p className="text-xs text-slate-500 mt-1">
                      {fund.headquarters}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && !isLoading && (
          <div className="absolute z-50 w-full mt-2 bg-red-900/20 border border-red-700/30 rounded-lg shadow-xl shadow-black/20 p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error instanceof Error ? error.message : 'Failed to search funds'}</p>
            </div>
          </div>
        )}

        {/* No Results Message */}
        {!isLoading && !error && showDropdown && searchQuery && filteredFunds.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/20 rounded-lg shadow-xl shadow-black/20 p-4 text-center">
            <p className="text-slate-400 text-sm">No funds found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
