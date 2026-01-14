/**
 * ColumnFilter component
 * Inline dropdown filter for categorical columns
 */
import { useColumnDistinctValues } from '@/services/cleanDataApi';

interface ColumnFilterProps {
  datasetId: string;
  sheetId: string;
  columnKey: string;
  columnName: string;
  selectedValue: string | null;
  onFilterChange: (value: string | null) => void;
}

export function ColumnFilter({
  datasetId,
  sheetId,
  columnKey,
  columnName,
  selectedValue,
  onFilterChange,
}: ColumnFilterProps) {
  const { data: values, isLoading, error } = useColumnDistinctValues(
    datasetId,
    sheetId,
    columnKey
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange(value === '' ? null : value);
  };

  return (
    <select
      value={selectedValue ?? ''}
      onChange={handleChange}
      disabled={isLoading}
      className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Filter by ${columnName}`}
    >
      <option value="">All</option>
      {values?.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
