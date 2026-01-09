import { useState } from 'react';
import { Send, Sparkles, Building2 } from 'lucide-react';
import { FundSearchBar } from '@/components/fund/FundSearchBar';
import { FundPortfolioTable } from '@/components/fund/FundPortfolioTable';
import { Fund } from '@/types/fund';

type TabType = 'portfolio' | 'research';

export function GPDatabasePage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('research');

  // Fund selection state
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  // Research tab states
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [isResearching, setIsResearching] = useState(false);
  const [researchReport, setResearchReport] = useState<string | null>(null);

  // Example prompts for Research tab
  const exampleButtons = [
    {
      id: 'portfolio-performance',
      label: 'Portfolio Performance',
      prompt: selectedFund?.name
        ? `Analyze the portfolio performance of ${selectedFund.name} including returns, IRR, MOIC, and key performance metrics.`
        : 'Analyze portfolio performance including returns, IRR, MOIC, and key performance metrics.'
    },
    {
      id: 'sector-allocation',
      label: 'Sector Allocation',
      prompt: selectedFund?.name
        ? `Review the sector and industry allocation for ${selectedFund.name}, including diversification analysis.`
        : 'Review sector and industry allocation including diversification analysis.'
    },
    {
      id: 'fund-strategy',
      label: 'Fund Strategy',
      prompt: selectedFund?.name
        ? `Generate a comprehensive fund strategy report for ${selectedFund.name}.`
        : 'Generate a comprehensive fund strategy report.'
    },
    {
      id: 'risk-assessment',
      label: 'Risk Assessment',
      prompt: selectedFund?.name
        ? `Create a detailed risk assessment for ${selectedFund.name}.`
        : 'Create a detailed risk assessment analyzing portfolio risk.'
    },
  ];

  const handleExampleClick = (prompt: string) => {
    setQuery(prompt);
  };

  const handleResearch = async () => {
    if (!query.trim()) return;

    setIsResearching(true);
    setResearchReport(null);

    try {
      // Start research session
      const response = await fetch('/api/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          model: selectedModel,
        }),
      });

      if (!response.ok) throw new Error('Failed to start research');

      const session = await response.json();

      // Stream results
      const eventSource = new EventSource(`/api/research/stream/${session.id}`);

      let fullReport = '';

      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          setIsResearching(false);
          return;
        }

        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chunk') {
            fullReport += data.data;
            setResearchReport(fullReport);
          } else if (data.type === 'complete') {
            setResearchReport(data.data.report);
            setIsResearching(false);
          } else if (data.type === 'error') {
            console.error('Research error:', data.data);
            setIsResearching(false);
          }
        } catch (e) {
          console.error('Failed to parse event:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsResearching(false);
      };
    } catch (error) {
      console.error('Research failed:', error);
      setIsResearching(false);
    }
  };

  const handleFundSelect = (fund: Fund | null) => {
    setSelectedFund(fund);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Fund Search Bar - at top */}
      <div className="border-b border-slate-700/20 bg-slate-900">
        <div className="px-4 py-3">
          <FundSearchBar
            onFundChange={handleFundSelect}
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
        {activeTab === 'research' ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {/* Example Prompts */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Analysis</h3>
                <div className="flex flex-wrap gap-2">
                  {exampleButtons.map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleExampleClick(btn.prompt)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-700 hover:border-blue-500/50 hover:text-white transition-colors"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Query Input */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask about fund performance, portfolio analysis, sector trends..."
                      className="w-full p-3 text-sm bg-slate-900 border border-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={handleResearch}
                    disabled={isResearching || !query.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isResearching ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Research
                      </>
                    )}
                  </button>
                </div>

                {/* Model Selection */}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <label className="text-slate-400">Model:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-white"
                  >
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  </select>
                </div>
              </div>

              {/* Research Results */}
              {researchReport && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Research Report</h3>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <div
                      className="whitespace-pre-wrap text-slate-300"
                      dangerouslySetInnerHTML={{ __html: researchReport }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFund ? (
              <FundPortfolioTable
                fundId={selectedFund.id}
                fundName={selectedFund.name}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Select a Fund</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    Select a fund from the search bar above to view portfolio companies.
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
