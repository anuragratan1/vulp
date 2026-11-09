import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Info,
  Link2,
} from 'lucide-react';
import { CanvasNode } from '../graphConverter.js';
import { api } from '../../api/client.js';
import { GoogleFormsIcon } from '../../components/ServiceIcons.js';

interface GoogleFormsTriggerConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string | Record<string, any>, value?: any) => void;
  workflowActive?: boolean;
  workflowId?: string;
}

interface QuestionDraft {
  id: string;
  title: string;
  required: boolean;
  type: string;
}

export function GoogleFormsTriggerConfig({
  node,
  params,
  onParamChange,
  workflowActive,
  workflowId,
}: GoogleFormsTriggerConfigProps) {
  const credentialId = node.data.credentialId || params.credentialId;
  const formId = params.formId || '';
  const formTitle = params.formTitle || '';

  // Mode: select existing form vs create new form
  const [mode, setMode] = useState<'select' | 'create'>('select');

  // Select method inside 'select' mode: Drive list vs Paste URL / ID
  const [selectMethod, setSelectMethod] = useState<'picker' | 'url'>('picker');
  const [urlInput, setUrlInput] = useState(formId || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  // Form list & selection state
  const [forms, setForms] = useState<
    Array<{ id: string; name: string; modifiedTime?: string; responderUri?: string; webViewLink?: string }>
  >([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [formSearch, setFormSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected form metadata & questions
  const [selectedFormDetails, setSelectedFormDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Create form draft state
  const [newTitle, setNewTitle] = useState('Customer Lead Form');
  const [newQuestions, setNewQuestions] = useState<QuestionDraft[]>([
    { id: '1', title: 'Lead ID', required: true, type: 'TEXT' },
    { id: '2', title: 'Name', required: true, type: 'TEXT' },
    { id: '3', title: 'Email', required: true, type: 'TEXT' },
    { id: '4', title: 'Phone', required: false, type: 'TEXT' },
    { id: '5', title: 'Score', required: false, type: 'TEXT' },
    { id: '6', title: 'Source', required: false, type: 'TEXT' },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Test trigger state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    isLive: boolean;
    message?: string;
    sample?: any;
  } | null>(
    params.samplePayload
      ? { success: true, isLive: false, sample: params.samplePayload, message: 'Saved sample schema ready' }
      : null
  );
  const [showJsonPayload, setShowJsonPayload] = useState(false);

  // Keep urlInput in sync if formId changes
  useEffect(() => {
    if (formId && !urlInput) {
      setUrlInput(formId);
    }
  }, [formId]);

  // 1. Fetch available forms from Google Drive
  const fetchForms = async () => {
    if (!credentialId) return;
    setIsLoadingForms(true);
    setLoadError(null);
    try {
      const list = await api.getGoogleForms(credentialId, formSearch);
      setForms(list);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to list Google Forms. Make sure Google Drive access is allowed.');
    } finally {
      setIsLoadingForms(false);
    }
  };

  useEffect(() => {
    if (credentialId) {
      fetchForms();
    } else {
      setForms([]);
      setSelectedFormDetails(null);
    }
  }, [credentialId]);

  // 2. Fetch details for selected form
  const fetchFormDetails = async (id: string) => {
    if (!credentialId || !id) return;
    setIsLoadingDetails(true);
    try {
      const details = await api.getGoogleForm(id, credentialId);
      setSelectedFormDetails(details);
      if (details.title && details.title !== formTitle) {
        onParamChange('formTitle', details.title);
      }
      if (details.responderUri) {
        onParamChange('responderUri', details.responderUri);
      }
    } catch (err: any) {
      console.warn('Could not fetch full form details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (formId && credentialId) {
      fetchFormDetails(formId);
    }
  }, [formId, credentialId]);

  // 3. Handle Select Form from Drive List
  const handleSelectForm = (id: string, name: string) => {
    onParamChange({
      formId: id,
      formTitle: name,
    });
    setUrlInput(id);
    fetchFormDetails(id);
  };

  // 4. Handle Inspect & Connect Form by URL / ID
  const handleInspectUrl = async (inputVal?: string) => {
    const raw = (inputVal ?? urlInput).trim();
    if (!raw) {
      setUrlError('Please enter a Google Form URL or Form ID.');
      return;
    }
    if (!credentialId) {
      setUrlError('Please connect your Google Workspace account above first.');
      return;
    }

    // Extract clean ID from various Google Form URL formats
    let cleanId = raw;
    const match = raw.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }

    setIsValidatingUrl(true);
    setUrlError(null);
    try {
      const details = await api.getGoogleForm(cleanId, credentialId);
      setSelectedFormDetails(details);
      onParamChange({
        formId: details.id,
        formTitle: details.title,
        responderUri: details.responderUri,
      });

      // Automatically run trigger test to discover schema
      handleTestTrigger(details.id);
    } catch (err: any) {
      console.error('Failed to inspect Google Form:', err);
      const msg = err.message || '';
      if (raw.includes('/forms/d/e/')) {
        setUrlError(
          'Could not find form with this public responder link. Please open the form in edit mode and copy the URL from your browser address bar (https://docs.google.com/forms/d/.../edit).'
        );
      } else {
        setUrlError(msg || 'Could not access form. Please verify the Form ID or your Google account permissions.');
      }
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // 5. Handle Create Form natively
  const handleCreateForm = async () => {
    if (!credentialId) return;
    if (!newTitle.trim()) {
      setCreateError('Please enter a form title.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);

    try {
      const created = await api.createGoogleForm({
        credentialId,
        title: newTitle.trim(),
        questions: newQuestions
          .filter((q) => q.title.trim().length > 0)
          .map((q) => ({ title: q.title.trim(), required: q.required, type: q.type })),
      });

      // Update parameters
      onParamChange({
        formId: created.id,
        formTitle: created.title,
        responderUri: created.responderUri,
      });

      setSelectedFormDetails(created);
      setUrlInput(created.id);
      setMode('select');
      fetchForms();

      // Trigger automatic initial test to derive dynamic schema
      handleTestTrigger(created.id);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create Google Form natively.');
    } finally {
      setIsCreating(false);
    }
  };

  // 6. Handle Test Trigger
  const handleTestTrigger = async (targetFormId?: string) => {
    const activeFormId = targetFormId || formId;
    if (!credentialId || !activeFormId) return;

    setIsTesting(true);
    try {
      const nodeKey = node.data.key || node.id;
      const res = await api.testGoogleFormTrigger(activeFormId, credentialId, workflowId, nodeKey);

      setTestResult({
        success: res.success,
        isLive: res.isLive,
        message: res.message || (res.isLive ? 'Received live response' : 'Generated sample schema from questions'),
        sample: res.sample,
      });

      // Update node params with sample payload for instant downstream auto-map
      onParamChange('samplePayload', res.sample);
    } catch (err: any) {
      setTestResult({
        success: false,
        isLive: false,
        message: err.message || 'Failed to fetch form responses or schema',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Filtered forms by search
  const filteredForms = useMemo(() => {
    if (!formSearch.trim()) return forms;
    const q = formSearch.toLowerCase();
    return forms.filter((f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
  }, [forms, formSearch]);

  // Derived discovered fields from sample payload
  const discoveredFields = useMemo(() => {
    const payload = testResult?.sample || params.samplePayload;
    if (!payload || typeof payload !== 'object') return [];
    return Object.keys(payload).filter((k) => !['answers', 'formId', 'formTitle'].includes(k));
  }, [testResult, params.samplePayload]);

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Overview Banner */}
      <div className="p-4 rounded-[16px] bg-[#161616] border border-[#262626] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GoogleFormsIcon size={18} />
            <span className="font-semibold text-white">Google Forms Trigger</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                workflowActive && formId ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span className="text-[10px] text-[#A0A0A0]">
              {workflowActive && formId ? 'Live Polling Active' : 'Setup Required'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-[#909090] leading-relaxed">
          Triggers automatically whenever a response is submitted to your Google Form. Zero Apps Script or webhook
          configuration needed.
        </p>
      </div>

      {/* Account Verification Check */}
      {!credentialId && (
        <div className="p-3.5 rounded-[12px] bg-[#1C1307] border border-[#FF7306]/30 flex items-start gap-2.5 text-text-primary">
          <AlertCircle className="w-4 h-4 text-[#FF7306] shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-1">
            <span className="font-medium text-white block">Connect Your Google Account</span>
            <span className="text-[#A0A0A0] block">
              Please select or connect your Google Workspace account above to access your forms.
            </span>
          </div>
        </div>
      )}

      {/* Primary Mode Switcher: Select Existing vs Create New */}
      <div className="flex p-0.5 bg-[#121212] border border-[#262626] rounded-[10px]">
        <button
          type="button"
          onClick={() => setMode('select')}
          className={`flex-1 py-1.5 text-center text-xs font-medium rounded-[8px] transition-all cursor-pointer ${
            mode === 'select' ? 'bg-[#222222] text-white shadow-sm' : 'text-[#888888] hover:text-white'
          }`}
        >
          Select Existing Form
        </button>
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 py-1.5 text-center text-xs font-medium rounded-[8px] transition-all cursor-pointer ${
            mode === 'create' ? 'bg-[#222222] text-white shadow-sm' : 'text-[#888888] hover:text-white'
          }`}
        >
          Create New Form
        </button>
      </div>

      {/* =================================================================== */}
      {/* MODE 1: Select Existing Form                                        */}
      {/* =================================================================== */}
      {mode === 'select' && (
        <div className="space-y-4">
          {/* Source Sub-Switcher: Drive List vs Paste URL / ID */}
          <div className="flex items-center justify-between pb-1 border-b border-[#222222]">
            <span className="text-[10px] font-semibold tracking-wider text-[#737373] uppercase">Form Source</span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectMethod('picker')}
                className={`transition-colors cursor-pointer ${
                  selectMethod === 'picker'
                    ? 'text-[#7248B9] font-medium border-b border-[#7248B9]'
                    : 'text-[#888888] hover:text-[#C5C5C5]'
                }`}
              >
                Google Drive List
              </button>
              <span className="text-[#333333]">|</span>
              <button
                type="button"
                onClick={() => setSelectMethod('url')}
                className={`flex items-center gap-1 transition-colors cursor-pointer ${
                  selectMethod === 'url'
                    ? 'text-[#7248B9] font-medium border-b border-[#7248B9]'
                    : 'text-[#888888] hover:text-[#C5C5C5]'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>Paste URL / ID</span>
              </button>
            </div>
          </div>

          {/* Option A: Google Drive List */}
          {selectMethod === 'picker' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white">Target Google Form</label>
                <button
                  type="button"
                  onClick={fetchForms}
                  disabled={isLoadingForms || !credentialId}
                  className="flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                  title="Refresh forms from Google Drive"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingForms ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                  placeholder="Search forms by name..."
                  disabled={!credentialId}
                  className="w-full bg-[#141414] border border-[#282828] text-white text-xs pl-8 pr-3 py-2 rounded-[8px] outline-none focus:border-[#7248B9] transition-all placeholder:text-[#555555]"
                />
              </div>

              {/* Error Message */}
              {loadError && (
                <div className="p-3 rounded-[8px] bg-red-950/30 border border-red-800/40 text-[11px] text-red-300">
                  {loadError}
                </div>
              )}

              {/* Forms Dropdown / List */}
              <div className="max-h-52 overflow-y-auto space-y-1 bg-[#121212] border border-[#242424] rounded-[10px] p-1.5 custom-scrollbar">
                {isLoadingForms ? (
                  <div className="p-4 text-center text-[#777777] flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading forms from Drive...</span>
                  </div>
                ) : filteredForms.length === 0 ? (
                  <div className="p-3.5 text-center text-[#777777] space-y-2">
                    <span className="block text-xs text-[#A0A0A0]">No Google Forms found in Drive directory.</span>
                    <p className="text-[11px] text-[#707070] leading-relaxed">
                      Forms created directly on forms.google.com can be connected instantly by pasting their link.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectMethod('url')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#7248B9]/15 border border-[#7248B9]/40 text-white text-xs hover:bg-[#7248B9]/25 transition-all cursor-pointer font-medium"
                    >
                      <Link2 className="w-3 h-3 text-[#7248B9]" />
                      <span>Paste Form URL / ID &rarr;</span>
                    </button>
                  </div>
                ) : (
                  filteredForms.map((f) => {
                    const isSelected = f.id === formId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSelectForm(f.id, f.name)}
                        className={`w-full text-left p-2.5 rounded-[8px] flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#7248B9]/15 border border-[#7248B9]/50 text-white'
                            : 'hover:bg-[#1C1C1C] text-[#C0C0C0]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium truncate text-xs">{f.name}</div>
                          <div className="text-[10px] text-[#707070] font-mono truncate">ID: {f.id}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#7248B9] shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Option B: Paste Form URL or ID */}
          {selectMethod === 'url' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white flex items-center justify-between">
                  <span>Google Form URL or Form ID</span>
                  <span className="text-[10px] text-[#808080]">From docs.google.com/forms</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setUrlError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInspectUrl();
                      }
                    }}
                    placeholder="Paste https://docs.google.com/forms/d/.../edit or Form ID"
                    disabled={!credentialId || isValidatingUrl}
                    className="flex-1 bg-[#141414] border border-[#282828] text-white text-xs px-3 py-2 rounded-[8px] outline-none focus:border-[#7248B9] transition-all placeholder:text-[#555555]"
                  />
                  <button
                    type="button"
                    onClick={() => handleInspectUrl()}
                    disabled={!credentialId || !urlInput.trim() || isValidatingUrl}
                    className="px-3.5 py-2 bg-[#7248B9] hover:bg-[#8356d4] text-white text-xs font-semibold rounded-[8px] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isValidatingUrl ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Helper tip */}
              <div className="p-2.5 rounded-[8px] bg-[#121212] border border-[#222222] text-[11px] text-[#787878] leading-relaxed">
                <span className="text-[#A0A0A0] font-medium">💡 Tip:</span> Open your form in Google Forms, copy the
                link from your browser address bar (
                <span className="text-[#C0C0C0] font-mono">https://docs.google.com/forms/d/.../edit</span>), and paste it
                here.
              </div>

              {/* Error Message */}
              {urlError && (
                <div className="p-3 rounded-[8px] bg-red-950/30 border border-red-800/40 text-[11px] text-red-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>Connection Error</span>
                  </div>
                  <p className="leading-relaxed">{urlError}</p>
                </div>
              )}
            </div>
          )}

          {/* Selected Form Details Card */}
          {formId && (
            <div className="p-3.5 rounded-[12px] bg-[#161616] border border-[#282828] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#7248B9]" />
                  <span className="font-semibold text-white">{formTitle || 'Selected Form'}</span>
                  {isLoadingDetails && <RefreshCw className="w-3 h-3 text-[#7248B9] animate-spin" />}
                </div>
                {params.responderUri && (
                  <a
                    href={params.responderUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Open Form</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="text-[10px] text-[#707070] font-mono">
                Form ID: <span className="text-[#A0A0A0]">{formId}</span>
              </div>

              {/* Form Questions Overview */}
              {selectedFormDetails?.questions && selectedFormDetails.questions.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-[#222222]">
                  <div className="text-[10px] font-semibold text-[#808080] uppercase tracking-wider">
                    Form Questions ({selectedFormDetails.questions.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFormDetails.questions.map((q: any) => (
                      <span
                        key={q.id || q.title}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#222222] border border-[#333333] text-[11px] text-[#D0D0D0]"
                      >
                        <span>{q.title}</span>
                        {q.required && <span className="text-[#FF7306]">*</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 2: Create New Form Natively                                    */}
      {/* =================================================================== */}
      {mode === 'create' && (
        <div className="p-4 rounded-[16px] bg-[#161616] border border-[#282828] space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#7248B9]" />
            <span className="font-semibold text-white">Create Google Form Natively</span>
          </div>

          {/* Form Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white">Form Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Sales Lead Intake"
              className="w-full bg-[#121212] border border-[#282828] text-white text-xs px-3 py-2 rounded-[8px] outline-none focus:border-[#7248B9] transition-all"
            />
          </div>

          {/* Questions Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white">Questions to Create</label>
              <button
                type="button"
                onClick={() =>
                  setNewQuestions((prev) => [
                    ...prev,
                    { id: String(Date.now()), title: '', required: false, type: 'TEXT' },
                  ])
                }
                className="flex items-center gap-1 text-[11px] text-[#7248B9] hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {newQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex items-center gap-2 p-2 bg-[#121212] border border-[#242424] rounded-[8px]"
                >
                  <span className="text-[10px] text-[#606060] font-mono w-4">{idx + 1}.</span>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) =>
                      setNewQuestions((prev) =>
                        prev.map((item) => (item.id === q.id ? { ...item, title: e.target.value } : item))
                      )
                    }
                    placeholder="Question title (e.g. Full Name)"
                    className="flex-1 bg-transparent border-0 text-white text-xs outline-none"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-[#909090] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        setNewQuestions((prev) =>
                          prev.map((item) => (item.id === q.id ? { ...item, required: e.target.checked } : item))
                        )
                      }
                      className="rounded border-[#444444] bg-[#222222] text-[#7248B9] focus:ring-0"
                    />
                    <span>Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewQuestions((prev) => prev.filter((item) => item.id !== q.id))}
                    className="text-[#606060] hover:text-red-400 p-1 cursor-pointer"
                    title="Remove question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Create Error */}
          {createError && (
            <div className="p-3 rounded-[8px] bg-red-950/30 border border-red-800/40 text-[11px] text-red-300">
              {createError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateForm}
              disabled={isCreating || !credentialId || !newTitle.trim()}
              className="flex-1 py-2 px-3 bg-[#7248B9] hover:bg-[#8356d4] text-white text-xs font-semibold rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Form...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Form in Google</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('select')}
              className="py-2 px-3 bg-[#202020] hover:bg-[#282828] text-white text-xs rounded-[8px] transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* Test Trigger & Dynamic Schema Discovery                            */}
      {/* =================================================================== */}
      {formId && (
        <div className="p-4 rounded-[16px] bg-[#161616] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-white block">Test Trigger & Discover Fields</span>
              <p className="text-[11px] text-[#808080]">
                Fetches latest submission or derives sample data so downstream steps auto-map effortlessly.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTestTrigger()}
            disabled={isTesting || !credentialId || !formId}
            className="w-full py-2 px-3 bg-[#202020] hover:bg-[#282828] border border-[#333333] text-white text-xs font-semibold rounded-[8px] transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking Google Form responses...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#7248B9]" />
                <span>Test Trigger</span>
              </>
            )}
          </button>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-[10px] border space-y-2 ${
                testResult.success
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                  : 'bg-red-950/20 border-red-800/40 text-red-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs text-white">
                    {testResult.isLive ? 'Live Response Received' : 'Form Schema Ready'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#1a1a1a] text-[#a0a0a0] font-mono">
                  {testResult.isLive ? 'Live Submission' : 'Synthesized Sample'}
                </span>
              </div>
              <p className="text-[11px] text-[#A0A0A0]">{testResult.message}</p>
            </div>
          )}

          {/* Discovered Fields Chips */}
          {discoveredFields.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-[#808080] uppercase tracking-wider">
                Discovered Output Fields ({discoveredFields.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {discoveredFields.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#1E1E1E] border border-[#333333] text-[11px] font-mono text-[#D0D0D0]"
                  >
                    <span>{f}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible JSON Viewer */}
          {testResult?.sample && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowJsonPayload((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] text-[#808080] hover:text-white transition-colors cursor-pointer"
              >
                <span>{showJsonPayload ? 'Hide' : 'View'} Sample Payload (JSON)</span>
                {showJsonPayload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showJsonPayload && (
                <pre className="mt-2 p-3 rounded-[8px] bg-[#0E0E0E] border border-[#222222] text-[10px] font-mono text-[#A0A0A0] overflow-x-auto max-h-48 custom-scrollbar">
                  {JSON.stringify(testResult.sample, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cadence & Polling Info */}
      <div className="p-3.5 rounded-[12px] bg-[#141414] border border-[#222222] flex items-start gap-2 text-[#808080] text-[11px] leading-relaxed">
        <Info className="w-3.5 h-3.5 text-[#7248B9] shrink-0 mt-0.5" />
        <span>
          When activated, VULP automatically detects new submissions and strictly deduplicates by Response ID. Each form
          submission executes this workflow once.
        </span>
      </div>
    </div>
  );
}
