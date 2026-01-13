import { useState, useMemo } from 'react';
import { Search, Building2, Briefcase, ArrowLeftRight, Factory, UserCircle, Loader2 } from 'lucide-react';
import { usePreqinSearch, formatAUM } from '@/services/preqinApi';
import type { EntityType, SearchResult } from '@/types/preqin';

const entityTypeConfig: Record<EntityType, { icon: React.ElementType; label: string; color: string }> = {
  firm: { icon: Building2, label: 'Firms', color: 'bg-blue-500/20 text-blue-400' },
  fund: { icon: Briefcase, label: 'Funds', color: 'bg-green-500/20 text-green-400' },
  deal: { icon: ArrowLeftRight, label: 'Deals', color: 'bg-amber-500/20 text-amber-400' },
  company: { icon: Factory, label: 'Companies', color: 'bg-purple-500/20 text-purple-400' },
  person: { icon: UserCircle, label: 'People', color: 'bg-pink-500/20 text-pink-400' },
};

export function PreqinSearchPage() {
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>(['firm', 'fund', 'deal']);

  const searchMutation = usePreqinSearch();

  const handleSearch = () => {
    if (query.trim()) {
      searchMutation.mutate({
        query: query.trim(),
        entity_types: selectedTypes.length > 0 ? selectedTypes : undefined,
        limit: 50,
        use_semantic: true,
      });
    }
  };

  const toggleEntityType = (type: EntityType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const groupedResults = useMemo(() => {
    if (!searchMutation.data) return {};
    return searchMutation.data.results.reduce((acc, result) => {
      if (!acc[result.entity_type]) acc[result.entity_type] = [];
      acc[result.entity_type].push(result);
      return acc;
    }, {} as Record<EntityType, SearchResult[]>);
  }, [searchMutation.data]);

  const renderResultCard = (result: SearchResult) => {
    const config = entityTypeConfig[result.entity_type];
    const Icon = config.icon;
    const metadata = result.metadata || {};

    return (
      <div
        key={`${result.entity_type}-${result.entity_id}`}
        className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-700/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-white font-medium truncate">{result.title}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                {config.label.slice(0, -1)}
              </span>
            </div>
            {result.snippet && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{result.snippet}</p>
            )}
            <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
              <span>Score: {(result.score * 100).toFixed(1)}%</span>
              {typeof metadata.aum_usd === 'number' && <span>AUM: {formatAUM(metadata.aum_usd)}</span>}
              {typeof metadata.country === 'string' && <span>{metadata.country}</span>}
              {typeof metadata.strategy === 'string' && <span>{metadata.strategy}</span>}
              {typeof metadata.industry === 'string' && <span>{metadata.industry}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-slate-900 px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Preqin Search</h1>
            <p className="text-sm text-slate-400">Hybrid Search Across All Entities</p>
          </div>
        </div>
      </div>

      {/* Search Area */}
      <div className="px-6 py-6 border-b border-slate-700/20">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search for firms, funds, deals, companies, or people..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Entity Type Toggles */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(entityTypeConfig) as [EntityType, typeof entityTypeConfig[EntityType]][]).map(([type, config]) => {
              const Icon = config.icon;
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleEntityType(type)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center space-x-2"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Search</span>
              </>
            )}
          </button>

          {/* Example Queries */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-500">Try:</span>
            {[
              'Blackstone private equity',
              'technology buyout deals',
              'venture capital Europe',
              'pension fund investors',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-6">
        {searchMutation.data && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Results Summary */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Found {searchMutation.data.total} results for "{searchMutation.data.query}"
              </div>
              <div className="text-sm text-slate-500">
                Search type: {searchMutation.data.search_type}
              </div>
            </div>

            {/* Grouped Results */}
            {(Object.entries(groupedResults) as [EntityType, SearchResult[]][]).map(([type, results]) => {
              const config = entityTypeConfig[type];
              const Icon = config.icon;

              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-slate-400" />
                    <h2 className="text-lg font-semibold text-white">{config.label}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">
                      {results.length}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {results.map(renderResultCard)}
                  </div>
                </div>
              );
            })}

            {/* No Results */}
            {searchMutation.data.results.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
                <p className="text-slate-400">Try adjusting your search terms or entity type filters</p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!searchMutation.data && !searchMutation.isPending && (
          <div className="max-w-4xl mx-auto text-center py-12">
            <Search className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Search Preqin Data</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Use hybrid search to find firms, funds, deals, companies, and people across the Preqin database.
              Combines full-text, fuzzy, and semantic search for best results.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
