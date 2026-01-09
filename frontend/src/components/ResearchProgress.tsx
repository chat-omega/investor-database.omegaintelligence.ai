import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, FileSearch, FileText, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

export interface ResearchPhase {
  name: string;
  step: 'search' | 'review' | 'synthesis';
  status: 'pending' | 'running' | 'completed';
  startTime?: string;
  endTime?: string;
}

export interface ResearchQuery {
  query: string;
  timestamp: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  timestamp: string;
}

interface ResearchProgressProps {
  phases: ResearchPhase[];
  queries: ResearchQuery[];
  sources: ResearchSource[];
  progressMessage?: string;
  isComplete?: boolean;
}

export function ResearchProgress({
  phases,
  queries,
  sources,
  progressMessage,
  isComplete = false
}: ResearchProgressProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(phases.filter(p => p.status !== 'pending').map(p => p.step))
  );

  const togglePhase = (step: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedPhases(newExpanded);
  };

  const getPhaseIcon = (phase: ResearchPhase) => {
    if (phase.status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    if (phase.status === 'running') {
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    if (phase.step === 'search') {
      return <Search className="w-5 h-5 text-gray-400" />;
    }
    if (phase.step === 'review') {
      return <FileSearch className="w-5 h-5 text-gray-400" />;
    }
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  const getPhaseQueries = () => {
    return queries;
  };

  const getSourcesCount = () => {
    return sources.length;
  };

  const getFaviconUrl = (domain: string) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/30 bg-gradient-to-r from-slate-800/60 to-slate-900/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isComplete ? 'Research Complete' : 'Research in Progress'}
              </h3>
              {progressMessage && !isComplete && (
                <p className="text-sm text-blue-300">{progressMessage}</p>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <Search className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">{queries.length} queries</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileSearch className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">{sources.length} sources</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6">
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isExpanded = expandedPhases.has(phase.step);
            const phaseQueries = phase.step === 'search' ? getPhaseQueries() : [];
            const phaseSources = phase.step === 'search' || phase.step === 'review' ? sources : [];

            return (
              <div key={phase.step} className="relative">
                {/* Connector Line */}
                {index < phases.length - 1 && (
                  <div className="absolute left-[1.25rem] top-12 bottom-0 w-0.5 bg-slate-700/50" />
                )}

                {/* Phase Header */}
                <button
                  onClick={() => togglePhase(phase.step)}
                  className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-slate-700/50 transition-colors"
                  disabled={phase.status === 'pending'}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 relative z-10 bg-slate-800/40">
                    {getPhaseIcon(phase)}
                  </div>

                  {/* Phase Info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center space-x-2">
                      <h4 className={`font-semibold ${
                        phase.status === 'pending' ? 'text-slate-500' :
                        phase.status === 'running' ? 'text-blue-300' :
                        'text-white'
                      }`}>
                        {phase.name}
                      </h4>
                      {phase.status === 'running' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                          Running
                        </span>
                      )}
                      {phase.status === 'completed' && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full">
                          Done
                        </span>
                      )}
                    </div>

                    {/* Phase Summary */}
                    {phase.step === 'search' && queries.length > 0 && (
                      <p className="text-sm text-slate-300 mt-1">
                        {queries.length} search {queries.length === 1 ? 'query' : 'queries'} • {sources.length} sources found
                      </p>
                    )}
                    {phase.step === 'review' && sources.length > 0 && (
                      <p className="text-sm text-slate-300 mt-1">
                        Reviewing {sources.length} sources
                      </p>
                    )}
                    {phase.step === 'synthesis' && phase.status === 'running' && (
                      <p className="text-sm text-slate-300 mt-1">
                        Generating comprehensive report
                      </p>
                    )}
                  </div>

                  {/* Expand/Collapse Icon */}
                  {phase.status !== 'pending' && (phaseQueries.length > 0 || phaseSources.length > 0) && (
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && phase.status !== 'pending' && (
                  <div className="ml-12 mt-2 space-y-4">
                    {/* Search Queries */}
                    {phase.step === 'search' && phaseQueries.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Search Queries
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {phaseQueries.map((q, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-900/30 border border-blue-500/50 rounded-lg text-sm text-blue-300"
                            >
                              <Search className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{q.query}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sources */}
                    {(phase.step === 'search' || phase.step === 'review') && phaseSources.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Sources Found ({phaseSources.length})
                        </h5>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {phaseSources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start space-x-3 p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:border-blue-400/50 hover:bg-slate-600/40 transition-all group"
                            >
                              {/* Favicon */}
                              <img
                                src={getFaviconUrl(source.domain)}
                                alt=""
                                className="w-5 h-5 flex-shrink-0 mt-0.5"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                                }}
                              />

                              {/* Source Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-medium text-white group-hover:text-blue-300 truncate">
                                    {source.title}
                                  </p>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 flex-shrink-0 ml-2" />
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{source.domain}</p>
                                {source.snippet && (
                                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">{source.snippet}</p>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
