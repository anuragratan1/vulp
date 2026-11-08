import { useState, useRef, useMemo, useCallback } from 'react';
import { FormFieldWrapper } from './FormFieldWrapper.js';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import {
  discoverWorkflowVariables,
  DiscoveredVariable,
} from './dynamicVariableDiscovery.js';
import { VariableAutocompleteMenu } from './VariableAutocompleteMenu.js';

export interface UniversalTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optionalBadge?: boolean;
  description?: string;
  error?: string;
  rows?: number;
  allowDynamicData?: boolean;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  className?: string;
}

export function UniversalTextarea({
  label,
  value,
  onChange,
  placeholder,
  required,
  optionalBadge,
  description,
  error,
  rows = 4,
  allowDynamicData = true,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  className = '',
}: UniversalTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autocomplete state
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

  const checkAutocompleteTrigger = useCallback(() => {
    if (!allowDynamicData) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart ?? 0;
    const val = textarea.value;
    const textBefore = val.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf('@');

    if (atIndex === -1) {
      setIsMenuOpen(false);
      return;
    }

    const charBefore = atIndex > 0 ? textBefore.charAt(atIndex - 1) : ' ';
    if (!/[\s\(\[\{\,\;]/.test(charBefore) && atIndex !== 0) {
      setIsMenuOpen(false);
      return;
    }

    const query = textBefore.slice(atIndex + 1);
    if (/[\s\n\r]/.test(query)) {
      setIsMenuOpen(false);
      return;
    }

    const rect = textarea.getBoundingClientRect();
    setMenuCoords({
      top: rect.top,
      bottom: rect.bottom + 4,
      elementTop: rect.top,
      left: Math.max(12, rect.left),
    });
    setAutocompleteQuery(query);
    setIsMenuOpen(true);
    setSelectedIndex(0);
  }, [allowDynamicData]);

  const getAnchorRect = useCallback(() => {
    if (!textareaRef.current) return null;
    const rect = textareaRef.current.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom + 4,
      elementTop: rect.top,
      left: Math.max(12, rect.left),
    };
  }, []);

  const insertAutocompleteVariable = (rawExpr: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleInsertDynamic(rawExpr);
      return;
    }

    const cursor = textarea.selectionStart ?? textarea.value.length;
    const val = textarea.value;
    const textBefore = val.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf('@');

    let newVal = '';
    let newCursor = 0;

    if (atIndex !== -1) {
      const before = val.slice(0, atIndex);
      const after = val.slice(cursor);
      newVal = `${before}${rawExpr}${after ? (after.startsWith(' ') ? after : ` ${after}`) : ' '}`;
      newCursor = (before + rawExpr + ' ').length;
    } else {
      newVal = `${val} ${rawExpr} `;
      newCursor = newVal.length;
    }

    setIsMenuOpen(false);
    setAutocompleteQuery('');
    onChange(newVal);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
            insertAutocompleteVariable(chosen.rawExpression);
          }
          return;
        }
      } else if (autocompleteQuery.trim()) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const customExpr = `{{ ${defaultNodeKey}.${autocompleteQuery.trim()} }}`;
          insertAutocompleteVariable(customExpr);
          return;
        }
      }
    }
  };

  const handleInsertDynamic = (expr: string) => {
    const current = String(value ?? '');
    if (!current) {
      onChange(expr);
    } else {
      onChange(`${current} ${expr}`);
    }
  };

  return (
    <FormFieldWrapper
      label={label}
      required={required}
      optionalBadge={optionalBadge}
      description={description}
      error={error}
      allowDynamicData={allowDynamicData}
      allNodes={allNodes}
      currentNodeId={currentNodeId}
      onInsertDynamic={handleInsertDynamic}
      value={value}
      className={className}
    >
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value);
          setTimeout(checkAutocompleteTrigger, 0);
        }}
        onKeyDown={handleKeyDown}
        onClick={checkAutocompleteTrigger}
        onKeyUp={checkAutocompleteTrigger}
        onBlur={() => {
          setTimeout(() => setIsMenuOpen(false), 200);
        }}
        placeholder={placeholder}
        className={`w-full bg-[#171717] border ${
          error ? 'border-rose-500/80 focus:border-rose-500' : 'border-[#262626] focus:border-[#4A4A4A]'
        } text-white rounded-[18px] p-3.5 text-xs outline-none transition-all placeholder:text-[#5A5A5A] resize-y font-sans leading-relaxed`}
      />

      {/* Floating Inline Autocomplete Menu */}
      {isMenuOpen && (
        <VariableAutocompleteMenu
          query={autocompleteQuery}
          groups={variableGroups}
          coords={menuCoords}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onConfirm={(variable) => {
            insertAutocompleteVariable(variable.rawExpression);
          }}
          onClose={() => setIsMenuOpen(false)}
          defaultNodeKey={defaultNodeKey}
          onSelectCustomPath={(customExpr) => {
            insertAutocompleteVariable(customExpr);
          }}
          getAnchorRect={getAnchorRect}
        />
      )}
    </FormFieldWrapper>
  );
}
