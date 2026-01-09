import { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { LP, LPHolding } from '@/types/lp';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ResearchProgress, ResearchPhase, ResearchQuery, ResearchSource } from '@/components/ResearchProgress';
import { startResearch, streamResearch, downloadReport } from '@/services/researchApi';
import type { ResearchSession } from '@/services/researchApi';

interface LPAnalyticsChatProps {
  lp: LP;
  holdings: LPHolding[];
}

interface ExampleButton {
  id: string;
  label: string;
  prompt: string;
}

// Template prompts - base versions without LP name
const templatePrompts = {
  'investment-history': 'Provide a comprehensive investment history analysis including all fund commitments, timing, and investment patterns.',
  'commitment-analysis': 'Analyze total capital commitments, deployment rates, and commitment trends over time.',
  'investment-focus': 'Identify and analyze the LP\'s investment focus areas, preferred fund strategies, and sector preferences.',
  'relationship-status': 'Assess the current relationship status, engagement level, and potential for future commitments.',
  'co-investment-network': 'Map the LP\'s co-investment network, identifying other LPs they commonly invest alongside.',
  'fund-preferences': 'Analyze preferred fund characteristics including strategy, size, geography, and vintage year patterns.',
  'geographic-focus': 'Review geographic investment preferences and regional allocation patterns.',
  'tier-assessment': 'Evaluate the LP\'s tier classification based on commitment size, relationship strength, and strategic value.'
};

export function LPAnalyticsChat({ lp, holdings }: LPAnalyticsChatProps) {
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

  // Helper to get LP name
  const lpName = lp?.name || null;

  // Generate dynamic template prompts based on selected LP
  const getTemplatePrompt = (templateId: keyof typeof templatePrompts): string => {
    const basePrompt = templatePrompts[templateId];

    if (!lpName) {
      return basePrompt;
    }

    // Inject LP name into the prompt
    return `For ${lpName}: ${basePrompt}`;
  };

  // Generate example buttons dynamically
  const exampleButtons: ExampleButton[] = [
    {
      id: 'investment-history',
      label: 'Investment History',
      prompt: getTemplatePrompt('investment-history')
    },
    {
      id: 'commitment-analysis',
      label: 'Commitment Analysis',
      prompt: getTemplatePrompt('commitment-analysis')
    },
    {
      id: 'investment-focus',
      label: 'Investment Focus',
      prompt: getTemplatePrompt('investment-focus')
    },
    {
      id: 'relationship-status',
      label: 'Relationship Status',
      prompt: getTemplatePrompt('relationship-status')
    },
    {
      id: 'co-investment-network',
      label: 'Co-Investment Network',
      prompt: getTemplatePrompt('co-investment-network')
    },
    {
      id: 'fund-preferences',
      label: 'Fund Preferences',
      prompt: getTemplatePrompt('fund-preferences')
    },
    {
      id: 'geographic-focus',
      label: 'Geographic Focus',
      prompt: getTemplatePrompt('geographic-focus')
    },
    {
      id: 'tier-assessment',
      label: 'Tier Assessment',
      prompt: getTemplatePrompt('tier-assessment')
    }
  ];

  const handleExampleClick = (prompt: string) => {
    setQuery(prompt);
  };

  const handleSubmit = async () => {
    if (!query.trim() || isResearching) return;

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
      // Build holdings context
      const holdingsContext = holdings.length > 0 ? `

Portfolio Holdings Data for ${lpName}:
- Total Holdings: ${holdings.length} funds
- Holdings include fund names, vintages, capital flows (committed, contributed, distributed), market values, and inception IRRs
- Holdings data available for analysis and queries

Sample Holdings:
${holdings.slice(0, 5).map(h => `  • ${h.fund_name} (${h.vintage || 'N/A'}): Market Value ${h.market_value_raw || 'N/A'}, IRR ${h.inception_irr ? h.inception_irr.toFixed(2) + '%' : 'N/A'}`).join('\n')}

` : '';

      // Start research session with holdings context
      const session = await startResearch({
        query: holdingsContext + query.trim(),
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

  // If there's a report or research in progress, show that view
  if (currentReport || isResearching || error) {
    return (
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto w-full px-6 pt-6 pb-8">
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
      </div>
    );
  }

  // Initial state - centered layout with examples above chatbox
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto w-full px-6 pt-4 pb-8">
        {/* Example Buttons Section */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wide">Try these examples</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {exampleButtons.map((example) => (
              <button
                key={example.id}
                onClick={() => handleExampleClick(example.prompt)}
                className="group relative bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-xl hover:scale-105 border border-slate-700/20 hover:border-purple-500/50"
              >
                <div className="relative z-10 flex items-center justify-center text-center">
                  <span className="text-white font-semibold text-sm leading-tight">
                    {example.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input - Centered below examples */}
        <div className="mt-12 z-10">
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Ask me anything about ${lpName} analytics, commitments, or relationships...`}
              rows={2}
              className="w-full px-6 py-5 pb-20 border-2 border-slate-700/50 rounded-3xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-white placeholder-slate-500 bg-slate-800/50 backdrop-blur-sm shadow-lg"
              disabled={isResearching}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />

            {/* Controls Inside Textarea - Bottom */}
            <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
              {/* Left: Model & Document Selectors */}
              <div className="flex items-center space-x-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-4 py-2 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
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
                  className="px-4 py-2 border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer bg-slate-800/50 backdrop-blur-sm text-white"
                  disabled={isResearching}
                >
                  <option value="document">Document</option>
                  <option value="presentation">Presentation</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="report">Report</option>
                </select>
              </div>

              {/* Right: Send Button (Icon Only) */}
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isResearching}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  query.trim() && !isResearching
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
