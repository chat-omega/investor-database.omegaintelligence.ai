/**
 * CellExpandModal Component
 * Shows full cell content in a modal for viewing long text
 */
import { useState } from 'react';
import { X, Copy, Check, Maximize2 } from 'lucide-react';

interface CellExpandModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  value: string;
}

export function CellExpandModal({ isOpen, onClose, columnName, value }: CellExpandModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <Maximize2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-white font-medium">{columnName}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {value || <span className="text-slate-500 italic">No content</span>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
          {value.length.toLocaleString()} characters
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage cell expand modal state
 */
export function useCellExpandModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    columnName: string;
    value: string;
  }>({
    isOpen: false,
    columnName: '',
    value: '',
  });

  const openModal = (columnName: string, value: string) => {
    setModalState({
      isOpen: true,
      columnName,
      value,
    });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  return {
    modalState,
    openModal,
    closeModal,
  };
}
