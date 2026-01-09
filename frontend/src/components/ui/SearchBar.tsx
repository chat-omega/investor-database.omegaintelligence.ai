import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export function SearchBar({ 
  placeholder = 'Search...', 
  value, 
  onChange, 
  onClear,
  className = '' 
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`
        relative flex items-center bg-white border border-slate-300 rounded-lg
        transition-all duration-200
        ${isFocused ? 'border-accent-500 ring-2 ring-accent-500/20' : 'hover:border-slate-400'}
      `}>
        <Search className="w-4 h-4 text-slate-400 ml-3" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full py-3 px-3 text-slate-900 placeholder-slate-500 bg-transparent border-none outline-none"
        />
        {value && (
          <button
            onClick={handleClear}
            className="p-2 mr-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}