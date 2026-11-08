import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FormFieldWrapper } from './FormFieldWrapper.js';

export interface UniversalDurationInputProps {
  label: string;
  valueMs: number;
  onChangeMs: (newMs: number) => void;
  description?: string;
  error?: string;
  className?: string;
}

type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

export function UniversalDurationInput({
  label,
  valueMs = 1000,
  onChangeMs,
  description,
  error,
  className = '',
}: UniversalDurationInputProps) {
  // Determine appropriate unit and count
  const determineInitial = (ms: number): { count: number; unit: DurationUnit } => {
    if (ms >= 86400000 && ms % 86400000 === 0) return { count: ms / 86400000, unit: 'd' };
    if (ms >= 3600000 && ms % 3600000 === 0) return { count: ms / 3600000, unit: 'h' };
    if (ms >= 60000 && ms % 60000 === 0) return { count: ms / 60000, unit: 'm' };
    if (ms >= 1000 && ms % 1000 === 0) return { count: ms / 1000, unit: 's' };
    return { count: ms, unit: 'ms' };
  };

  const initial = determineInitial(valueMs);
  const [count, setCount] = useState<number | string>(initial.count);
  const [unit, setUnit] = useState<DurationUnit>(initial.unit);

  const unitMultipliers: Record<DurationUnit, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  const unitLabels: Record<DurationUnit, string> = {
    ms: 'Milliseconds',
    s: 'Seconds',
    m: 'Minutes',
    h: 'Hours',
    d: 'Days',
  };

  const updateDuration = (newCount: number | string, newUnit: DurationUnit) => {
    const numeric = typeof newCount === 'number' ? newCount : parseFloat(newCount);
    if (!isNaN(numeric) && numeric >= 0) {
      const ms = Math.round(numeric * unitMultipliers[newUnit]);
      onChangeMs(ms);
    }
  };

  const handleCountChange = (val: string) => {
    setCount(val);
    updateDuration(val, unit);
  };

  const handleUnitChange = (newUnit: DurationUnit) => {
    setUnit(newUnit);
    updateDuration(count, newUnit);
  };

  const presets = [
    { label: '5s', ms: 5000, count: 5, unit: 's' as DurationUnit },
    { label: '30s', ms: 30000, count: 30, unit: 's' as DurationUnit },
    { label: '1m', ms: 60000, count: 1, unit: 'm' as DurationUnit },
    { label: '5m', ms: 300000, count: 5, unit: 'm' as DurationUnit },
    { label: '1h', ms: 3600000, count: 1, unit: 'h' as DurationUnit },
  ];

  const humanReadable = () => {
    const num = typeof count === 'number' ? count : parseFloat(String(count));
    if (isNaN(num) || num <= 0) return 'Immediate execution';
    const singular = num === 1;
    switch (unit) {
      case 'ms':
        return `Pauses workflow for ${num} millisecond${singular ? '' : 's'}`;
      case 's':
        return `Pauses workflow for ${num} second${singular ? '' : 's'}`;
      case 'm':
        return `Pauses workflow for ${num} minute${singular ? '' : 's'}`;
      case 'h':
        return `Pauses workflow for ${num} hour${singular ? '' : 's'}`;
      case 'd':
        return `Pauses workflow for ${num} day${singular ? '' : 's'}`;
    }
  };

  return (
    <FormFieldWrapper
      label={label}
      required={true}
      description={description || humanReadable()}
      error={error}
      allowDynamicData={false}
      className={className}
    >
      <div className="space-y-2">
        <div className="flex gap-2">
          {/* Numeric count */}
          <input
            type="number"
            min={0}
            step="any"
            value={count}
            onChange={(e) => handleCountChange(e.target.value)}
            className="flex-1 bg-[#171717] border border-[#262626] focus:border-[#4A4A4A] text-white rounded-full px-4 py-2.5 text-xs outline-none transition-all placeholder:text-[#5A5A5A]"
          />

          {/* Unit selector */}
          <div className="relative w-36">
            <select
              value={unit}
              onChange={(e) => handleUnitChange(e.target.value as DurationUnit)}
              className="w-full bg-[#171717] border border-[#262626] focus:border-[#4A4A4A] text-white rounded-full px-4 py-2.5 text-xs appearance-none outline-none cursor-pointer pr-9"
            >
              {(Object.keys(unitMultipliers) as DurationUnit[]).map((u) => (
                <option key={u} value={u} className="bg-[#171717] text-white">
                  {unitLabels[u]}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-[#737373] mr-1">Presets:</span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setCount(p.count);
                setUnit(p.unit);
                onChangeMs(p.ms);
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                valueMs === p.ms
                  ? 'bg-[#FF7306] text-white'
                  : 'bg-[#1E1E1E] text-[#8E8E8E] hover:text-white hover:bg-[#262626]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </FormFieldWrapper>
  );
}
