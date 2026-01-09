// Research API Service
// Handles communication with the Python research backend

// Use empty string for relative URL which will be proxied by Vite dev server
// The proxy in vite.config.ts forwards '/api/research' to 'http://research-service:8000/api/research'
const RESEARCH_API_BASE = '';

export interface ResearchRequest {
  query: string;
  model?: string;
  searchProvider?: string;
}

export interface ResearchSession {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  report?: string;
  error?: string;
}

export interface ResearchStreamEvent {
  type: 'status' | 'chunk' | 'complete' | 'error' | 'progress' | 'step_started' | 'query_added' | 'source_found';
  data: any;
}

/**
 * Start a new research session
 */
export async function startResearch(request: ResearchRequest): Promise<ResearchSession> {
  const response = await fetch(`${RESEARCH_API_BASE}/api/research/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to start research' }));
    throw new Error(error.message || 'Failed to start research');
  }

  return response.json();
}

/**
 * Stream research results using Server-Sent Events
 */
export async function* streamResearch(sessionId: string): AsyncGenerator<ResearchStreamEvent> {
  const response = await fetch(`${RESEARCH_API_BASE}/api/research/stream/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to connect to research stream');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body available');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            return;
          }

          try {
            const event: ResearchStreamEvent = JSON.parse(data);
            yield event;
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get research session by ID
 */
export async function getResearchSession(sessionId: string): Promise<ResearchSession> {
  const response = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch research session');
  }

  return response.json();
}

/**
 * Get research history
 */
export async function getResearchHistory(): Promise<ResearchSession[]> {
  const response = await fetch(`${RESEARCH_API_BASE}/api/research/history`);

  if (!response.ok) {
    throw new Error('Failed to fetch research history');
  }

  return response.json();
}

/**
 * Download research report as markdown
 */
export function downloadReport(session: ResearchSession) {
  if (!session.report) return;

  const blob = new Blob([session.report], { type: 'text/markdown' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `research-${session.id}.md`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Share research report (copy link to clipboard)
 */
export async function shareReport(sessionId: string): Promise<void> {
  const url = `${window.location.origin}/research?session=${sessionId}`;

  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    throw new Error('Failed to copy link to clipboard');
  }
}
