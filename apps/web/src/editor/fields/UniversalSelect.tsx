import { ChevronDown } from 'lucide-react';
import { FormFieldWrapper } from './FormFieldWrapper.js';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface UniversalSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | SelectOption>;
  placeholder?: string;
  required?: boolean;
  optionalBadge?: boolean;
  description?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function UniversalSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  optionalBadge,
  description,
  error,
  disabled = false,
  className = '',
}: UniversalSelectProps) {
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <FormFieldWrapper
      label={label}
      required={required}
      optionalBadge={optionalBadge}
      description={description}
      error={error}
      allowDynamicData={false}
      className={className}
    >
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-[#171717] border ${
            error ? 'border-rose-500/80 focus:border-rose-500' : 'border-[#262626] focus:border-[#4A4A4A]'
          } text-white rounded-full px-4 py-2.5 text-xs appearance-none outline-none transition-all cursor-pointer pr-10 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#171717] text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3.5 top-3 pointer-events-none" />
      </div>
    </FormFieldWrapper>
  );
}
