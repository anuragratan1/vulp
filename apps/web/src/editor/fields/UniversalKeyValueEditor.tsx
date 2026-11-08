import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Variable } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DynamicDataPicker } from './DynamicDataPicker.js';
import { CanvasNode } from '../graphConverter.js';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

export interface UniversalKeyValueEditorProps {
  label: string;
  value: Record<string, any> | string;
  onChange: (newValue: Record<string, any>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  description?: string;
  suggestions?: Array<{ key: string; value: string }>;
  allNodes?: CanvasNode[];
  currentNodeId?: string;
  className?: string;
}

function parseValueToPairs(val: Record<string, any> | string): KeyValuePair[] {
  let obj: Record<string, any> = {};
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    obj = val;
  } else if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        obj = parsed;
      }
    } catch {}
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return [{ id: 'row_0', key: '', value: '' }];
  }
  return entries.map(([k, v], idx) => ({
    id: `row_${idx}_${k}`,
    key: k,
    value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
  }));
}

function serializeValue(val: Record<string, any> | string): string {
  try {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return JSON.stringify(val);
    }
    if (typeof val === 'string') {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed);
    }
  } catch {}
  return String(val || '');
}

export function UniversalKeyValueEditor({
  label,
  value,
  onChange,
  keyPlaceholder = 'Key (e.g. Content-Type)',
  valuePlaceholder = 'Value (e.g. application/json)',
  description,
  suggestions = [],
  allNodes = [],
  currentNodeId = '',
  className = '',
}: UniversalKeyValueEditorProps) {
  const [pairs, setPairs] = useState<KeyValuePair[]>(() => parseValueToPairs(value));
  const [activePickerRowId, setActivePickerRowId] = useState<string | null>(null);
  const lastNotifiedJsonRef = useRef<string>(serializeValue(value));

  // Synchronize internal rows whenever value prop updates externally (e.g. presets, external resets)
  useEffect(() => {
    const incomingJson = serializeValue(value);

    // If incoming value is identical to what this editor just notified parent about, skip
    if (incomingJson === lastNotifiedJsonRef.current) {
      return;
    }

    // Check if incoming value semantically matches current rows (ignoring blank in-progress rows)
    const currentPairsObj: Record<string, any> = {};
    for (const p of pairs) {
      const trimmedKey = p.key.trim();
      if (trimmedKey) {
        let val: any = p.value;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
        currentPairsObj[trimmedKey] = val;
      }
    }

    if (JSON.stringify(currentPairsObj) === incomingJson) {
      lastNotifiedJsonRef.current = incomingJson;
      return;
    }

    // External change detected: synchronize state immediately
    lastNotifiedJsonRef.current = incomingJson;
    setPairs(parseValueToPairs(value));
  }, [value]);

  const notifyChange = (newPairs: KeyValuePair[]) => {
    const result: Record<string, any> = {};
    for (const p of newPairs) {
      const trimmedKey = p.key.trim();
      if (trimmedKey) {
        // Try parsing JSON or numbers if appropriate, else store string
        let val: any = p.value;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
        result[trimmedKey] = val;
      }
    }
    lastNotifiedJsonRef.current = JSON.stringify(result);
    onChange(result);
  };

  const handleUpdateRow = (id: string, field: 'key' | 'value', val: string) => {
    const updated = pairs.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    setPairs(updated);
    notifyChange(updated);
  };

  const handleAddRow = (k = '', v = '') => {
    const newRow: KeyValuePair = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: k,
      value: v,
    };
    const updated = [...pairs, newRow];
    setPairs(updated);
    notifyChange(updated);
  };

  const handleDeleteRow = (id: string) => {
    const filtered = pairs.filter((p) => p.id !== id);
    const finalPairs = filtered.length > 0 ? filtered : [{ id: `row_${Date.now()}`, key: '', value: '' }];
    setPairs(finalPairs);
    notifyChange(finalPairs);
  };

  return (
    <div className={`space-y-2 text-xs font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3]">{label}</label>
        <button
          type="button"
          onClick={() => handleAddRow()}
          className="flex items-center gap-1 text-[11px] font-medium text-[#FF7306] hover:text-[#FFA154] transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Add row</span>
        </button>
      </div>

      {description && <p className="text-[11px] text-[#737373] leading-relaxed">{description}</p>}

      {/* Suggested Quick Add Chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-[#737373]">Suggestions:</span>
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => handleAddRow(s.key, s.value)}
              className="px-2 py-0.5 rounded-full bg-[#1C1C1C] hover:bg-[#252525] border border-[#2A2A2A] text-[10px] text-[#A0A0A0] hover:text-white transition-colors"
            >
              + {s.key}
            </button>
          ))}
        </div>
      )}

      {/* Key-Value Rows */}
      <div className="space-y-2 pt-1">
        {pairs.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            {/* Key */}
            <input
              type="text"
              value={row.key}
              onChange={(e) => handleUpdateRow(row.id, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className="w-1/3 bg-[#171717] border border-[#262626] focus:border-[#4A4A4A] text-white rounded-full px-3.5 py-2 text-xs outline-none transition-all placeholder:text-[#5A5A5A]"
            />

            {/* Value with Dynamic Picker button */}
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={row.value}
                onChange={(e) => handleUpdateRow(row.id, 'value', e.target.value)}
                placeholder={valuePlaceholder}
                className="w-full bg-[#171717] border border-[#262626] focus:border-[#4A4A4A] text-white rounded-full pl-3.5 pr-8 py-2 text-xs outline-none transition-all placeholder:text-[#5A5A5A]"
              />

              {/* Dynamic Picker Dropdown */}
              <DropdownMenu.Root
                open={activePickerRowId === row.id}
                onOpenChange={(isOpen: boolean) => setActivePickerRowId(isOpen ? row.id : null)}
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="absolute right-2 p-1 rounded-full text-[#737373] hover:text-[#FF7306] hover:bg-[#222222] transition-colors"
                    title="Insert variable from previous step"
                  >
                    <Variable className="w-3 h-3" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content side="bottom" align="end" sideOffset={8} className="z-50">
                    <DynamicDataPicker
                      allNodes={allNodes}
                      currentNodeId={currentNodeId}
                      onSelect={(expr) => {
                        const cur = row.value;
                        const nextVal = !cur ? expr : `${cur} ${expr}`;
                        handleUpdateRow(row.id, 'value', nextVal);
                        setActivePickerRowId(null);
                      }}
                      onClose={() => setActivePickerRowId(null)}
                    />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => handleDeleteRow(row.id)}
              className="p-1.5 rounded-full text-[#737373] hover:text-rose-400 hover:bg-[#222222] transition-colors shrink-0"
              title="Delete row"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
