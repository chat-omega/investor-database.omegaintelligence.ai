/**
 * EnrichmentModal Component
 * Modal for creating AI-powered data enrichment jobs using Parallel API
 */
import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import {
  useProcessors,
  createEnrichmentJob,
  createEnrichmentProgressStream,
  cancelEnrichmentJob,
  type ProcessorInfo,
  type EnrichmentProgressEvent,
} from '@/services/enrichmentApi';

interface EnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportId: string;
  sampleRow?: Record<string, unknown>;
  totalRows: number;
  onComplete: () => void;
}

type ModalStage = 'form' | 'progress' | 'complete' | 'error';

export function EnrichmentModal({
  isOpen,
  onClose,
  exportId,
  sampleRow,
  totalRows,
  onComplete,
}: EnrichmentModalProps) {
  const [stage, setStage] = useState<ModalStage>('form');
  const [columnName, setColumnName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [processor, setProcessor] = useState<string>('base');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnrichmentProgressEvent | null>(null);

  const { data: processors, isLoading: processorsLoading } = useProcessors();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStage('form');
      setColumnName('');
      setPrompt('');
      setProcessor('base');
      setIsSubmitting(false);
      setError(null);
      setJobId(null);
      setProgress(null);
    }
  }, [isOpen]);

  // Set up SSE stream when job starts
  useEffect(() => {
    if (!jobId || stage !== 'progress') return;

    const cleanup = createEnrichmentProgressStream(
      jobId,
      (event) => {
        setProgress(event);
        if (event.status === 'completed') {
          setStage('complete');
        } else if (event.status === 'failed') {
          setError(event.error || 'Enrichment failed');
          setStage('error');
        }
      },
      (err) => {
        setError(err.message);
        setStage('error');
      },
      () => {
        // Stream complete
      }
    );

    return cleanup;
  }, [jobId, stage]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!columnName.trim() || !prompt.trim()) {
      setError('Column name and prompt are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const job = await createEnrichmentJob({
        export_id: exportId,
        column_name: columnName.trim(),
        prompt: prompt.trim(),
        processor: processor as 'lite' | 'base' | 'core' | 'pro' | 'ultra',
      });

      setJobId(job.id);
      setStage('progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrichment');
      setStage('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (jobId && stage === 'progress') {
      try {
        await cancelEnrichmentJob(jobId);
      } catch (err) {
        console.error('Failed to cancel job:', err);
      }
    }
    onClose();
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  const getProcessorColor = (proc: ProcessorInfo) => {
    switch (proc.name) {
      case 'lite': return 'text-gray-400';
      case 'base': return 'text-emerald-400';
      case 'core': return 'text-blue-400';
      case 'pro': return 'text-purple-400';
      case 'ultra': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">AI Data Enrichment</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error display */}
          {error && stage === 'form' && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Form Stage */}
          {stage === 'form' && (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-start space-x-3">
                <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                  AI enrichment will research each of your {totalRows.toLocaleString()} rows on the web
                  and populate a new column with the answers.
                </div>
              </div>

              {/* Column Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Column Name
                </label>
                <input
                  type="text"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="e.g., CEO Name, Company Revenue"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Prompt/Question */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Question/Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Who is the current CEO of this company? What is the company's latest revenue?"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  This question will be asked for each row using its data as context.
                </p>
              </div>

              {/* Processor Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Research Depth
                </label>
                {processorsLoading ? (
                  <div className="flex items-center space-x-2 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-400">Loading options...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {processors?.map((proc) => (
                      <label
                        key={proc.name}
                        className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          processor === proc.name
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="processor"
                          value={proc.name}
                          checked={processor === proc.name}
                          onChange={(e) => setProcessor(e.target.value)}
                          className="mt-1 text-purple-500 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${getProcessorColor(proc)}`}>
                              {proc.name.charAt(0).toUpperCase() + proc.name.slice(1)}
                            </span>
                            <span className="text-xs text-slate-500">{proc.relative_cost}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {proc.description} - {proc.recommended_for}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Sample Row Preview */}
              {sampleRow && Object.keys(sampleRow).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Sample Data (first row)
                  </label>
                  <div className="p-3 bg-slate-700/50 rounded-lg max-h-32 overflow-auto">
                    <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(sampleRow, null, 2).slice(0, 500)}
                      {JSON.stringify(sampleRow).length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Stage */}
          {stage === 'progress' && progress && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto text-purple-400 animate-spin mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Enriching Data...
                </h3>
                <p className="text-sm text-slate-400">
                  Researching the web for each row. This may take a few minutes.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-white">
                    {progress.completed_rows} / {progress.total_rows} rows
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress_percent}%` }}
                  />
                </div>
                <div className="text-center text-sm text-slate-400">
                  {progress.progress_percent.toFixed(1)}% complete
                </div>
              </div>
            </div>
          )}

          {/* Complete Stage */}
          {stage === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">
                Enrichment Complete
              </h3>
              <p className="text-slate-400 mb-2">
                Successfully enriched {progress?.completed_rows ?? 0} rows.
              </p>
              {progress?.failed_rows ? (
                <p className="text-sm text-yellow-400">
                  {progress.failed_rows} rows failed to enrich.
                </p>
              ) : null}
            </div>
          )}

          {/* Error Stage */}
          {stage === 'error' && (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">
                Enrichment Failed
              </h3>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              {progress && (
                <p className="text-slate-400 text-sm">
                  Processed {progress.completed_rows} of {progress.total_rows} rows before failure.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end space-x-3">
          {stage === 'form' && (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !columnName.trim() || !prompt.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Start Enrichment</span>
              </button>
            </>
          )}

          {stage === 'progress' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Cancel Enrichment
            </button>
          )}

          {(stage === 'complete' || stage === 'error') && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
