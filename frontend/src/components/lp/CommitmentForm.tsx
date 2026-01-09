import { useState, useEffect } from 'react';
import { TrendingUp, Calendar, DollarSign, FileText, Search, X } from 'lucide-react';
import { FundCommitment } from '@/types/lp';
import { Modal } from '@/components/ui';
import { useFundSearch } from '@/services/fundsApi';
import { Fund } from '@/types/fund';

interface CommitmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (commitment: Omit<FundCommitment, 'id'>) => void;
  editingCommitment?: FundCommitment | null;
  lpId: string;
}

const statuses: Array<'Active' | 'Fully Called' | 'Cancelled'> = ['Active', 'Fully Called', 'Cancelled'];

export function CommitmentForm({
  isOpen,
  onClose,
  onSubmit,
  editingCommitment,
  lpId
}: CommitmentFormProps) {
  const [formData, setFormData] = useState({
    fund_id: '',
    fund_name: '',
    fund_strategy: '',
    commitment_amount_raw: '',
    commitment_date: '',
    capital_called: '',
    status: 'Active' as 'Active' | 'Fully Called' | 'Cancelled',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fundSearchQuery, setFundSearchQuery] = useState('');
  const [showFundDropdown, setShowFundDropdown] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  // Fund search
  const { data: fundSearchResults, isLoading: isFundSearchLoading } = useFundSearch({
    search: fundSearchQuery,
    limit: 20,
    offset: 0,
    sort_by: 'name',
    order: 'asc',
  });

  useEffect(() => {
    if (editingCommitment) {
      setFormData({
        fund_id: editingCommitment.fund_id,
        fund_name: editingCommitment.fund_name || '',
        fund_strategy: editingCommitment.fund_strategy || '',
        commitment_amount_raw: editingCommitment.commitment_amount_raw || '',
        commitment_date: editingCommitment.commitment_date || '',
        capital_called: editingCommitment.capital_called?.toString() || '0',
        status: editingCommitment.status || 'Active',
        notes: editingCommitment.notes || ''
      });
      if (editingCommitment.fund_name) {
        setSelectedFund({
          id: editingCommitment.fund_id,
          name: editingCommitment.fund_name,
          strategy: editingCommitment.fund_strategy,
        } as Fund);
      }
    } else {
      setFormData({
        fund_id: '',
        fund_name: '',
        fund_strategy: '',
        commitment_amount_raw: '',
        commitment_date: '',
        capital_called: '0',
        status: 'Active',
        notes: ''
      });
      setSelectedFund(null);
    }
    setErrors({});
    setFundSearchQuery('');
    setShowFundDropdown(false);
  }, [editingCommitment, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fund_id) newErrors.fund_id = 'Fund is required';
    if (!formData.commitment_amount_raw.trim()) newErrors.commitment_amount_raw = 'Commitment amount is required';
    if (!formData.commitment_date) newErrors.commitment_date = 'Commitment date is required';

    // Validate amount format
    if (formData.commitment_amount_raw && !formData.commitment_amount_raw.match(/^\$?[\d.,]+[BMK]?$/i)) {
      newErrors.commitment_amount_raw = 'Invalid amount format (e.g., $10M, $2.5B)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Parse commitment amount
    let commitmentAmount = 0;
    const amountStr = formData.commitment_amount_raw.replace(/[$,]/g, '');
    const multiplier = amountStr.match(/[BMK]$/i)?.[0].toUpperCase();
    const numValue = parseFloat(amountStr.replace(/[BMK]$/i, ''));

    if (multiplier === 'B') {
      commitmentAmount = numValue * 1_000_000_000;
    } else if (multiplier === 'M') {
      commitmentAmount = numValue * 1_000_000;
    } else if (multiplier === 'K') {
      commitmentAmount = numValue * 1_000;
    } else {
      commitmentAmount = numValue;
    }

    // Parse capital called
    const capitalCalled = parseFloat(formData.capital_called) || 0;

    // Calculate percent called
    const percentCalled = commitmentAmount > 0 ? (capitalCalled / commitmentAmount) * 100 : 0;

    onSubmit({
      lp_id: lpId,
      fund_id: formData.fund_id,
      fund_name: formData.fund_name,
      fund_strategy: formData.fund_strategy,
      commitment_amount_raw: formData.commitment_amount_raw,
      commitment_amount: commitmentAmount,
      commitment_date: formData.commitment_date,
      capital_called: capitalCalled,
      capital_called_raw: `$${(capitalCalled / 1_000_000).toFixed(1)}M`,
      percent_called: percentCalled,
      status: formData.status,
      notes: formData.notes
    });
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFundSelect = (fund: Fund) => {
    setSelectedFund(fund);
    setFormData(prev => ({
      ...prev,
      fund_id: fund.id,
      fund_name: fund.name,
      fund_strategy: fund.strategy || '',
    }));
    setFundSearchQuery('');
    setShowFundDropdown(false);
    if (errors.fund_id) {
      setErrors(prev => ({ ...prev, fund_id: '' }));
    }
  };

  const handleFundSearchChange = (value: string) => {
    setFundSearchQuery(value);
    setShowFundDropdown(value.trim().length > 0);
  };

  const handleRemoveFund = () => {
    setSelectedFund(null);
    setFormData(prev => ({
      ...prev,
      fund_id: '',
      fund_name: '',
      fund_strategy: '',
    }));
  };

  // Calculate percent called for display
  const calculatePercentCalled = () => {
    const amountStr = formData.commitment_amount_raw.replace(/[$,]/g, '');
    const multiplier = amountStr.match(/[BMK]$/i)?.[0].toUpperCase();
    const numValue = parseFloat(amountStr.replace(/[BMK]$/i, ''));
    let commitmentAmount = 0;

    if (multiplier === 'B') {
      commitmentAmount = numValue * 1_000_000_000;
    } else if (multiplier === 'M') {
      commitmentAmount = numValue * 1_000_000;
    } else if (multiplier === 'K') {
      commitmentAmount = numValue * 1_000;
    } else {
      commitmentAmount = numValue || 0;
    }

    const capitalCalled = parseFloat(formData.capital_called) || 0;
    return commitmentAmount > 0 ? ((capitalCalled / commitmentAmount) * 100).toFixed(1) : '0.0';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCommitment ? 'Edit Fund Commitment' : 'Add New Fund Commitment'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fund Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Fund *
          </label>

          {selectedFund ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-slate-900">{selectedFund.name}</p>
                {selectedFund.strategy && (
                  <p className="text-xs text-slate-600">{selectedFund.strategy}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRemoveFund}
                className="p-1 hover:bg-blue-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={fundSearchQuery}
                onChange={(e) => handleFundSearchChange(e.target.value)}
                placeholder="Search for a fund..."
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.fund_id ? 'border-red-300' : 'border-slate-300'
                }`}
              />

              {showFundDropdown && fundSearchResults && fundSearchResults.funds.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {fundSearchResults.funds.map((fund) => (
                    <button
                      key={fund.id}
                      type="button"
                      onClick={() => handleFundSelect(fund)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      <p className="font-medium text-slate-900">{fund.name}</p>
                      {fund.strategy && (
                        <p className="text-xs text-slate-600 mt-0.5">{fund.strategy}</p>
                      )}
                      {fund.aum_raw && (
                        <p className="text-xs text-slate-500 mt-0.5">AUM: {fund.aum_raw}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {isFundSearchLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          )}
          {errors.fund_id && <p className="mt-1 text-sm text-red-600">{errors.fund_id}</p>}
        </div>

        {/* Commitment Amount and Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-2" />
              Commitment Amount *
            </label>
            <input
              type="text"
              value={formData.commitment_amount_raw}
              onChange={(e) => handleInputChange('commitment_amount_raw', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.commitment_amount_raw ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="e.g., $10M, $2.5B"
            />
            {errors.commitment_amount_raw && (
              <p className="mt-1 text-sm text-red-600">{errors.commitment_amount_raw}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Commitment Date *
            </label>
            <input
              type="date"
              value={formData.commitment_date}
              onChange={(e) => handleInputChange('commitment_date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.commitment_date ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {errors.commitment_date && (
              <p className="mt-1 text-sm text-red-600">{errors.commitment_date}</p>
            )}
          </div>
        </div>

        {/* Capital Called */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            Capital Called (in raw dollars)
          </label>
          <input
            type="number"
            value={formData.capital_called}
            onChange={(e) => handleInputChange('capital_called', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., 5000000"
            step="1000"
          />
          {formData.commitment_amount_raw && formData.capital_called && (
            <p className="mt-1 text-sm text-slate-600">
              {calculatePercentCalled()}% of commitment called
            </p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Status
          </label>
          <div className="flex space-x-4">
            {statuses.map(status => (
              <label key={status} className="flex items-center">
                <input
                  type="radio"
                  value={status}
                  checked={formData.status === status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className={`px-2 py-1 rounded-full text-xs border ${
                  status === 'Active'
                    ? 'bg-green-500/20 text-green-700 border-green-500/30'
                    : status === 'Fully Called'
                    ? 'bg-blue-500/20 text-blue-700 border-blue-500/30'
                    : 'bg-red-500/20 text-red-700 border-red-500/30'
                }`}>
                  {status}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Additional notes about this commitment"
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {editingCommitment ? 'Update Commitment' : 'Add Commitment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
