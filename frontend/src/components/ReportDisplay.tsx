import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { FileText, Download, Share2 } from 'lucide-react';

interface ReportDisplayProps {
  content: string;
  isStreaming?: boolean;
  title?: string;
  onDownload?: () => void;
  onShare?: () => void;
}

export function ReportDisplay({
  content,
  isStreaming = false,
  title,
  onDownload,
  onShare
}: ReportDisplayProps) {
  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/20 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/20 bg-gradient-to-r from-slate-800/50 to-slate-800/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {title || 'Research Report'}
              </h3>
              {isStreaming && (
                <p className="text-sm text-emerald-400 flex items-center space-x-2">
                  <span className="animate-pulse">●</span>
                  <span>Generating...</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onShare && (
              <button
                onClick={onShare}
                className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                title="Share report"
              >
                <Share2 className="w-5 h-5 text-slate-300" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                title="Download report"
              >
                <Download className="w-5 h-5 text-slate-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <article className="prose prose-slate max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-bold text-white mb-4 pb-3 border-b-2 border-emerald-400/30">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-slate-300 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-slate-300 mb-4 space-y-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-2">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="ml-4">
                  {children}
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-emerald-500/50 pl-4 py-2 my-4 bg-emerald-500/10 rounded-r">
                  {children}
                </blockquote>
              ),
              code: ({ className, children }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-slate-800/50 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                ) : (
                  <code className={className}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto mb-4">
                  {children}
                </pre>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline"
                >
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-slate-700/30 border border-slate-700/20">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-slate-800/30">
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-sm text-slate-300 border-t border-slate-700/20">
                  {children}
                </td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>

          {isStreaming && (
            <div className="flex items-center space-x-2 mt-4">
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
