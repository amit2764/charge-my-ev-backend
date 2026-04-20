export default function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-5xl transition-transform ${!disabled ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${value >= star ? 'text-yellow-400' : 'text-gray-700'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
