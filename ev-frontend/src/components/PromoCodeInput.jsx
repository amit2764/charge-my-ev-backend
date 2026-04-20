import { Button, Input, Card } from '../components';

export default function PromoCodeInput({
  code,
  onCodeChange,
  onValidate,
  validating,
  error,
  discount,
  appliedCode
}) {
  const handleApply = async () => {
    if (code && code.trim()) {
      await onValidate(code);
    }
  };

  const handleClear = () => {
    onCodeChange('');
  };

  const discountDisplay = discount ? (
    discount.type === 'percent'
      ? `${discount.value}% off`
      : `₹${Number(discount.value || 0).toFixed(0)} off`
  ) : null;

  return (
    <Card>
      <h3 className="mb-3 text-base font-bold text-cyan-300">Promo Code (Optional)</h3>
      <div className="space-y-2">
        <Input
          label="Enter code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="e.g., SAVE10"
          disabled={validating || !!appliedCode}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        {appliedCode && discount && (
          <div className="rounded-lg border border-emerald-600 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
            <p className="font-semibold">✓ {appliedCode}</p>
            <p className="text-xs opacity-90">Discount: {discountDisplay}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            disabled={!code || code.trim() === '' || validating || !!appliedCode}
            className="flex-1"
          >
            {validating ? 'Validating...' : 'Apply Code'}
          </Button>
          {appliedCode && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
