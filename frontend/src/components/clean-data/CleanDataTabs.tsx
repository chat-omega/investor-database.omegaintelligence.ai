/**
 * Tab navigation for sheets within a dataset
 */
import type { SheetInfo } from '@/types/cleanData';
import { formatNumber } from '@/services/cleanDataApi';

interface CleanDataTabsProps {
  sheets: SheetInfo[];
  activeSheet: string;
  onTabChange: (sheetId: string) => void;
}

export function CleanDataTabs({ sheets, activeSheet, onTabChange }: CleanDataTabsProps) {
  return (
    <div className="border-b border-slate-700/20 bg-slate-800/50">
      <div className="flex space-x-1 px-4">
        {sheets.map(sheet => {
          const isActive = sheet.id === activeSheet;
          return (
            <button
              key={sheet.id}
              onClick={() => onTabChange(sheet.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span>{sheet.display_name}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {formatNumber(sheet.row_count)}
                </span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
