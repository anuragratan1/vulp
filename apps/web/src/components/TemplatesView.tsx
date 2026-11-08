import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutTemplate,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  api,
  WorkflowTemplateRecord,
  WorkflowRecord,
  ConnectionRecord,
} from '../api/client.js';
import { ServiceIcon } from './ServiceIcons.js';
import { ConnectionModal } from './ConnectionModal.js';

interface TemplatesViewProps {
  onBack: () => void;
  onOpenWorkflow: (workflow: WorkflowRecord) => void;
}

const CATEGORIES = [
  'All',
  'Productivity',
  'Email & Communication',
  'Marketing',
  'Sales & Leads',
  'Developer Tools',
  'Google Workspace',
  'Personal Productivity',
];

export function TemplatesView({ onBack, onOpenWorkflow }: TemplatesViewProps) {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cachedTemplates = api.getCachedTemplates();
  const cachedConnections = api.getCachedConnections();
  const hasCache = cachedTemplates !== null;

  const [templates, setTemplates] = useState<WorkflowTemplateRecord[]>(() => cachedTemplates || []);
  const [connections, setConnections] = useState<ConnectionRecord[]>(() => cachedConnections || []);
  const [loading, setLoading] = useState(!hasCache);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplateRecord | null>(null);
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModalService, setActiveModalService] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (!api.getCachedTemplates()) setLoading(true);
      const [tpls, conns] = await Promise.all([
        api.getTemplates(),
        api.getConnections().catch(() => []),
      ]);
      if (!isMountedRef.current) return;
      setTemplates(tpls);
      setConnections(conns);
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to load templates');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUseTemplate = async (templateId: string) => {
    try {
      setInstantiatingId(templateId);
      setError(null);
      const res = await api.instantiateTemplate(templateId);
      setPreviewTemplate(null);
      onOpenWorkflow(res.workflow);
    } catch (err: any) {
      setError(err.message || 'Failed to instantiate template');
    } finally {
      setInstantiatingId(null);
    }
  };

  const isServiceConnected = (serviceType: string) => {
    return connections.some((c) => c.type.toLowerCase() === serviceType.toLowerCase());
  };

  // Map templates to categories
  const getTemplateCategories = (tpl: WorkflowTemplateRecord): string[] => {
    const list = [tpl.category];
    const text = (tpl.name + ' ' + tpl.description).toLowerCase();
    if (text.includes('sheet') || text.includes('gmail') || text.includes('google')) {
      list.push('Google Workspace');
    }
    if (text.includes('gmail') || text.includes('telegram') || text.includes('slack') || text.includes('email')) {
      list.push('Email & Communication');
    }
    if (text.includes('lead') || text.includes('form') || text.includes('crm')) {
      list.push('Sales & Leads');
      list.push('Marketing');
    }
    if (text.includes('github') || text.includes('bug') || text.includes('dev')) {
      list.push('Developer Tools');
    }
    if (text.includes('scheduled') || text.includes('reminder') || text.includes('standup')) {
      list.push('Personal Productivity');
      list.push('Productivity');
    }
    list.push('Productivity');
    return list;
  };

  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    const cats = getTemplateCategories(tpl);
    return cats.includes(selectedCategory);
  });

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-[#FF7306]" />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Templates</h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Ready-to-use production recipes. Pick a template to launch your automation in seconds.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 pr-3.5 py-1.5 rounded-full bg-input-bg border border-input-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover w-64"
          />
        </div>
      </header>

      {/* Categories Horizontal Scroll */}
      <div className="px-8 py-3.5 border-b border-border bg-surface-secondary overflow-x-auto flex items-center gap-1.5 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-surface-elevated text-text-primary font-semibold shadow-sm border border-border'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {error && (
            <div className="p-4 rounded-[18px] bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center text-xs text-text-muted">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <LayoutTemplate className="w-8 h-8 mx-auto text-text-muted opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No templates found</p>
              <p className="text-xs text-text-muted">Try selecting a different category or clearing your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((tpl) => {
                const nodes = tpl.graph?.nodes || [];
                const hasMissingCreds = tpl.requiredCredentials?.some(
                  (rc) => !isServiceConnected(rc.credentialType)
                );

                return (
                  <div
                    key={tpl.id}
                    onClick={() => setPreviewTemplate(tpl)}
                    className="p-6 rounded-[24px] bg-surface hover:bg-surface-elevated border border-border hover:border-border-hover transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-5 group"
                  >
                    <div className="space-y-3.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-mono font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-muted border border-border">
                          {tpl.category}
                        </span>

                        {hasMissingCreds ? (
                          <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                            <span>Setup required</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ready to run</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-[#FF7306] transition-colors leading-snug">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-text-muted leading-relaxed mt-1.5 line-clamp-3">
                          {tpl.description}
                        </p>
                      </div>

                      {/* Workflow Step Sequence Mini-Pills */}
                      <div className="pt-2">
                        <div className="text-[11px] text-text-muted mb-2 font-sans font-medium">Steps in Recipe:</div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {nodes.map((node, i) => (
                            <div key={node.key} className="flex items-center gap-1">
                              <span className="px-2 py-1 rounded-lg bg-surface-elevated border border-border text-[11px] text-text-secondary flex items-center gap-1.5">
                                <ServiceIcon service={node.type} size={12} />
                                <span className="truncate max-w-[110px]">{node.name}</span>
                              </span>
                              {i < nodes.length - 1 && (
                                <ChevronRight className="w-3 h-3 text-text-muted opacity-60" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom CTA & App Icons */}
                    <div className="pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {nodes.slice(0, 3).map((n) => (
                          <div
                            key={n.key}
                            className="w-6 h-6 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-text-muted shadow-xs"
                            title={n.name}
                          >
                            <ServiceIcon service={n.type} size={12} />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted group-hover:text-text-primary transition-colors">
                        <span>Preview & Use</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-border rounded-[24px] max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-surface text-amber-400 border border-border">
                  {previewTemplate.category} Recipe
                </span>
                <h2 className="text-xl font-bold text-text-primary tracking-tight mt-2">
                  {previewTemplate.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plain-Language Explanation */}
            <div className="p-4 rounded-[18px] bg-surface border border-border text-xs text-text-secondary leading-relaxed">
              <div className="font-semibold text-text-primary mb-1">What this automation does</div>
              {previewTemplate.description}
            </div>

            {/* Visual Workflow Step Sequence Diagram */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-text-primary">Workflow Step Architecture</div>
              <div className="p-4 rounded-[18px] bg-surface border border-border flex flex-col md:flex-row items-stretch md:items-center gap-3">
                {previewTemplate.graph?.nodes?.map((node, idx, arr) => (
                  <div key={node.key} className="flex-1 flex flex-col items-center">
                    <div className="w-full p-3 rounded-2xl bg-surface-elevated border border-border text-center space-y-1">
                      <div className="w-7 h-7 mx-auto rounded-lg bg-surface flex items-center justify-center">
                        <ServiceIcon service={node.type} size={15} />
                      </div>
                      <div className="font-semibold text-xs text-text-primary truncate">{node.name}</div>
                      <div className="text-[10px] text-text-muted font-mono uppercase">
                        {node.type.split('.')[0]}
                      </div>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="my-1 md:my-0 md:mx-2 text-text-muted">
                        <ChevronRight className="w-4 h-4 rotate-90 md:rotate-0" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Required Connected Applications */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-text-primary">Required Connected Accounts</div>
              <div className="space-y-2">
                {previewTemplate.requiredCredentials?.length === 0 ? (
                  <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-muted">
                    No external application credentials required for this automation.
                  </div>
                ) : (
                  previewTemplate.requiredCredentials?.map((req) => {
                    const isConnected = isServiceConnected(req.credentialType);

                    return (
                      <div
                        key={req.stepKey}
                        className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-primary">
                            <ServiceIcon service={req.credentialType} size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-text-primary">{req.stepName}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{req.description}</div>
                          </div>
                        </div>

                        {isConnected ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveModalService(req.credentialType)}
                            className="px-3 py-1 rounded-full bg-surface-elevated hover:bg-surface-hover text-amber-400 border border-amber-400/30 font-semibold text-[11px] transition-colors shrink-0"
                          >
                            Connect Now
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Expected Outcome */}
            <div className="p-4 rounded-[18px] bg-surface border border-border flex items-center gap-3 text-xs text-text-muted">
              <Info className="w-4 h-4 text-accent shrink-0" />
              <span>
                Using this template creates a brand-new editable automation draft without modifying or overwriting any existing workflows.
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2.5 rounded-full bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Close Preview
              </button>

              <button
                type="button"
                disabled={instantiatingId === previewTemplate.id}
                onClick={() => handleUseTemplate(previewTemplate.id)}
                className="px-6 py-2.5 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-[0.98]"
              >
                {instantiatingId === previewTemplate.id ? (
                  <span>Creating Automation...</span>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Use this template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OAuth / Connection Modal */}
      {activeModalService && (
        <ConnectionModal
          isOpen={true}
          serviceId={activeModalService}
          onClose={() => {
            setActiveModalService(null);
            loadData();
          }}
          onSuccess={() => {
            setActiveModalService(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
