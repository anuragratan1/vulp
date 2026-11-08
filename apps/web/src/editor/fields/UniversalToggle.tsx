export interface UniversalToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function UniversalToggle({
  label,
  value,
  onChange,
  description,
  disabled = false,
  className = '',
}: UniversalToggleProps) {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!value);
      }}
      className={`p-3.5 rounded-[18px] bg-[#171717] border border-[#262626] hover:border-[#333333] flex items-center justify-between cursor-pointer transition-all select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div className="pr-4 truncate">
        <span className="text-xs font-medium text-white block truncate">{label}</span>
        {description && (
          <span className="text-[11px] text-[#737373] block mt-0.5 leading-snug truncate">
            {description}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 relative ${
          value ? 'bg-[#FF7306]' : 'bg-[#282828]'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm block ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
