import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { LPSearchBar } from '@/components/lp/LPSearchBar';
import { LPAnalyticsChat } from '@/components/lp/LPAnalyticsChat';
import { LPHoldingsTable } from '@/components/lp/LPHoldingsTable';
import { useHoldings, useHoldingsStats, useLPSearch } from '@/services/lpsApi';
import type { LP } from '@/types/lp';

type TabType = 'research' | 'holdings';

export function LPDatabasePage() {
  // LP selection state
  const [selectedLP, setSelectedLP] = useState<LP | null>(null);

  // Tab state - default to holdings when LP is selected
  const [activeTab, setActiveTab] = useState<TabType>('holdings');

  // Fetch CALSTRS LP for default loading
  const { data: calstrsSearch } = useLPSearch({
    search: 'CALSTRS',
    limit: 1
  });

  // Fetch holdings data filtered by selected LP
  const { data: holdingsResponse, isLoading: holdingsLoading } = useHoldings({
    lp_id: selectedLP?.id,
    limit: 1000
  });
  const { data: holdingsStats } = useHoldingsStats(selectedLP?.id);

  // Load CALSTRS by default on mount
  useEffect(() => {
    // Only load default if nothing is selected yet
    if (!selectedLP && calstrsSearch?.lps && calstrsSearch.lps.length > 0) {
      const calstrsLP = calstrsSearch.lps[0];
      setSelectedLP(calstrsLP);
      setActiveTab('holdings');
    }
  }, [calstrsSearch, selectedLP]);

  // Handle LP selection from search bar
  const handleLPChange = (lp: LP | null) => {
    setSelectedLP(lp);
    // Switch to holdings tab when an LP is selected
    if (lp) {
      setActiveTab('holdings');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* LP Search Bar - at top */}
      <div className="border-b border-slate-700/20 bg-slate-900">
        <div className="px-4 py-3">
          <LPSearchBar
            selectedLP={selectedLP}
            onLPChange={handleLPChange}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/20">
        <button
          onClick={() => setActiveTab('research')}
          className={`w-36 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'research'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Research
          {activeTab === 'research' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('holdings')}
          className={`w-36 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'holdings'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Holdings
          {activeTab === 'holdings' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'holdings' ? (
          <div className="flex-1 overflow-hidden">
            {selectedLP ? (
              <LPHoldingsTable
                holdings={holdingsResponse?.holdings || []}
                isLoading={holdingsLoading}
                stats={holdingsStats}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No LP Selected</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Select an LP from the search bar above to view their portfolio holdings.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {selectedLP ? (
              <LPAnalyticsChat lp={selectedLP} holdings={holdingsResponse?.holdings || []} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No LP Selected</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Select an LP from the search bar above to start AI-powered research and analysis of their portfolio holdings.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
