/**
 * ColumnManager component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnManager } from '../ColumnManager';

describe('ColumnManager', () => {
  const mockOnClose = vi.fn();
  const mockOnAddColumn = vi.fn();
  const mockOnDeleteColumn = vi.fn();
  const mockOnRenameColumn = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    customColumns: [],
    onAddColumn: mockOnAddColumn,
    onDeleteColumn: mockOnDeleteColumn,
    onRenameColumn: mockOnRenameColumn,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAddColumn.mockResolvedValue(undefined);
    mockOnDeleteColumn.mockResolvedValue(undefined);
    mockOnRenameColumn.mockResolvedValue(undefined);
  });

  it('renders nothing when not open', () => {
    render(<ColumnManager {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Manage Columns')).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(<ColumnManager {...defaultProps} />);

    expect(screen.getByText('Manage Columns')).toBeInTheDocument();
    expect(screen.getByText('Add New Column')).toBeInTheDocument();
    expect(screen.getByText('Custom Columns')).toBeInTheDocument();
  });

  it('shows empty state when no custom columns', () => {
    render(<ColumnManager {...defaultProps} />);

    expect(screen.getByText(/No custom columns yet/)).toBeInTheDocument();
  });

  it('shows existing custom columns', () => {
    render(
      <ColumnManager
        {...defaultProps}
        customColumns={[
          { key: 'ceo_name', name: 'CEO Name', type: 'text', source: 'user' },
          { key: 'revenue', name: 'Revenue', type: 'number', source: 'user' },
        ]}
      />
    );

    expect(screen.getByText('CEO Name')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('calls onAddColumn when adding new column', async () => {
    const user = userEvent.setup();

    render(<ColumnManager {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('Column name');
    await user.type(nameInput, 'New Column');

    const addButton = screen.getByRole('button', { name: /add column/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockOnAddColumn).toHaveBeenCalledWith({
        name: 'New Column',
        type: 'text',
      });
    });
  });

  it('clears input after successful column addition', async () => {
    const user = userEvent.setup();

    render(<ColumnManager {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('Column name');
    await user.type(nameInput, 'Test Column');

    const addButton = screen.getByRole('button', { name: /add column/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(nameInput).toHaveValue('');
    });
  });

  it('shows error when adding column fails', async () => {
    const user = userEvent.setup();
    mockOnAddColumn.mockRejectedValue(new Error('Failed to add'));

    render(<ColumnManager {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('Column name');
    await user.type(nameInput, 'Test Column');

    const addButton = screen.getByRole('button', { name: /add column/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to add')).toBeInTheDocument();
    });
  });

  it('disables add button when column name is empty', async () => {
    render(<ColumnManager {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add column/i });
    expect(addButton).toBeDisabled();

    expect(mockOnAddColumn).not.toHaveBeenCalled();
  });

  it('allows selecting column type', async () => {
    const user = userEvent.setup();

    render(<ColumnManager {...defaultProps} />);

    const nameInput = screen.getByPlaceholderText('Column name');
    await user.type(nameInput, 'Numeric Column');

    // Select number type
    const typeSelect = screen.getByRole('combobox');
    await user.selectOptions(typeSelect, 'number');

    const addButton = screen.getByRole('button', { name: /add column/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockOnAddColumn).toHaveBeenCalledWith({
        name: 'Numeric Column',
        type: 'number',
      });
    });
  });

  it('calls onClose when clicking backdrop', async () => {
    const user = userEvent.setup();

    const { container } = render(<ColumnManager {...defaultProps} />);

    // Find and click backdrop
    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) {
      await user.click(backdrop);
    }

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking Done button', async () => {
    const user = userEvent.setup();

    render(<ColumnManager {...defaultProps} />);

    const doneButton = screen.getByRole('button', { name: /done/i });
    await user.click(doneButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onDeleteColumn when deleting a column', async () => {
    const user = userEvent.setup();

    render(
      <ColumnManager
        {...defaultProps}
        customColumns={[
          { key: 'test_col', name: 'Test Column', type: 'text', source: 'user' },
        ]}
      />
    );

    // Hover over the column to show delete button
    const columnItem = screen.getByText('Test Column').closest('div');
    if (columnItem) {
      await user.hover(columnItem);
    }

    const deleteButton = screen.getByTitle('Delete');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockOnDeleteColumn).toHaveBeenCalledWith('test_col');
    });
  });

  it('shows enriched icon for enriched columns', () => {
    render(
      <ColumnManager
        {...defaultProps}
        customColumns={[
          {
            key: 'ai_col',
            name: 'AI Generated',
            type: 'enriched',
            source: 'parallel',
            enrichment_prompt: 'Who is the CEO?',
          },
        ]}
      />
    );

    expect(screen.getByText('AI Generated')).toBeInTheDocument();
    expect(screen.getByText('(enriched)')).toBeInTheDocument();
  });
});
