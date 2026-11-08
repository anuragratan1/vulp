import { CanvasNode } from '../graphConverter.js';
import { getVariableDisplayInfo } from './variableUtils.js';

export const VARIABLE_TOKEN_CLASS = 'vulp-var-chip';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate standard HTML for an atomic inline variable chip.
 * Displays readable labels in the format: "Step Name → Field Name"
 */
export function createTokenHtml(
  rawExpression: string,
  label: string,
  stepName?: string
): string {
  const cleanExpr = rawExpression.trim();
  const safeLabel = label || cleanExpr;
  const safeStep = stepName || '';

  const displayStepHtml = safeStep
    ? `<span class="chip-step">${escapeHtml(safeStep)}</span><span class="chip-arrow">→</span>`
    : '';

  return `<span class="${VARIABLE_TOKEN_CLASS}" contenteditable="false" data-raw="${escapeAttr(cleanExpr)}" data-label="${escapeAttr(safeLabel)}" data-step="${escapeAttr(safeStep)}"><span class="chip-dot"></span>${displayStepHtml}<span class="chip-label">${escapeHtml(safeLabel)}</span></span>&nbsp;`;
}

/**
 * Serialize an HTML string containing variable chips back into standard
 * expression text (e.g. replacing chip elements with their `{{ ... }}` data-raw).
 * Preserves all surrounding text, spaces, and punctuation.
 */
export function serializeTokensToExpressions(html: string): string {
  if (!html) return '';

  // Use DOMParser or temporary div in browser/DOM environment
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;

    const chips = div.querySelectorAll(`.${VARIABLE_TOKEN_CLASS}`);
    chips.forEach((chip) => {
      const raw = chip.getAttribute('data-raw') || '';
      const textNode = document.createTextNode(raw);
      chip.parentNode?.replaceChild(textNode, chip);
    });

    return div.innerHTML;
  }

  // Non-DOM / test environments: accurately parse matching closing spans
  const chipRegex = /<span\b[^>]*class="[^"]*vulp-var-chip[^"]*"[^>]*data-raw="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  let result = '';
  let lastIndex = 0;

  while ((match = chipRegex.exec(html)) !== null) {
    const startIndex = match.index;
    const rawVal = match[1];
    result += html.slice(lastIndex, startIndex);

    let openSpans = 1;
    let idx = chipRegex.lastIndex;
    const tagRegex = /<\/?span\b[^>]*>/gi;
    tagRegex.lastIndex = idx;
    let tagMatch: RegExpExecArray | null;

    while (openSpans > 0 && (tagMatch = tagRegex.exec(html)) !== null) {
      if (tagMatch[0].startsWith('</')) {
        openSpans--;
        if (openSpans === 0) {
          idx = tagRegex.lastIndex;
          break;
        }
      } else {
        openSpans++;
      }
    }

    result += rawVal;
    if (html.startsWith('&nbsp;', idx)) {
      idx += 6;
    }
    lastIndex = idx;
    chipRegex.lastIndex = idx;
  }

  result += html.slice(lastIndex);
  return result;
}

/**
 * Serialize an editor container or HTML string to pure plain text,
 * converting variable chips back to their `{{ ... }}` expressions,
 * preserving all characters (like &, <, >) without HTML entity encoding,
 * and normalizing non-breaking spaces (\u00a0) to standard spaces.
 */
export function serializeTokensToPlainText(source: HTMLElement | string): string {
  if (!source) return '';

  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    if (typeof source === 'string') {
      div.innerHTML = source;
    } else {
      div.innerHTML = source.innerHTML;
    }

    const chips = div.querySelectorAll(`.${VARIABLE_TOKEN_CLASS}`);
    chips.forEach((chip) => {
      const raw = chip.getAttribute('data-raw') || '';
      const textNode = document.createTextNode(raw);
      chip.parentNode?.replaceChild(textNode, chip);
    });

    let text = div.innerText !== undefined ? div.innerText : div.textContent || '';
    return text.replace(/\u00a0/g, ' ');
  }

  return serializeTokensToExpressions(typeof source === 'string' ? source : source.innerHTML)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Restore an expression string into rich HTML with atomic chips.
 * Immediately resolves all `{{ expr }}` variables into readable chips.
 */
export function deserializeExpressionsToTokens(
  raw: string,
  allNodes: CanvasNode[] = []
): string {
  if (!raw) return '';

  return raw.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match) => {
    const info = getVariableDisplayInfo(match, allNodes);
    return createTokenHtml(match, info.label, info.stepName);
  });
}

/**
 * Deserializes a plain-text string containing expressions into HTML for a contenteditable
 * container, escaping HTML special characters in plain-text segments while safely
 * converting expressions into atomic variable chips.
 */
export function deserializePlainTextToTokens(
  raw: string,
  allNodes: CanvasNode[] = []
): string {
  if (!raw) return '';

  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let lastIndex = 0;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const textSegment = raw.slice(lastIndex, match.index);
    if (textSegment) {
      html += escapeHtml(textSegment);
    }
    const info = getVariableDisplayInfo(match[0], allNodes);
    html += createTokenHtml(match[0], info.label, info.stepName);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    html += escapeHtml(raw.slice(lastIndex));
  }

  return html;
}

/**
 * Check whether a string consists purely of an expression like {{ step.field }}.
 */
export function isPureExpression(text: string): boolean {
  if (!text) return false;
  return /^\s*\{\{\s*[^{}]+\s*\}\}\s*$/.test(text.trim());
}

/**
 * Extract all `{{ expr }}` matches from a string.
 */
export function extractExpressions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{\s*[^{}]+\s*\}\}/g);
  return matches ? Array.from(matches) : [];
}

/**
 * Scans an active contenteditable container for typed or pasted raw expressions
 * like `{{ step.field }}` that are not yet wrapped in a `.vulp-var-chip` and
 * transforms them into atomic variable chips immediately while preserving caret position.
 */
export function convertTextExpressionsToChips(
  container: HTMLElement,
  allNodes: CanvasNode[] = []
): boolean {
  if (typeof document === 'undefined' || !container) return false;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest(`.${VARIABLE_TOKEN_CLASS}`)) {
      textNodes.push(node as Text);
    }
  }

  const sel = window.getSelection();
  const anchorNode = sel?.anchorNode;
  const anchorOffset = sel?.anchorOffset ?? 0;
  let hasConverted = false;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue || '';
    const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;

    if (regex.test(text)) {
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let caretNodeToRestore: Node | null = null;
      let caretOffsetToRestore = 0;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const matchStart = match.index;
        const matchEnd = regex.lastIndex;
        const rawExpr = match[0];

        // Surrounding text before variable
        if (matchStart > lastIndex) {
          const beforeText = document.createTextNode(text.slice(lastIndex, matchStart));
          frag.appendChild(beforeText);
          if (anchorNode === textNode && anchorOffset >= lastIndex && anchorOffset <= matchStart) {
            caretNodeToRestore = beforeText;
            caretOffsetToRestore = anchorOffset - lastIndex;
          }
        }

        // Variable chip element
        const info = getVariableDisplayInfo(rawExpr, allNodes);
        const temp = document.createElement('div');
        temp.innerHTML = createTokenHtml(rawExpr, info.label, info.stepName);
        while (temp.firstChild) {
          const child = temp.firstChild;
          frag.appendChild(child);
          if (anchorNode === textNode && anchorOffset >= matchStart && anchorOffset <= matchEnd) {
            // Caret was inside or at the end of the expression: position caret after the chip space
            caretNodeToRestore = child;
            caretOffsetToRestore = (child.nodeType === Node.TEXT_NODE ? child.nodeValue?.length : 0) || 0;
          }
        }

        lastIndex = matchEnd;
      }

      // Surrounding text after variable
      if (lastIndex < text.length) {
        const afterText = document.createTextNode(text.slice(lastIndex));
        frag.appendChild(afterText);
        if (anchorNode === textNode && anchorOffset >= lastIndex) {
          caretNodeToRestore = afterText;
          caretOffsetToRestore = anchorOffset - lastIndex;
        }
      }

      const parent = textNode.parentNode;
      if (parent) {
        parent.replaceChild(frag, textNode);
        hasConverted = true;

        if (caretNodeToRestore && sel) {
          try {
            const range = document.createRange();
            if (caretNodeToRestore.nodeType === Node.TEXT_NODE) {
              range.setStart(
                caretNodeToRestore,
                Math.min(caretOffsetToRestore, (caretNodeToRestore.nodeValue || '').length)
              );
              range.setEnd(
                caretNodeToRestore,
                Math.min(caretOffsetToRestore, (caretNodeToRestore.nodeValue || '').length)
              );
            } else {
              range.setStartAfter(caretNodeToRestore);
              range.setEndAfter(caretNodeToRestore);
            }
            sel.removeAllRanges();
            sel.addRange(range);
          } catch {}
        }
      }
    }
  }

  return hasConverted;
}
