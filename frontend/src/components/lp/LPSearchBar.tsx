import { useState, useRef, useEffect } from 'react';
import { Search, X, Users, Loader2, AlertCircle } from 'lucide-react';
import { LP } from '@/types/lp';
import { useLPSearch } from '@/services/lpsApi';

interface LPSearchBarProps {
  selectedLP: LP | null;
  onLPChange: (lp: LP | null) => void;
  className?: string;
}

export function LPSearchBar({
  selectedLP,
  onLPChange,
  className = '',
}: LPSearchBarProps) {
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
  const { data, isLoading, error } = useLPSearch({
    search: debouncedQuery,
    limit: 50,
    offset: 0,
    sort_by: 'name',
    order: 'asc',
  });

  // Filter out already selected LP
  const filteredLPs = data?.lps.filter(l => l.id !== selectedLP?.id) ?? [];

  // Show dropdown when we have results
  useEffect(() => {
    setShowDropdown(filteredLPs.length > 0 && searchQuery.length > 0);
  }, [filteredLPs, searchQuery]);

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
    if (!showDropdown || filteredLPs.length === 0) {
      if (e.key === 'Backspace' && searchQuery === '' && selectedLP) {
        // Remove selected LP
        onLPChange(null);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev =>
          prev < filteredLPs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredLPs.length) {
          handleSelectLP(filteredLPs[focusedIndex]);
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

  const handleSelectLP = (lp: LP) => {
    onLPChange(lp);
    setSearchQuery('');
    setShowDropdown(false);
    setFocusedIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleRemoveLP = () => {
    onLPChange(null);
    searchInputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(value.trim().length > 0);
    setFocusedIndex(-1);
  };

  const isSelected = !!selectedLP;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected LP Chip */}
      {selectedLP && (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-white text-sm transition-all hover:bg-blue-500/30 group">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{selectedLP.name}</span>
            {selectedLP.total_committed_capital_raw && (
              <span className="text-xs text-slate-400">({selectedLP.total_committed_capital_raw})</span>
            )}
            <button
              onClick={handleRemoveLP}
              className="ml-1 p-0.5 rounded-full hover:bg-red-500/20 transition-colors"
              aria-label={`Remove ${selectedLP.name}`}
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
            onFocus={() => searchQuery && filteredLPs.length > 0 && setShowDropdown(true)}
            placeholder={
              isSelected
                ? 'Search to change LP...'
                : 'Search for LPs...'
            }
            className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 transition-all"
            aria-label="Search for LPs"
            aria-expanded={showDropdown}
            aria-controls="lp-dropdown"
            role="combobox"
            aria-autocomplete="list"
            aria-activedescendant={
              focusedIndex >= 0 ? `lp-option-${focusedIndex}` : undefined
            }
          />
        </div>

        {/* Dropdown Results */}
        {showDropdown && filteredLPs.length > 0 && (
          <div
            ref={dropdownRef}
            id="lp-dropdown"
            role="listbox"
            className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/20 rounded-lg shadow-xl shadow-black/20 max-h-80 overflow-y-auto"
          >
            {filteredLPs.map((lp, index) => (
              <button
                key={lp.id}
                id={`lp-option-${index}`}
                role="option"
                aria-selected={index === focusedIndex}
                onClick={() => handleSelectLP(lp)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-700/50 transition-colors text-left ${
                  index === focusedIndex ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-md bg-blue-500/20 flex-shrink-0 flex items-center justify-center mt-0.5 border border-blue-500/30">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-semibold text-white truncate">{lp.name}</h3>
                    {lp.total_committed_capital_raw && (
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {lp.total_committed_capital_raw}
                      </span>
                    )}
                  </div>
                  {lp.type && (
                    <p className="text-xs text-blue-400 mt-0.5">
                      {lp.type}
                    </p>
                  )}
                  {lp.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {lp.description}
                    </p>
                  )}
                  {lp.location && (
                    <p className="text-xs text-slate-500 mt-1">
                      {lp.location}
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
              <p className="text-sm">{error instanceof Error ? error.message : 'Failed to search LPs'}</p>
            </div>
          </div>
        )}

        {/* No Results Message */}
        {!isLoading && !error && showDropdown && searchQuery && filteredLPs.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700/20 rounded-lg shadow-xl shadow-black/20 p-4 text-center">
            <p className="text-slate-400 text-sm">No LPs found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
