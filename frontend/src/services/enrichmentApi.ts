/**
 * API service for AI Enrichment using Parallel API
 */
import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api/enrichment';

// =============================================================================
// Types
// =============================================================================

export interface ProcessorInfo {
  name: string;
  description: string;
  relative_cost: string;
  recommended_for: string;
}

export interface EnrichmentJob {
  id: string;
  export_id: string;
  column_key: string;
  column_name: string;
  prompt: string;
  processor: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_rows: number;
  completed_rows: number;
  failed_rows: number;
  taskgroup_id?: string;
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  progress_percent: number;
}

export interface CreateEnrichmentJobParams {
  export_id: string;
  column_name: string;
  prompt: string;
  processor?: 'lite' | 'base' | 'core' | 'pro' | 'ultra';
}

export interface EnrichmentProgressEvent {
  job_id: string;
  status: string;
  completed_rows: number;
  total_rows: number;
  progress_percent: number;
  current_row_id?: string;
  current_result?: string;
  error?: string;
}

// =============================================================================
// API Functions
// =============================================================================

export async function fetchProcessors(): Promise<ProcessorInfo[]> {
  const response = await fetch(`${API_BASE}/processors`);
  if (!response.ok) throw new Error('Failed to fetch processors');
  return response.json();
}

export function useProcessors() {
  return useQuery({
    queryKey: ['enrichment-processors'],
    queryFn: fetchProcessors,
    staleTime: Infinity, // Processors don't change
  });
}

export async function createEnrichmentJob(
  params: CreateEnrichmentJobParams
): Promise<EnrichmentJob> {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create enrichment job');
  }

  return response.json();
}

export async function fetchEnrichmentJob(jobId: string): Promise<EnrichmentJob> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!response.ok) throw new Error('Failed to fetch enrichment job');
  return response.json();
}

export function useEnrichmentJob(jobId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['enrichment-job', jobId],
    queryFn: () => fetchEnrichmentJob(jobId),
    staleTime: 5 * 1000, // Refetch every 5 seconds for active jobs
    refetchInterval: (data) => {
      // Stop refetching when job is complete
      if (data?.status && ['completed', 'failed', 'cancelled'].includes(data.status)) {
        return false;
      }
      return 5000;
    },
    enabled: enabled && !!jobId,
  });
}

export async function cancelEnrichmentJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to cancel job');
  }
}

export async function fetchExportEnrichmentJobs(exportId: string): Promise<EnrichmentJob[]> {
  const response = await fetch(`${API_BASE}/exports/${exportId}/jobs`);
  if (!response.ok) throw new Error('Failed to fetch export jobs');
  return response.json();
}

export function useExportEnrichmentJobs(exportId: string) {
  return useQuery({
    queryKey: ['export-enrichment-jobs', exportId],
    queryFn: () => fetchExportEnrichmentJobs(exportId),
    staleTime: 10 * 1000,
    enabled: !!exportId,
  });
}

// =============================================================================
// SSE Stream for Real-time Progress
// =============================================================================

export function createEnrichmentProgressStream(
  jobId: string,
  onEvent: (event: EnrichmentProgressEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/jobs/${jobId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as EnrichmentProgressEvent;
      onEvent(data);

      // Check if job is complete
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        eventSource.close();
        onComplete?.();
      }
    } catch (err) {
      console.error('Failed to parse SSE event:', err);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
    onError?.(new Error('Connection to server lost'));
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}
