import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Variable,
  Code2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import { DynamicDataPicker } from './DynamicDataPicker.js';
import { getVariableDisplayInfo } from './variableUtils.js';
import {
  createTokenHtml,
  convertTextExpressionsToChips,
} from './tokenSerialization.js';
import {
  discoverWorkflowVariables,
  DiscoveredVariable,
} from './dynamicVariableDiscovery.js';
import { VariableAutocompleteMenu } from './VariableAutocompleteMenu.js';

export interface RichTextEmailEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  isHtml?: boolean;
  onToggleHtml?: (isHtml: boolean) => void;
  className?: string;
}

export function RichTextEmailEditor({
  label = 'Email Message Body',
  value = '',
  onChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  isHtml = true,
  onToggleHtml,
  className = '',
}: RichTextEmailEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isRawCodeMode, setIsRawCodeMode] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Autocomplete menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; bottom?: number; elementTop?: number }>({
    top: 0,
    left: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Dynamic variable discovery
  const variableGroups = useMemo(() => {
    return discoverWorkflowVariables({
      currentNodeId,
      allNodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });
  }, [currentNodeId, allNodes, edges, nodeRuns]);

  const defaultNodeKey = useMemo(() => {
    const trigger = allNodes.find((n) => n.data.category === 'trigger');
    return trigger?.data.key || trigger?.id || 'trigger';
  }, [allNodes]);

  const matchingVariables = useMemo(() => {
    const q = autocompleteQuery.trim().toLowerCase();
    const list: DiscoveredVariable[] = [];
    for (const group of variableGroups) {
      for (const v of group.variables) {
        if (
          !q ||
          v.label.toLowerCase().includes(q) ||
          v.path.toLowerCase().includes(q) ||
          v.nodeKey.toLowerCase().includes(q) ||
          v.stepName.toLowerCase().includes(q)
        ) {
          list.push(v);
        }
      }
    }
    return list;
  }, [variableGroups, autocompleteQuery]);

  // Convert raw value (with {{ expr }}) into editor HTML with chips
  const rawToEditorHtml = useCallback(
    (raw: string) => {
      if (!raw) return '<p><br></p>';

      let formatted = raw;
      const hasAnyHtmlTag = /<[a-z][\s\S]*>/i.test(raw);
      if (!hasAnyHtmlTag) {
        formatted = raw
          .split('\n\n')
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }

      return formatted.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match) => {
        const info = getVariableDisplayInfo(match, allNodes);
        return createTokenHtml(match, info.label, info.stepName);
      });
    },
    [allNodes]
  );

  // Convert editor HTML back to raw value with {{ expr }}
  const editorHtmlToRaw = useCallback((html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;

    const chips = div.querySelectorAll('.vulp-var-chip');
    chips.forEach((chip) => {
      const raw = chip.getAttribute('data-raw') || '';
      const textNode = document.createTextNode(raw);
      chip.parentNode?.replaceChild(textNode, chip);
    });

    return div.innerHTML;
  }, []);

  // Sync incoming value to editor content if changed externally
  useEffect(() => {
    if (!editorRef.current || isRawCodeMode) return;
    const currentRaw = editorHtmlToRaw(editorRef.current.innerHTML);
    if (currentRaw !== value) {
      editorRef.current.innerHTML = rawToEditorHtml(value);
    }
  }, [value, isRawCodeMode, rawToEditorHtml, editorHtmlToRaw]);

  // Save selection before opening picker or clicking toolbar buttons
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  };

  // Execute formatting command
  const format = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    handleEditorInput();
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    convertTextExpressionsToChips(editorRef.current, allNodes);
    const raw = editorHtmlToRaw(editorRef.current.innerHTML);
    onChange(raw);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      convertTextExpressionsToChips(editorRef.current, allNodes);
    }
    handleEditorInput();
  };

  // Check for @ trigger near caret and measure coordinates
  const checkAutocompleteTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.anchorNode) {
      setIsMenuOpen(false);
      return;
    }

    let targetNode = sel.anchorNode;
    let offset = sel.anchorOffset;

    if (targetNode.nodeType === Node.ELEMENT_NODE) {
      const child = targetNode.childNodes[Math.max(0, offset - 1)] || targetNode.firstChild;
      if (child && child.nodeType === Node.TEXT_NODE) {
        targetNode = child;
        offset = child.textContent?.length || 0;
      }
    }

    if (targetNode.nodeType !== Node.TEXT_NODE) {
      setIsMenuOpen(false);
      return;
    }

    const text = targetNode.textContent || '';
    const textBeforeCaret = text.slice(0, offset);

    // Find the latest '@' symbol
    const atIndex = textBeforeCaret.lastIndexOf('@');

    if (atIndex === -1) {
      setIsMenuOpen(false);
      return;
    }

    // Only trigger if preceded by start of line or whitespace
    const charBeforeAt = atIndex > 0 ? textBeforeCaret.charAt(atIndex - 1) : ' ';
    if (!/[\s\(\[\{]/.test(charBeforeAt) && atIndex !== 0) {
      setIsMenuOpen(false);
      return;
    }

    const query = textBeforeCaret.slice(atIndex + 1);

    // If query contains spaces or line breaks, dismiss autocomplete
    if (/[\s\n\r]/.test(query)) {
      setIsMenuOpen(false);
      return;
    }

    // Measure caret coordinates
    try {
      const range = sel.getRangeAt(0).cloneRange();
      range.setStart(sel.anchorNode, atIndex);
      range.setEnd(sel.anchorNode, offset);
      let rect = range.getBoundingClientRect();

      const editorRect = editorRef.current?.getBoundingClientRect();

      // If caret rect is empty or zero, fall back to editor rect
      if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.left === 0)) {
        if (editorRect) {
          rect = new DOMRect(editorRect.left + 16, editorRect.top + 28, 0, 18);
        }
      }

      setMenuCoords({
        top: rect.top,
        bottom: rect.bottom + 4,
        elementTop: editorRect?.top ?? rect.top,
        left: Math.max(12, rect.left),
      });
      setAutocompleteQuery(query);
      setIsMenuOpen(true);
      setSelectedIndex(0);
    } catch {
      setIsMenuOpen(false);
    }
  }, []);

  // Anchor rect getter for smooth scroll tracking
  const getAnchorRect = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.anchorNode) {
      try {
        const range = sel.getRangeAt(0).cloneRange();
        const text = sel.anchorNode.textContent || '';
        const offset = sel.anchorOffset;
        const atIdx = text.lastIndexOf('@', Math.max(0, offset - 1));
        if (atIdx !== -1) {
          range.setStart(sel.anchorNode, atIdx);
          range.setEnd(sel.anchorNode, offset);
          const r = range.getBoundingClientRect();
          if (r && (r.top !== 0 || r.bottom !== 0)) {
            return {
              top: r.top,
              bottom: r.bottom + 4,
              elementTop: editorRef.current?.getBoundingClientRect().top ?? r.top,
              left: Math.max(12, r.left),
            };
          }
        }
      } catch {
        // Fall back to editor element rect
      }
    }
    if (editorRef.current) {
      const r = editorRef.current.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom + 4,
        elementTop: r.top,
        left: Math.max(12, r.left),
      };
    }
    return null;
  }, []);

  // Insert Variable Token from autocomplete or picker
  const insertAutocompleteVariable = (expr: string, label?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let targetNode = sel.anchorNode;
      let offset = sel.anchorOffset;

      if (targetNode && targetNode.nodeType !== Node.TEXT_NODE && targetNode.firstChild) {
        targetNode = targetNode.firstChild;
        offset = targetNode.textContent?.length || 0;
      }

      if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
        const text = targetNode.textContent || '';
        const atIdx = text.lastIndexOf('@', Math.max(0, offset - 1));
        if (atIdx !== -1) {
          range.setStart(targetNode, atIdx);
          range.setEnd(targetNode, offset);
          range.deleteContents();
        }
      }
    }

    const info = getVariableDisplayInfo(expr, allNodes);
    const displayLabel = label || info.label;
    const chipHtml = createTokenHtml(expr, displayLabel, info.stepName);

    document.execCommand('insertHTML', false, chipHtml);
    setIsMenuOpen(false);
    setAutocompleteQuery('');
    handleEditorInput();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isMenuOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }
      if (matchingVariables.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % matchingVariables.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + matchingVariables.length) % matchingVariables.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const chosen = matchingVariables[selectedIndex];
          if (chosen) {
            insertAutocompleteVariable(chosen.rawExpression, chosen.label);
          }
          return;
        }
      } else if (autocompleteQuery.trim()) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const customExpr = `{{ ${defaultNodeKey}.${autocompleteQuery.trim()} }}`;
          const info = getVariableDisplayInfo(customExpr, allNodes);
          insertAutocompleteVariable(customExpr, info.label);
          return;
        }
      }
    }
  };

  // Insert Variable Token at current caret position (toolbar button)
  const handleInsertVariable = (expr: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();

    const info = getVariableDisplayInfo(expr, allNodes);
    const chipHtml = createTokenHtml(expr, info.label, info.stepName);
    document.execCommand('insertHTML', false, chipHtml);
    handleEditorInput();
  };

  // Insert Link Prompt
  const handleInsertLink = () => {
    saveSelection();
    const url = prompt('Enter URL (e.g. https://example.com):', 'https://');
    if (url) {
      restoreSelection();
      format('createLink', url);
    }
  };

  // Insert Image Prompt
  const handleInsertImage = () => {
    saveSelection();
    const url = prompt('Enter Image URL (e.g. https://example.com/logo.png):', 'https://');
    if (url) {
      restoreSelection();
      format('insertImage', url);
    }
  };

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <span>{label}</span>
          <span className="text-rose-400 font-bold" title="Required field">
            *
          </span>
        </label>

        <div className="flex items-center gap-2">
          {/* Variable Picker Button */}
          <DropdownMenu.Root open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                onMouseDown={saveSelection}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#FF7306] hover:text-[#FFA154] hover:bg-[#FF7306]/10 px-2.5 py-1 rounded-full transition-colors select-none cursor-pointer"
                title="Insert dynamic variable"
              >
                <Variable className="w-3.5 h-3.5" />
                <span>Variable</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="bottom" align="end" sideOffset={6} className="z-50">
                <DynamicDataPicker
                  allNodes={allNodes}
                  currentNodeId={currentNodeId}
                  onSelect={(expr) => {
                    handleInsertVariable(expr);
                    setIsPickerOpen(false);
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* HTML Source / Visual Editor Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextMode = !isRawCodeMode;
              setIsRawCodeMode(nextMode);
              if (onToggleHtml) {
                onToggleHtml(isHtml);
              }
            }}
            className={`p-1.5 rounded-md text-[10.5px] flex items-center gap-1 transition-colors ${
              isRawCodeMode
                ? 'text-[#FF7306] bg-[#FF7306]/15 font-semibold'
                : 'text-[#777777] hover:text-white hover:bg-[#222222]'
            }`}
            title={isRawCodeMode ? 'Switch to rich email editor' : 'View / edit raw HTML message'}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isRawCodeMode ? 'Rich Editor' : 'HTML'}</span>
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="rounded-[18px] bg-[#141414] border border-[#262626] focus-within:border-[#444444] transition-all overflow-hidden shadow-inner flex flex-col">
        {/* Rich Formatting Toolbar (Hidden in Code Mode) */}
        {!isRawCodeMode && (
          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#222222] bg-[#181818] select-none text-[#AAAAAA]">
            {/* Paragraph / Heading Select */}
            <select
              onChange={(e) => format('formatBlock', e.target.value)}
              className="bg-[#202020] text-white text-[11px] px-2 py-1 rounded-[8px] border border-[#303030] outline-none cursor-pointer hover:border-[#444444]"
              defaultValue="p"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            <div className="w-[1px] h-3.5 bg-[#2E2E2E] mx-1" />

            {/* Bold */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('bold');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            {/* Italic */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('italic');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            {/* Underline */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('underline');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Underline (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('strikeThrough');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-[#2E2E2E] mx-1" />

            {/* Lists */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('insertUnorderedList');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('insertOrderedList');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Numbered list"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-[#2E2E2E] mx-1" />

            {/* Alignments */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('justifyLeft');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Align left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('justifyCenter');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Align center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                format('justifyRight');
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Align right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-[#2E2E2E] mx-1" />

            {/* Insert Link & Image */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertLink();
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Insert hyperlink"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertImage();
              }}
              className="p-1.5 rounded-[6px] hover:text-white hover:bg-[#252525] transition-colors"
              title="Insert inline image"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editor Body */}
        {isRawCodeMode ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className="w-full bg-[#121212] p-4 text-xs font-mono text-[#D4D4D4] outline-none resize-y leading-relaxed"
            placeholder="Type raw HTML or email text..."
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable={true}
            onInput={() => {
              handleEditorInput();
              checkAutocompleteTrigger();
            }}
            onPaste={handlePaste}
            onKeyDown={handleEditorKeyDown}
            onClick={checkAutocompleteTrigger}
            onKeyUp={() => {
              saveSelection();
              checkAutocompleteTrigger();
            }}
            onMouseUp={saveSelection}
            onBlur={() => {
              setTimeout(() => setIsMenuOpen(false), 200);
            }}
            className="rich-email-content min-h-[170px] max-h-[380px] overflow-y-auto p-4 text-xs text-[#E5E5E5] leading-relaxed outline-none focus:outline-none"
            style={{ minHeight: '170px' }}
          />
        )}
      </div>

      {/* Floating Inline Autocomplete Menu */}
      {isMenuOpen && (
        <VariableAutocompleteMenu
          query={autocompleteQuery}
          groups={variableGroups}
          coords={menuCoords}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onConfirm={(variable) => {
            insertAutocompleteVariable(variable.rawExpression, variable.label);
          }}
          onClose={() => setIsMenuOpen(false)}
          defaultNodeKey={defaultNodeKey}
          onSelectCustomPath={(customExpr) => {
            insertAutocompleteVariable(customExpr, customExpr);
          }}
          getAnchorRect={getAnchorRect}
        />
      )}

    </div>
  );
}
