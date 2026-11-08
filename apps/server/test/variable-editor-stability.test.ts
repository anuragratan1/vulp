import { describe, it, expect } from 'vitest';
import { ExpressionResolver } from '@workflow/engine';
import {
  createTokenHtml,
  serializeTokensToExpressions,
  serializeTokensToPlainText,
  deserializeExpressionsToTokens,
  deserializePlainTextToTokens,
  isPureExpression,
  extractExpressions,
  VARIABLE_TOKEN_CLASS,
} from '../../web/src/editor/fields/tokenSerialization.js';
import {
  getVariableDisplayInfo,
  humanizeNodeKey,
} from '../../web/src/editor/fields/variableUtils.js';
import { CanvasNode } from '../../web/src/editor/graphConverter.js';

describe('Variable Editor, Persistence & Configuration Panel Stability', () => {
  const mockNodes: CanvasNode[] = [
    {
      id: 'trigger_mw5uet48',
      type: 'workflowNode',
      position: { x: 0, y: 0 },
      data: {
        key: 'trigger_mw5uet48',
        name: 'Manual Trigger',
        category: 'trigger',
        icon: 'Play',
        params: {},
      },
    },
    {
      id: 'step_gmail_send',
      type: 'workflowNode',
      position: { x: 200, y: 0 },
      data: {
        key: 'step_gmail_send',
        name: 'Send Customer Email',
        category: 'action',
        icon: 'Mail',
        params: {},
      },
    },
  ];

  describe('1. Dynamic Variable Rendering & Chip Display', () => {
    it('displays human-readable Step Name → Field Name labels instead of raw engine IDs', () => {
      const info = getVariableDisplayInfo('{{ trigger_mw5uet48.name }}', mockNodes);
      expect(info.stepName).toBe('Manual Trigger');
      expect(info.label).toBe('Customer Name');
      expect(info.displayLabel).toBe('Manual Trigger → Customer Name');
    });

    it('cleans internal random hashes from node keys when no node match is found', () => {
      expect(humanizeNodeKey('trigger_mw5uet48')).toBe('Trigger');
      expect(humanizeNodeKey('step_send_email_a91f')).toBe('Step Send Email');
      expect(humanizeNodeKey('lead_webhook')).toBe('Lead Webhook');
    });

    it('generates visual token HTML with step name, arrow, and orange dot structure', () => {
      const html = createTokenHtml('{{ trigger_mw5uet48.name }}', 'Customer Name', 'Manual Trigger');
      expect(html).toContain('class="vulp-var-chip"');
      expect(html).toContain('data-raw="{{ trigger_mw5uet48.name }}"');
      expect(html).toContain('data-step="Manual Trigger"');
      expect(html).toContain('data-label="Customer Name"');
      expect(html).toContain('<span class="chip-dot"></span>');
      expect(html).toContain('<span class="chip-step">Manual Trigger</span>');
      expect(html).toContain('<span class="chip-arrow">→</span>');
      expect(html).toContain('<span class="chip-label">Customer Name</span>');
    });

    it('immediately deserializes raw expressions into visual chips upon opening or mounting', () => {
      const rawText = 'Hello {{ trigger_mw5uet48.name }}, order {{ trigger_mw5uet48.order_id }} is confirmed!';
      const html = deserializeExpressionsToTokens(rawText, mockNodes);

      expect(html).toContain('data-raw="{{ trigger_mw5uet48.name }}"');
      expect(html).toContain('data-raw="{{ trigger_mw5uet48.order_id }}"');
      expect(html).toContain('<span class="chip-step">Manual Trigger</span>');
      expect(html).toContain('<span class="chip-label">Customer Name</span>');
      expect(html).toContain('<span class="chip-label">Order ID</span>');
      expect(html).toContain('Hello ');
      expect(html).toContain(', order ');
      expect(html).toContain(' is confirmed!');
    });
  });

  describe('2. Internal Node ID Resolution & Renaming Resilience', () => {
    it('preserves exact underlying engine ID in data-raw while displaying human step title', () => {
      const raw = '{{ trigger_mw5uet48.customer_email }}';
      const html = deserializeExpressionsToTokens(raw, mockNodes);
      expect(html).toContain('data-raw="{{ trigger_mw5uet48.customer_email }}"');
      expect(html).toContain('Manual Trigger');
      expect(html).toContain('Customer Email');

      // Serializing extracts the exact underlying ID
      const serialized = serializeTokensToExpressions(html);
      expect(serialized).toBe(raw);
    });

    it('dynamically updates chip step name when a step is renamed without corrupting underlying ID', () => {
      // User renames "Manual Trigger" to "Inbound Lead Webhook"
      const renamedNodes: CanvasNode[] = [
        {
          ...mockNodes[0],
          data: {
            ...mockNodes[0].data,
            name: 'Inbound Lead Webhook',
          },
        },
      ];

      const raw = '{{ trigger_mw5uet48.customer_email }}';
      const updatedHtml = deserializeExpressionsToTokens(raw, renamedNodes);

      expect(updatedHtml).toContain('data-raw="{{ trigger_mw5uet48.customer_email }}"');
      expect(updatedHtml).toContain('Inbound Lead Webhook');
      expect(updatedHtml).toContain('Customer Email');

      // The execution engine ID remains unchanged
      const serialized = serializeTokensToExpressions(updatedHtml);
      expect(serialized).toBe(raw);
    });

    it('does not replace variables with hardcoded sample values', () => {
      const raw = '{{ trigger_mw5uet48.amount }}';
      const info = getVariableDisplayInfo(raw, mockNodes);
      expect(info.label).toBe('Total Amount');
      expect(info.stepName).toBe('Manual Trigger');
      // Must not be a hardcoded number like 42 or $100
      expect(info.label).not.toMatch(/^\$?[0-9]+/);
    });
  });

  describe('3. Persistence & Serialization Roundtrip Stability', () => {
    it('preserves surrounding spaces, punctuation, symbols, and formatting', () => {
      const original = 'Dear {{ trigger_mw5uet48.name }}: Your total is ${{ trigger_mw5uet48.total }} (tax included).';
      const html = deserializeExpressionsToTokens(original, mockNodes);
      const restored = serializeTokensToExpressions(html);

      expect(restored).toBe(original);
    });

    it('serializes plain text inputs cleanly without HTML entity encoding', () => {
      const raw = 'Notice & Warning: amount < 50 for {{ trigger_mw5uet48.name }}';
      const html = deserializePlainTextToTokens(raw, mockNodes);
      const text = serializeTokensToPlainText(html);

      expect(text).toBe(raw);
      expect(text).not.toContain('&amp;');
      expect(text).not.toContain('&lt;');
      expect(text).not.toContain('&nbsp;');
    });

    it('switching between Variable mode and Code mode causes zero data loss', () => {
      const initialExpression = 'Subject for {{ trigger_mw5uet48.name }} - Case #{{ trigger_mw5uet48.case_num }}';

      // 1. Initial hydration into chips
      const chipHtml = deserializePlainTextToTokens(initialExpression, mockNodes);

      // 2. Switch to Code mode (serialize to plain text)
      const rawCode = serializeTokensToPlainText(chipHtml);
      expect(rawCode).toBe(initialExpression);

      // 3. User edits in Code mode: appends exclamation mark
      const editedCode = `${rawCode}!`;

      // 4. Switch back to Normal mode (deserialize edited code)
      const restoredHtml = deserializePlainTextToTokens(editedCode, mockNodes);
      const finalRestored = serializeTokensToPlainText(restoredHtml);

      expect(finalRestored).toBe(editedCode);
    });

    it('handles multiple variables adjacent to each other', () => {
      const raw = '{{ trigger_mw5uet48.first_name }} {{ trigger_mw5uet48.last_name }}';
      const html = deserializeExpressionsToTokens(raw, mockNodes);
      const serialized = serializeTokensToExpressions(html);

      expect(serialized).toBe(raw);
    });
  });

  describe('4. Execution Engine Compatibility', () => {
    it('underlying engine expression resolves successfully against workflow state', () => {
      const template = 'Hello {{ trigger_mw5uet48.name }}, order {{ trigger_mw5uet48.order_id }} is ${{ trigger_mw5uet48.amount }}';
      const resolved = ExpressionResolver.resolve(template, {
        nodeOutputs: {
          trigger_mw5uet48: {
            name: 'Jane Doe',
            order_id: 'ORD-9872',
            amount: 250,
          },
        },
      });

      expect(resolved).toBe('Hello Jane Doe, order ORD-9872 is $250');
    });

    it('supports alias trigger paths used in templates and manual triggers', () => {
      const template = 'Company: {{ trigger.name }} ({{ trigger.email }})';
      const resolved = ExpressionResolver.resolve(template, {
        nodeOutputs: {},
        triggerPayload: {
          name: 'Acme Corp',
          email: 'contact@acme.com',
        },
      });

      expect(resolved).toBe('Company: Acme Corp (contact@acme.com)');
    });
  });
});
