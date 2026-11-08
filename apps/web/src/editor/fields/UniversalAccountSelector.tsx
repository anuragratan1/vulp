import { useState } from 'react';
import { ChevronDown, Plus, CheckCircle2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ServiceIcon, getServiceDisplayName } from '../../components/ServiceIcons.js';
import { ConnectionModal } from '../../components/ConnectionModal.js';
import { CredentialRecord } from '../../api/client.js';

export interface UniversalAccountSelectorProps {
  serviceType: string;
  credentialType?: string;
  selectedCredentialId?: string;
  credentials: CredentialRecord[];
  onSelectCredential: (id: string) => void;
  onRefreshCredentials: () => void;
  className?: string;
}

export function UniversalAccountSelector({
  serviceType,
  credentialType,
  selectedCredentialId,
  credentials,
  onSelectCredential,
  onRefreshCredentials,
  className = '',
}: UniversalAccountSelectorProps) {
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const serviceDisplayName = getServiceDisplayName(serviceType);
  const requiredCredType = credentialType || serviceType.split('.')[0];

  // Filter matching credentials
  const matchingCredentials = credentials.filter((c) => {
    if (!requiredCredType) return true;
    return (
      c.type.toLowerCase() === requiredCredType.toLowerCase() ||
      (requiredCredType === 'google' && c.type.toLowerCase().includes('google'))
    );
  });

  const selectedCred = matchingCredentials.find((c) => c.id === selectedCredentialId);

  // Auto-select first credential if none selected
  if (!selectedCredentialId && matchingCredentials.length > 0) {
    onSelectCredential(matchingCredentials[0].id);
  }

  // Extract clean identity label (e.g. "alex@company.com" from "Google Workspace (alex@company.com)")
  const getAccountIdentity = (cred?: CredentialRecord) => {
    if (!cred) return `Connect ${serviceDisplayName}`;
    const match = cred.name.match(/\(([^)]+)\)/);
    return match ? match[1] : cred.name;
  };

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <span>Connected Account</span>
          <span className="text-rose-400 font-bold" title="Required connection">
            *
          </span>
        </label>
        {selectedCred && (
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Connected</span>
          </span>
        )}
      </div>

      {selectedCred ? (
        // Compact Account Card with Dropdown Switcher
        <div className="flex items-center justify-between p-2.5 rounded-[16px] bg-[#171717] border border-[#262626] hover:border-[#383838] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            <div className="w-8 h-8 rounded-[10px] bg-[#222222] border border-[#333333] flex items-center justify-center shrink-0">
              <ServiceIcon service={serviceType} size={16} />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white tracking-tight truncate">
                {getAccountIdentity(selectedCred)}
              </div>
              <div className="text-[10px] text-[#7A7A7A] truncate font-sans">
                {selectedCred.name}
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
                  Switch Account
                </div>
                {matchingCredentials.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCredential(c.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] transition-colors text-left ${
                      c.id === selectedCredentialId
                        ? 'bg-[#262626] text-white font-semibold'
                        : 'text-[#BBBBBB] hover:bg-[#222222] hover:text-white'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate text-xs">{getAccountIdentity(c)}</div>
                      <div className="text-[10px] text-[#737373] truncate">{c.name}</div>
                    </div>
                    {c.id === selectedCredentialId && (
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
        // Clean Connect Prompt
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

      {/* Connection Modal */}
      {isConnectModalOpen && (
        <ConnectionModal
          isOpen={isConnectModalOpen}
          serviceId={requiredCredType === 'google' ? 'google' : requiredCredType}
          onClose={() => setIsConnectModalOpen(false)}
          onSuccess={() => {
            setIsConnectModalOpen(false);
            onRefreshCredentials();
          }}
        />
      )}
    </div>
  );
}
