/**
 * CleanDataTable component tests
 * Tests for page size selector, sorting, and table functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CleanDataTable } from '../CleanDataTable';
import type { ColumnDef } from '@/types/cleanData';

// Mock data for tests
const mockColumns: ColumnDef[] = [
  { key: 'name', name: 'Name', index: 0, data_type: 'string', is_visible: true },
  { key: 'country', name: 'Country', index: 1, data_type: 'string', is_visible: true },
  { key: 'aum', name: 'AUM', index: 2, data_type: 'number', is_visible: true },
];

const mockData = [
  { _id: '1', name: 'Firm A', country: 'USA', aum: 1000000000 },
  { _id: '2', name: 'Firm B', country: 'UK', aum: 500000000 },
  { _id: '3', name: 'Firm C', country: 'Germany', aum: 750000000 },
];

const defaultProps = {
  data: mockData,
  columns: mockColumns,
  isLoading: false,
  pagination: {
    page: 1,
    pageSize: 50,
    total: 100,
    pages: 2,
  },
  onPageChange: vi.fn(),
  onSort: vi.fn(),
  onPageSizeChange: vi.fn(),
};

describe('CleanDataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Size Selector', () => {
    it('renders page size selector with options 10, 20, 50, 100', () => {
      render(<CleanDataTable {...defaultProps} />);

      // Find the page size selector
      const selector = screen.getByRole('combobox', { name: /rows per page/i });
      expect(selector).toBeInTheDocument();

      // Check all options exist
      const options = within(selector).getAllByRole('option');
      const optionValues = options.map(opt => opt.getAttribute('value'));
      expect(optionValues).toEqual(['10', '20', '50', '100']);
    });

    it('shows current page size as selected value', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ ...defaultProps.pagination, pageSize: 50 }} />);

      const selector = screen.getByRole('combobox', { name: /rows per page/i });
      expect(selector).toHaveValue('50');
    });

    it('shows 20 as selected when pageSize is 20', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ ...defaultProps.pagination, pageSize: 20 }} />);

      const selector = screen.getByRole('combobox', { name: /rows per page/i });
      expect(selector).toHaveValue('20');
    });

    it('calls onPageSizeChange when a new size is selected', async () => {
      const user = userEvent.setup();
      const onPageSizeChange = vi.fn();

      render(<CleanDataTable {...defaultProps} onPageSizeChange={onPageSizeChange} />);

      const selector = screen.getByRole('combobox', { name: /rows per page/i });
      await user.selectOptions(selector, '100');

      expect(onPageSizeChange).toHaveBeenCalledWith(100);
      expect(onPageSizeChange).toHaveBeenCalledTimes(1);
    });

    it('calls onPageSizeChange with correct number value', async () => {
      const user = userEvent.setup();
      const onPageSizeChange = vi.fn();

      render(<CleanDataTable {...defaultProps} onPageSizeChange={onPageSizeChange} />);

      const selector = screen.getByRole('combobox', { name: /rows per page/i });
      await user.selectOptions(selector, '10');

      // Should be called with a number, not a string
      expect(onPageSizeChange).toHaveBeenCalledWith(10);
      expect(typeof onPageSizeChange.mock.calls[0][0]).toBe('number');
    });

    it('displays page size label', () => {
      render(<CleanDataTable {...defaultProps} />);

      expect(screen.getByText(/rows per page/i)).toBeInTheDocument();
    });
  });

  describe('Pagination Display', () => {
    it('shows correct row range with current page size', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ page: 1, pageSize: 50, total: 100, pages: 2 }} />);

      expect(screen.getByText(/showing 1 to 50 of 100/i)).toBeInTheDocument();
    });

    it('updates display when on page 2', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ page: 2, pageSize: 50, total: 100, pages: 2 }} />);

      expect(screen.getByText(/showing 51 to 100 of 100/i)).toBeInTheDocument();
    });

    it('handles small dataset correctly', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ page: 1, pageSize: 50, total: 25, pages: 1 }} />);

      expect(screen.getByText(/showing 1 to 25 of 25/i)).toBeInTheDocument();
    });
  });

  describe('Table Rendering', () => {
    it('renders table with data', () => {
      render(<CleanDataTable {...defaultProps} />);

      expect(screen.getByText('Firm A')).toBeInTheDocument();
      expect(screen.getByText('Firm B')).toBeInTheDocument();
      expect(screen.getByText('Firm C')).toBeInTheDocument();
    });

    it('renders column headers', () => {
      render(<CleanDataTable {...defaultProps} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.getByText('AUM')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(<CleanDataTable {...defaultProps} isLoading={true} />);

      // Should show loading indicator, not data
      expect(screen.queryByText('Firm A')).not.toBeInTheDocument();
    });

    it('shows empty state when no data', () => {
      render(<CleanDataTable {...defaultProps} data={[]} />);

      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('calls onSort when clicking column header', async () => {
      const user = userEvent.setup();
      const onSort = vi.fn();

      render(<CleanDataTable {...defaultProps} onSort={onSort} />);

      const nameHeader = screen.getByText('Name');
      await user.click(nameHeader);

      expect(onSort).toHaveBeenCalledWith('name', 'asc');
    });

    it('toggles sort direction on second click', async () => {
      const user = userEvent.setup();
      const onSort = vi.fn();

      render(<CleanDataTable {...defaultProps} onSort={onSort} sortBy="name" sortDirection="asc" />);

      const nameHeader = screen.getByText('Name');
      await user.click(nameHeader);

      expect(onSort).toHaveBeenCalledWith('name', 'desc');
    });
  });

  describe('Pagination Navigation', () => {
    it('calls onPageChange when clicking next', async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();

      render(<CleanDataTable {...defaultProps} onPageChange={onPageChange} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('disables previous button on first page', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ ...defaultProps.pagination, page: 1 }} />);

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<CleanDataTable {...defaultProps} pagination={{ page: 2, pageSize: 50, total: 100, pages: 2 }} />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });
});
