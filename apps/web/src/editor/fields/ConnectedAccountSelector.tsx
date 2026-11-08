import { useState, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, CredentialRecord } from '../../api/client.js';
import { ServiceIcon } from '../../components/ServiceIcons.js';
import { ConnectionModal } from '../../components/ConnectionModal.js';

export interface ConnectedAccountSelectorProps {
  serviceType: string;
  credentialType: string;
  value?: string;
  onChange: (credentialId: string) => void;
  required?: boolean;
  className?: string;
}

export function ConnectedAccountSelector({
  serviceType,
  credentialType,
  value,
  onChange,
  required = true,
  className = '',
}: ConnectedAccountSelectorProps) {
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const loadCredentials = async () => {
    try {
      const list = await api.getCredentials();
      const filtered = list.filter((c) => c.type === credentialType);
      setCredentials(filtered);

      if (!value && filtered.length > 0) {
        onChange(filtered[0].id);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadCredentials();
  }, [credentialType]);

  const activeCred = credentials.find((c) => c.id === value);

  const getAccountIdentity = (cred?: CredentialRecord) => {
    if (!cred) return 'No Account Connected';
    const match = cred.name.match(/\(([^)]+)\)/);
    return match ? match[1] : cred.name;
  };

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <span>Connected Account</span>
          {required && (
            <span className="text-rose-400 font-bold" title="Required connection">
              *
            </span>
          )}
        </label>
        {activeCred && (
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Connected</span>
          </span>
        )}
      </div>

      {activeCred ? (
        <div className="flex items-center justify-between p-2.5 rounded-[16px] bg-[#171717] border border-[#262626] hover:border-[#383838] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <div className="w-8 h-8 rounded-[10px] bg-[#222222] border border-[#333333] flex items-center justify-center shrink-0">
              <ServiceIcon service={serviceType} size={16} />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white tracking-tight truncate">
                {getAccountIdentity(activeCred)}
              </div>
              <div className="text-[10px] text-[#7A7A7A] truncate font-sans">
                {activeCred.name}
              </div>
            </div>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-full bg-[#202020] hover:bg-[#2A2A2A] text-[11px] font-medium text-[#CCCCCC] hover:text-white flex items-center gap-1 transition-colors shrink-0"
              >
                <span>Switch</span>
                <ChevronDown className="w-3 h-3 text-[#888888]" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-64 p-1.5 rounded-[16px] bg-[#1A1A1A] border border-[#2E2E2E] shadow-2xl space-y-1 text-xs"
              >
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[#737373] font-bold">
                  Switch Connected Account
                </div>
                {credentials.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] transition-colors text-left ${
                      c.id === value
                        ? 'bg-[#262626] text-white font-semibold'
                        : 'text-[#BBBBBB] hover:bg-[#222222] hover:text-white'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate text-xs">{getAccountIdentity(c)}</div>
                      <div className="text-[10px] text-[#737373] truncate">{c.name}</div>
                    </div>
                    {c.id === value && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF7306] shrink-0" />
                    )}
                  </button>
                ))}
                <div className="border-t border-[#262626] my-1" />
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-left text-xs font-medium text-[#FF7306] hover:bg-[#FF7306]/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect another account</span>
                </button>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      ) : (
        <div className="p-3.5 rounded-[16px] bg-[#171717] border border-dashed border-[#333333] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#222222] border border-[#333333] flex items-center justify-center shrink-0">
              <ServiceIcon service={serviceType} size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">No account connected</div>
              <div className="text-[10.5px] text-[#7A7A7A]">Connect to run this automation</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsConnectModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-[#FF7306] hover:bg-[#E56600] text-black text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            <span>Connect</span>
          </button>
        </div>
      )}

      {isConnectModalOpen && (
        <ConnectionModal
          isOpen={isConnectModalOpen}
          serviceId={credentialType === 'google' ? 'google' : credentialType}
          onClose={() => setIsConnectModalOpen(false)}
          onSuccess={() => {
            setIsConnectModalOpen(false);
            loadCredentials();
          }}
        />
      )}
    </div>
  );
}
