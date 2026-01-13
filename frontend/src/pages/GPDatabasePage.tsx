import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { FundSearchBar } from '@/components/fund/FundSearchBar';
import { FundAnalyticsChat } from '@/components/fund/FundAnalyticsChat';
import { FundPortfolioTable } from '@/components/fund/FundPortfolioTable';
import { Fund } from '@/types/fund';

type TabType = 'research' | 'portfolio';

export function GPDatabasePage() {
  // Fund selection state
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  // Tab state - default to portfolio when fund is selected
  const [activeTab, setActiveTab] = useState<TabType>('portfolio');

  // Handle fund selection from search bar
  const handleFundChange = (fund: Fund | null) => {
    setSelectedFund(fund);
    // Switch to portfolio tab when a fund is selected
    if (fund) {
      setActiveTab('portfolio');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Fund Search Bar - at top */}
      <div className="border-b border-slate-700/20 bg-slate-900">
        <div className="px-4 py-3">
          <FundSearchBar
            onFundChange={handleFundChange}
            selectedFund={selectedFund}
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
          onClick={() => setActiveTab('portfolio')}
          className={`w-36 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'portfolio'
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Portfolio
          {activeTab === 'portfolio' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'portfolio' ? (
          <div className="flex-1 overflow-hidden">
            {selectedFund ? (
              <FundPortfolioTable
                fundId={selectedFund.id}
                fundName={selectedFund.name}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No Fund Selected</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Select a fund from the search bar above to view portfolio companies.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {selectedFund ? (
              <FundAnalyticsChat selectedFund={selectedFund} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No Fund Selected</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Select a fund from the search bar above to start AI-powered research and analysis of their portfolio.
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
