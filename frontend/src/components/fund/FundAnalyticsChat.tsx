import { useState } from 'react';
import { Send, AlertCircle, X, MessageSquare } from 'lucide-react';
import { Fund } from '@/types/fund';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ResearchProgress, ResearchPhase, ResearchQuery, ResearchSource } from '@/components/ResearchProgress';
import { startResearch, streamResearch, downloadReport } from '@/services/researchApi';
import type { ResearchSession } from '@/services/researchApi';

interface FundAnalyticsChatProps {
  selectedFund: Fund | null;
  className?: string;
}

interface ExampleButton {
  id: string;
  label: string;
  prompt: string;
}

// Template prompts - base versions without fund name
const templatePrompts = {
  'portfolio-performance': 'Conduct a comprehensive portfolio performance analysis including IRR, MOIC, and performance trends across all investments.',
  'irr-moic': 'Provide a detailed analysis of Internal Rate of Return (IRR) and Multiple on Invested Capital (MOIC) metrics, including benchmarking against industry standards.',
  'fund-benchmarking': 'Benchmark the fund\'s performance against comparable funds in the same strategy, vintage year, and geography.',
  'returns-attribution': 'Analyze where portfolio returns are coming from - sector concentration, geographic allocation, and individual company performance contributions.',
  'value-creation': 'Review and assess the fund\'s value creation strategies across the portfolio, identifying successful initiatives and areas for improvement.',
  'portfolio-optimization': 'Develop a portfolio optimization plan focusing on resource allocation, company prioritization, and value maximization strategies.',
  'synergy-analysis': 'Identify and analyze potential synergies between portfolio companies for revenue growth, cost reduction, and strategic partnerships.',
  'operational-improvement': 'Create a comprehensive operational improvement roadmap for portfolio companies, including best practices, resource sharing, and efficiency gains.',
  'investment-thesis': 'Review and evaluate the fund\'s core investment thesis, assessing alignment with market trends and portfolio performance.',
  'sector-analysis': 'Conduct a comprehensive sector and market analysis for the fund\'s focus areas, including trends, opportunities, and competitive dynamics.',
  'diversification': 'Analyze portfolio diversification across sectors, stages, and geographies, and recommend strategies for optimal risk-adjusted returns.',
  'exit-strategy': 'Develop a comprehensive exit strategy plan for portfolio companies, including timing, valuation optimization, and buyer identification.'
};

export function FundAnalyticsChat({ selectedFund, className = '' }: FundAnalyticsChatProps) {
  // State
  const [query, setQuery] = useState('');
  const [documentType, setDocumentType] = useState('document');
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [isResearching, setIsResearching] = useState(false);
  const [currentReport, setCurrentReport] = useState('');
  const [currentSession, setCurrentSession] = useState<ResearchSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [phases, setPhases] = useState<ResearchPhase[]>([]);
  const [queries, setQueries] = useState<ResearchQuery[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);

  // Helper to get fund name
  const fundName = selectedFund?.name || null;

  // Generate dynamic template prompts based on selected fund
  const getTemplatePrompt = (templateId: keyof typeof templatePrompts): string => {
    const basePrompt = templatePrompts[templateId];

    if (!fundName) {
      return basePrompt;
    }

    // Inject fund name into the prompt
    return `For ${fundName}: ${basePrompt}`;
  };

  // Generate example buttons dynamically
  const exampleButtons: ExampleButton[] = [
    {
      id: 'portfolio-performance',
      label: 'Portfolio Performance',
      prompt: getTemplatePrompt('portfolio-performance')
    },
    {
      id: 'irr-moic',
      label: 'IRR & MOIC Analysis',
      prompt: getTemplatePrompt('irr-moic')
    },
    {
      id: 'fund-benchmarking',
      label: 'Fund Benchmarking',
      prompt: getTemplatePrompt('fund-benchmarking')
    },
    {
      id: 'returns-attribution',
      label: 'Returns Attribution',
      prompt: getTemplatePrompt('returns-attribution')
    },
    {
      id: 'value-creation',
      label: 'Value Creation Strategy',
      prompt: getTemplatePrompt('value-creation')
    },
    {
      id: 'portfolio-optimization',
      label: 'Portfolio Optimization',
      prompt: getTemplatePrompt('portfolio-optimization')
    },
    {
      id: 'synergy-analysis',
      label: 'Synergy Analysis',
      prompt: getTemplatePrompt('synergy-analysis')
    },
    {
      id: 'operational-improvement',
      label: 'Operational Improvement',
      prompt: getTemplatePrompt('operational-improvement')
    },
    {
      id: 'investment-thesis',
      label: 'Investment Thesis',
      prompt: getTemplatePrompt('investment-thesis')
    },
    {
      id: 'sector-analysis',
      label: 'Sector Analysis',
      prompt: getTemplatePrompt('sector-analysis')
    },
    {
      id: 'diversification',
      label: 'Diversification Strategy',
      prompt: getTemplatePrompt('diversification')
    },
    {
      id: 'exit-strategy',
      label: 'Exit Strategy',
      prompt: getTemplatePrompt('exit-strategy')
    }
  ];

  const handleExampleClick = (prompt: string) => {
    setQuery(prompt);
  };

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setIsResearching(true);
    setCurrentReport('');
    setError(null);
    setProgressMessage('Starting research...');

    // Initialize phases
    setPhases([
      { name: 'Search', step: 'search', status: 'pending' },
      { name: 'Review', step: 'review', status: 'pending' },
      { name: 'Synthesis', step: 'synthesis', status: 'pending' }
    ]);
    setQueries([]);
    setSources([]);

    try {
      // Start research session
      const session = await startResearch({
        query: query.trim(),
        model: selectedModel
      });

      setCurrentSession(session);

      // Stream results
      for await (const event of streamResearch(session.id)) {
        if (event.type === 'progress') {
          setProgressMessage(event.data);
        } else if (event.type === 'step_started') {
          // Update phase status
          const { step } = event.data;
          setPhases(prev => prev.map(p => {
            if (p.step === step) {
              return { ...p, status: 'running', startTime: event.data.timestamp };
            }
            // Mark previous phases as completed
            const stepOrder = ['search', 'review', 'synthesis'];
            const currentIndex = stepOrder.indexOf(step);
            const phaseIndex = stepOrder.indexOf(p.step);
            if (phaseIndex < currentIndex && p.status !== 'completed') {
              return { ...p, status: 'completed', endTime: event.data.timestamp };
            }
            return p;
          }));
        } else if (event.type === 'query_added') {
          // Add query to list
          setQueries(prev => [...prev, {
            query: event.data.query,
            timestamp: event.data.timestamp
          }]);
        } else if (event.type === 'source_found') {
          // Add source to list
          setSources(prev => [...prev, {
            title: event.data.title,
            url: event.data.url,
            domain: event.data.domain,
            snippet: event.data.snippet,
            timestamp: event.data.timestamp
          }]);
        } else if (event.type === 'chunk') {
          setCurrentReport(prev => prev + event.data);
        } else if (event.type === 'complete') {
          setCurrentReport(event.data);
          setProgressMessage('');
          setIsResearching(false);
          // Mark all phases as completed
          setPhases(prev => prev.map(p => ({ ...p, status: 'completed' })));
        } else if (event.type === 'error') {
          setError(event.data);
          setProgressMessage('');
          setIsResearching(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research');
      setProgressMessage('');
      setIsResearching(false);
    }
  };

  const handleDownload = () => {
    if (currentSession) {
      downloadReport({ ...currentSession, report: currentReport });
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900 ${className || ''}`}>
      {/* Content Section - Conditional Layout */}
      <div className={(!currentReport && !isResearching && !error) ? "flex-1 flex items-center justify-center px-6" : "flex-1 overflow-y-auto px-6 pt-6 pb-4"}>
        {(!currentReport && !isResearching && !error) ? (
          // Initial Centered State - Input and Examples
          <div className="max-w-3xl mx-auto space-y-4 mt-16">
            {/* Visual Feedback for Selected Fund */}
            {fundName && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-slate-400">Analyzing:</span>
                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg font-medium border border-blue-500/30">
                  {fundName}
                </span>
              </div>
            )}

            {/* Chat Input - Centered */}
            <div className="space-y-4">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={fundName
                  ? `Ask me anything about ${fundName} analytics...`
                  : "Ask me anything about fund analytics, performance, or strategy..."}
                rows={1}
                disabled={isResearching}
                className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700/20 resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '44px' }}
              />

              {/* Controls Row */}
              <div className="flex items-center justify-between">
                {/* Model & Document Type Selectors */}
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
                    disabled={isResearching}
                  >
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 Mini</option>
                    <option value="gpt-5-nano">GPT-5 Nano</option>
                    <option value="openai/gpt-oss-120b">Cerebras GPT-OSS-120B</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                  </select>

                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
                    disabled={isResearching}
                  >
                    <option value="document">Document</option>
                    <option value="presentation">Presentation</option>
                    <option value="spreadsheet">Spreadsheet</option>
                    <option value="report">Report</option>
                  </select>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!query.trim() || isResearching}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    query.trim() && !isResearching
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isResearching ? 'Researching...' : 'Submit'}
                </button>
              </div>
            </div>

            {/* Example Buttons Section */}
            <div className="mt-6">
              <p className="text-slate-400 text-xs mb-3">Try these examples:</p>

              <div className="grid grid-cols-2 gap-2">
                {exampleButtons.map((example) => (
                  <button
                    key={example.id}
                    onClick={() => handleExampleClick(example.prompt)}
                    className="text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/20 rounded-lg text-xs text-slate-300 hover:text-white transition-all"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Report/Research State - Scrollable Content
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-400">Research Failed</h3>
                    <p className="text-red-300 mt-1">{error}</p>
                    <button
                      onClick={() => {
                        setError(null);
                        setIsResearching(false);
                      }}
                      className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Research Progress */}
            {isResearching && !currentReport && !error && (
              <ResearchProgress
                phases={phases}
                queries={queries}
                sources={sources}
                progressMessage={progressMessage}
                isComplete={false}
              />
            )}

            {/* Report Display */}
            {currentReport && !error && (
              <ReportDisplay
                content={currentReport}
                isStreaming={isResearching}
                title={currentSession?.query}
                onDownload={handleDownload}
              />
            )}
          </div>
        )}
      </div>

      {/* Chat Input - Fixed at Bottom (Only when report exists) */}
      {(currentReport || isResearching || error) && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/20 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={fundName
                    ? `Ask me anything about ${fundName} analytics...`
                    : "Ask me anything about fund analytics, performance, or strategy..."}
                  rows={1}
                  disabled={isResearching}
                  className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700/20 resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '44px' }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isResearching}
                className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all shadow-lg shadow-blue-600/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Press Enter to send, Shift + Enter for new line
            </p>

            {/* Model & Document Type Selectors Below Helper Text */}
            <div className="flex items-center space-x-2 mt-3">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
                disabled={isResearching}
              >
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5-mini">GPT-5 Mini</option>
                <option value="gpt-5-nano">GPT-5 Nano</option>
                <option value="openai/gpt-oss-120b">Cerebras GPT-OSS-120B</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
              </select>

              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="px-3 py-1.5 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
                disabled={isResearching}
              >
                <option value="document">Document</option>
                <option value="presentation">Presentation</option>
                <option value="spreadsheet">Spreadsheet</option>
                <option value="report">Report</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
