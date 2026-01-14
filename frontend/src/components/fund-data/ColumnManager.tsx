/**
 * ColumnManager Component
 * Modal for managing custom columns in export sessions
 */
import { useState } from 'react';
import { X, Plus, Trash2, Loader2, Sparkles, Edit2, Check } from 'lucide-react';
import type { CustomColumn, CreateColumnParams } from '@/services/cleanDataApi';

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
  customColumns: CustomColumn[];
  onAddColumn: (params: CreateColumnParams) => Promise<void>;
  onDeleteColumn: (key: string) => Promise<void>;
  onRenameColumn: (key: string, name: string) => Promise<void>;
  isLoading?: boolean;
}

export function ColumnManager({
  isOpen,
  onClose,
  customColumns,
  onAddColumn,
  onDeleteColumn,
  onRenameColumn,
  isLoading,
}: ColumnManagerProps) {
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<'text' | 'number'>('text');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      setError('Column name is required');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      await onAddColumn({
        name: newColumnName.trim(),
        type: newColumnType,
      });
      setNewColumnName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteColumn = async (key: string) => {
    setDeletingKey(key);
    setError(null);

    try {
      await onDeleteColumn(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleStartRename = (col: CustomColumn) => {
    setEditingKey(col.key);
    setEditingName(col.name);
  };

  const handleSaveRename = async (key: string) => {
    if (!editingName.trim()) {
      setError('Column name is required');
      return;
    }

    setError(null);

    try {
      await onRenameColumn(key, editingName.trim());
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename column');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Manage Columns</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Add new column section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Add New Column</h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Column name"
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                />
                <select
                  value={newColumnType}
                  onChange={(e) => setNewColumnType(e.target.value as 'text' | 'number')}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <button
                onClick={handleAddColumn}
                disabled={isAdding || !newColumnName.trim()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Add Column</span>
              </button>
            </div>
          </div>

          {/* Existing custom columns */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Custom Columns</h3>
            {customColumns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No custom columns yet. Add a column above to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {customColumns.map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg group"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {col.type === 'enriched' && (
                        <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      )}
                      {editingKey === col.key ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(col.key);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(col.key)}
                            className="p-1 hover:bg-slate-600 rounded"
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-white truncate">{col.name}</span>
                          <span className="text-xs text-slate-500">({col.type})</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingKey !== col.key && (
                        <>
                          <button
                            onClick={() => handleStartRename(col)}
                            className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-colors"
                            title="Rename"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteColumn(col.key)}
                            disabled={deletingKey === col.key}
                            className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            {deletingKey === col.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
