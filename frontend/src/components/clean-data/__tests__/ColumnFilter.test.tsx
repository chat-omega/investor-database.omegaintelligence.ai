/**
 * ColumnFilter component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ColumnFilter } from '../ColumnFilter';

// Mock the API
vi.mock('@/services/cleanDataApi', () => ({
  useColumnDistinctValues: vi.fn(),
}));

import { useColumnDistinctValues } from '@/services/cleanDataApi';

const mockUseColumnDistinctValues = useColumnDistinctValues as ReturnType<typeof vi.fn>;

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ColumnFilter', () => {
  const defaultProps = {
    datasetId: 'gp-dataset',
    sheetId: 'firms',
    columnKey: 'country',
    columnName: 'Country',
    selectedValue: null as string | null,
    onFilterChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter dropdown', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows loading state while fetching values', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    // Should show a loading indicator or disabled state
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('displays "All" option as first item', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('All');
    expect(options[0]).toHaveValue('');
  });

  it('displays all distinct values as options', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByRole('option', { name: 'USA' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'UK' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Germany' })).toBeInTheDocument();
  });

  it('calls onFilterChange when value selected', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(
      <ColumnFilter {...defaultProps} onFilterChange={onFilterChange} />,
      { wrapper: createWrapper() }
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'USA');

    expect(onFilterChange).toHaveBeenCalledWith('USA');
  });

  it('calls onFilterChange with null when "All" is selected', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(
      <ColumnFilter {...defaultProps} selectedValue="USA" onFilterChange={onFilterChange} />,
      { wrapper: createWrapper() }
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '');

    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it('shows selected value in dropdown', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: ['USA', 'UK', 'Germany'],
      isLoading: false,
      error: null,
    });

    render(
      <ColumnFilter {...defaultProps} selectedValue="UK" />,
      { wrapper: createWrapper() }
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('UK');
  });

  it('handles empty values gracefully', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    const options = screen.getAllByRole('option');
    // Should only have the "All" option
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('All');
  });

  it('handles error state', () => {
    mockUseColumnDistinctValues.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
    });

    render(<ColumnFilter {...defaultProps} />, { wrapper: createWrapper() });

    // Should still render, but maybe show an error indicator
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });
});
