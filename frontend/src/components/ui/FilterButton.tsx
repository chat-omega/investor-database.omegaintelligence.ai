import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterButtonProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  multiSelect?: boolean;
  className?: string;
}

export function FilterButton({ 
  label, 
  options, 
  selectedValues, 
  onChange, 
  multiSelect = false,
  className = '' 
}: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (value: string) => {
    if (multiSelect) {
      if (selectedValues.includes(value)) {
        onChange(selectedValues.filter(v => v !== value));
      } else {
        onChange([...selectedValues, value]);
      }
    } else {
      onChange(selectedValues.includes(value) ? [] : [value]);
      setIsOpen(false);
    }
  };

  const hasSelections = selectedValues.length > 0;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between px-4 py-2 bg-white border border-slate-300 rounded-lg
          transition-all duration-200 hover:border-slate-400
          ${hasSelections ? 'border-accent-500 bg-accent-50 text-accent-700' : 'text-slate-700'}
          ${isOpen ? 'ring-2 ring-accent-500/20' : ''}
        `}
      >
        <span className="font-medium text-sm">
          {label}
          {hasSelections && (
            <span className="ml-1 px-1.5 py-0.5 bg-accent-100 text-accent-700 rounded text-xs">
              {selectedValues.length}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 animate-slide-up">
          <div className="py-1 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center">
                  <span className="text-sm text-slate-900">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="ml-2 text-xs text-slate-500">({option.count})</span>
                  )}
                </div>
                {selectedValues.includes(option.value) && (
                  <Check className="w-4 h-4 text-accent-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}