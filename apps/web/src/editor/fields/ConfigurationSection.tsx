import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ConfigurationSectionProps {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

export function ConfigurationSection({
  title,
  description,
  collapsible = false,
  defaultOpen = true,
  badge,
  children,
  className = '',
}: ConfigurationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3 font-sans ${className}`}
    >
      <div
        className={`flex items-center justify-between ${
          collapsible ? 'cursor-pointer select-none group' : ''
        }`}
        onClick={() => {
          if (collapsible) setIsOpen(!isOpen);
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white tracking-tight">{title}</h4>
            {badge && (
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[#242424] text-[#A0A0A0]">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-[#787878] leading-relaxed mt-0.5">{description}</p>
          )}
        </div>

        {collapsible && (
          <button
            type="button"
            className="p-1 rounded-full text-[#666666] group-hover:text-white transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}
      </div>

      {(!collapsible || isOpen) && (
        <div className="space-y-3.5 pt-0.5 animate-in fade-in-0 duration-150">{children}</div>
      )}
    </div>
  );
}

