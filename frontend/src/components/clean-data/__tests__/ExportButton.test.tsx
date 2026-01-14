/**
 * ExportButton component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ExportButton } from '../ExportButton';

// Mock the API - keep real formatNumber, mock only createExportSession
vi.mock('@/services/cleanDataApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/cleanDataApi')>();
  return {
    ...actual,
    createExportSession: vi.fn(),
  };
});

import { createExportSession } from '@/services/cleanDataApi';

const mockCreateExportSession = createExportSession as ReturnType<typeof vi.fn>;

// Create a wrapper with providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ExportButton', () => {
  const defaultProps = {
    datasetId: 'gp-dataset',
    sheetId: 'firms',
    filters: {},
    visibleColumns: ['name', 'country', 'aum'],
    totalRows: 100,
    page: 1,
    pageSize: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export button', () => {
    render(<ExportButton {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('opens modal on click', async () => {
    const user = userEvent.setup();

    render(<ExportButton {...defaultProps} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export/i }));

    expect(screen.getByText(/export to fund analyst/i)).toBeInTheDocument();
  });

  it('shows export summary in modal with current page rows', async () => {
    const user = userEvent.setup();

    // With 500 total rows, page 1, pageSize 50, should export 50 rows
    render(<ExportButton {...defaultProps} totalRows={500} page={1} pageSize={50} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Should show 50 rows (current page) not 500 (total)
    expect(screen.getByText(/50 rows/i)).toBeInTheDocument();
    // Should show page info
    expect(screen.getByText(/page 1 of 10/i)).toBeInTheDocument();
  });

  it('validates export name is required', async () => {
    const user = userEvent.setup();

    render(<ExportButton {...defaultProps} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Try to submit without name
    const createButton = screen.getByRole('button', { name: /create export/i });
    expect(createButton).toBeDisabled();
  });

  it('calls export API on submit with valid name and page params', async () => {
    const user = userEvent.setup();
    mockCreateExportSession.mockResolvedValue({
      id: 'test-id',
      name: 'My Export',
      source_dataset: 'gp-dataset',
      source_sheet: 'firms',
      row_count: 50,
    });

    render(<ExportButton {...defaultProps} page={2} pageSize={25} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export/i }));

    const nameInput = screen.getByPlaceholderText(/export name/i);
    await user.type(nameInput, 'My Export');

    const createButton = screen.getByRole('button', { name: /create export/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockCreateExportSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Export',
          source_dataset: 'gp-dataset',
          source_sheet: 'firms',
          page: 2,
          page_size: 25,
        })
      );
    });
  });

  it('handles last page with fewer rows', async () => {
    const user = userEvent.setup();

    // Last page: 55 total rows, page 2, pageSize 50 => only 5 rows on page 2
    render(<ExportButton {...defaultProps} totalRows={55} page={2} pageSize={50} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Should show 5 rows (remaining rows on last page)
    expect(screen.getByText(/5 rows/i)).toBeInTheDocument();
  });
});
