/**
 * CitationTooltip Component
 * Displays citations from AI enrichment as a tooltip popup on hover
 */
import { useState, useRef } from 'react';
import { ExternalLink, BookOpen } from 'lucide-react';
import type { Citation } from '@/types/cleanData';

interface CitationTooltipProps {
  citations: Citation[];
  children: React.ReactNode;
}

export function CitationTooltip({ citations, children }: CitationTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Don't render tooltip wrapper if no citations
  if (!citations || citations.length === 0) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    // Delay showing tooltip to avoid flashing on quick mouse movements
    timeoutRef.current = window.setTimeout(() => setIsVisible(true), 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  return (
    <div
      className="relative inline-flex items-center gap-1 group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main content */}
      <span className="flex-1">{children}</span>

      {/* Citation indicator icon */}
      <BookOpen
        className="w-3.5 h-3.5 text-purple-400 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label={`${citations.length} source${citations.length > 1 ? 's' : ''}`}
      />

      {/* Tooltip popup */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 left-0 top-full mt-2 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 animate-in fade-in-0 zoom-in-95 duration-200"
          role="tooltip"
        >
          {/* Header */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2 pb-2 border-b border-slate-700">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span>Sources ({citations.length})</span>
          </div>

          {/* Citations list */}
          <div className="space-y-2 max-h-48 overflow-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {citations.map((citation, idx) => (
              <a
                key={idx}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate font-medium">
                    {citation.title || new URL(citation.url).hostname}
                  </span>
                </div>
                {citation.snippet && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {citation.snippet}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {citation.url}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
