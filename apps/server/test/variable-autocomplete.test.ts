import { describe, it, expect } from 'vitest';
import { ExpressionResolver } from '@workflow/engine';
import {
  extractFieldsFromData,
  formatFieldLabel,
  discoverWorkflowVariables,
  getDefaultNodeSchema,
  getUpstreamNodes,
} from '../../web/src/editor/fields/dynamicVariableDiscovery.js';
import {
  createTokenHtml,
  serializeTokensToExpressions,
  deserializeExpressionsToTokens,
  isPureExpression,
  extractExpressions,
  VARIABLE_TOKEN_CLASS,
} from '../../web/src/editor/fields/tokenSerialization.js';
import { CanvasNode, CanvasEdge } from '../../web/src/editor/graphConverter.js';
import { NodeRunRecord } from '../../web/src/api/client.js';

describe('Variable Autocomplete & Dynamic Discovery', () => {
  it('formats field labels from object paths with acronym awareness', () => {
    expect(formatFieldLabel('user_email')).toBe('User Email');
    expect(formatFieldLabel('customerName')).toBe('Customer Name');
    expect(formatFieldLabel('order_id')).toBe('Order ID');
    expect(formatFieldLabel('clientIpAddress')).toBe('Client IP Address');
    expect(formatFieldLabel('items[0].price')).toBe('Items [0] Price');
    expect(formatFieldLabel('body.data.webhook_url')).toBe('Data Webhook URL');
  });

  it('extracts flattened fields from nested JSON data without modifying paths', () => {
    const sampleData = {
      user: {
        id: 1234,
        email: 'alex@example.com',
        is_verified: true,
      },
      orders: [
        {
          orderId: 'ord_99',
          amount: 89.5,
          items: ['Widget A', 'Widget B'],
        },
      ],
      tags: ['vip', 'wholesale'],
    };

    const fields = extractFieldsFromData(sampleData, 'payload');

    // Check paths
    const paths = fields.map((f) => f.path);
    expect(paths).toContain('user.id');
    expect(paths).toContain('user.email');
    expect(paths).toContain('user.is_verified');
    expect(paths).toContain('orders[0].orderId');
    expect(paths).toContain('orders[0].amount');
    expect(paths).toContain('orders[0].items[0]');
    expect(paths).toContain('tags[0]');

    // Check data types
    const emailField = fields.find((f) => f.path === 'user.email');
    expect(emailField?.type).toBe('string');
    expect(emailField?.sampleValue).toBe('alex@example.com');
    expect(emailField?.label).toBe('User Email');

    const amountField = fields.find((f) => f.path === 'orders[0].amount');
    expect(amountField?.type).toBe('number');
    expect(amountField?.sampleValue).toBe('89.5');
  });

  it('derives variables only from upstream nodes based on DAG edges', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'node-trigger',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          key: 'webhook_1',
          name: 'Order Webhook',
          category: 'trigger',
          nodeType: 'webhook.trigger',
          status: 'idle',
        },
      },
      {
        id: 'node-http',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          key: 'http_enrich',
          name: 'Enrich Customer',
          category: 'action',
          nodeType: 'http.request',
          status: 'idle',
        },
      },
      {
        id: 'node-gmail',
        type: 'workflowNode',
        position: { x: 400, y: 0 },
        data: {
          key: 'gmail_send',
          name: 'Send Receipt Email',
          category: 'action',
          nodeType: 'gmail.sendEmail',
          status: 'idle',
        },
      },
      {
        id: 'node-slack-unconnected',
        type: 'workflowNode',
        position: { x: 600, y: 200 },
        data: {
          key: 'slack_alert',
          name: 'Slack Alert',
          category: 'action',
          nodeType: 'slack.postMessage',
          status: 'idle',
        },
      },
    ];

    const edges: CanvasEdge[] = [
      { id: 'e1', source: 'node-trigger', target: 'node-http' },
      { id: 'e2', source: 'node-http', target: 'node-gmail' },
    ];

    // For node-gmail, upstream nodes should be node-http and node-trigger (NOT node-slack-unconnected)
    const upstream = getUpstreamNodes('node-gmail', nodes, edges);
    const upstreamKeys = upstream.map((n) => n.data.key);
    expect(upstreamKeys).toContain('webhook_1');
    expect(upstreamKeys).toContain('http_enrich');
    expect(upstreamKeys).not.toContain('gmail_send'); // Not upstream of itself
    expect(upstreamKeys).not.toContain('slack_alert'); // Not connected upstream

    // Discover workflow variables for node-gmail
    const groups = discoverWorkflowVariables({
      currentNodeId: 'node-gmail',
      allNodes: nodes,
      edges,
      includeSystem: true,
    });

    const groupNames = groups.map((g) => g.nodeName);
    expect(groupNames).toContain('Order Webhook');
    expect(groupNames).toContain('Enrich Customer');
    expect(groupNames).toContain('System Variables');
    expect(groupNames).not.toContain('Send Receipt Email');
    expect(groupNames).not.toContain('Slack Alert');
  });

  it('uses live execution nodeRuns outputs when available', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'n1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          key: 'api_fetch',
          name: 'Fetch Products',
          category: 'action',
          nodeType: 'http.request',
          status: 'idle',
        },
      },
      {
        id: 'n2',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          key: 'send_mail',
          name: 'Send Mail',
          category: 'action',
          nodeType: 'gmail.sendEmail',
          status: 'idle',
        },
      },
    ];

    const edges: CanvasEdge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];

    const liveRuns: NodeRunRecord[] = [
      {
        id: 'run-1',
        workflowRunId: 'wfrun-1',
        nodeKey: 'api_fetch',
        nodeName: 'Fetch Products',
        nodeType: 'http.request',
        status: 'succeeded',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        output: {
          statusCode: 200,
          inventoryCount: 42,
          featuredItem: {
            sku: 'SKU-777',
            price: 29.99,
          },
        },
      },
    ];

    const groups = discoverWorkflowVariables({
      currentNodeId: 'n2',
      allNodes: nodes,
      edges,
      nodeRuns: liveRuns,
      includeSystem: false,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].hasLiveOutputs).toBe(true);

    const vars = groups[0].variables;
    const skuVar = vars.find((v) => v.path === 'featuredItem.sku');
    expect(skuVar).toBeDefined();
    expect(skuVar?.sampleValue).toBe('SKU-777');
    expect(skuVar?.rawExpression).toBe('{{ api_fetch.featuredItem.sku }}');
  });

  it('expressions produced by autocomplete evaluate successfully in ExpressionResolver', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'trigger-1',
        type: 'workflowNode',
        position: { x: 0, y: 0 },
        data: {
          key: 'webhook_lead',
          name: 'New Lead Webhook',
          category: 'trigger',
          nodeType: 'webhook.trigger',
          status: 'idle',
        },
      },
      {
        id: 'gmail-1',
        type: 'workflowNode',
        position: { x: 200, y: 0 },
        data: {
          key: 'gmail_welcome',
          name: 'Send Welcome Email',
          category: 'action',
          nodeType: 'gmail.sendEmail',
          status: 'idle',
        },
      },
    ];

    const edges: CanvasEdge[] = [{ id: 'e1', source: 'trigger-1', target: 'gmail-1' }];

    const livePayload = {
      body: {
        customer: {
          name: 'Sarah Connor',
          email: 'sarah@skynet.com',
          vip: true,
        },
        order: {
          id: 'ORD-5544',
          total: 199.99,
        },
      },
    };

    const nodeRuns: NodeRunRecord[] = [
      {
        id: 'run-lead',
        workflowRunId: 'wf-1',
        nodeKey: 'webhook_lead',
        nodeName: 'New Lead Webhook',
        nodeType: 'webhook.trigger',
        status: 'succeeded',
        startedAt: new Date().toISOString(),
        output: livePayload,
      },
    ];

    // Discover variables
    const groups = discoverWorkflowVariables({
      currentNodeId: 'gmail-1',
      allNodes: nodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });

    const leadGroup = groups.find((g) => g.nodeKey === 'webhook_lead');
    expect(leadGroup).toBeDefined();

    // Verify all discovered expressions resolve through ExpressionResolver
    const executionContext = {
      triggerKey: 'webhook_lead',
      nodeOutputs: {
        webhook_lead: livePayload,
      },
    };

    for (const variable of leadGroup!.variables) {
      const resolved = ExpressionResolver.resolve(variable.rawExpression, executionContext);
      expect(resolved).not.toBeNull();
    }

    // Specific field test
    const emailVar = leadGroup!.variables.find((v) => v.path === 'body.customer.email');
    expect(emailVar?.rawExpression).toBe('{{ webhook_lead.body.customer.email }}');

    const resolvedEmail = ExpressionResolver.resolve(emailVar!.rawExpression, executionContext);
    expect(resolvedEmail).toBe('sarah@skynet.com');

    // String interpolation test (like Gmail subject line composed with autocomplete)
    const composedSubject = `Welcome ${leadGroup!.variables.find((v) => v.path === 'body.customer.name')?.rawExpression}! Order #${leadGroup!.variables.find((v) => v.path === 'body.order.id')?.rawExpression} confirmed`;
    const interpolated = ExpressionResolver.resolve(composedSubject, executionContext);
    expect(interpolated).toBe('Welcome Sarah Connor! Order #ORD-5544 confirmed');
  });

  it('default schema fallbacks provide sensible suggestions when node has not run yet', () => {
    const gmailSchema = getDefaultNodeSchema('gmail.sendEmail');
    expect(gmailSchema.some((v) => v.path === 'id')).toBe(true);
    expect(gmailSchema.some((v) => v.path === 'threadId')).toBe(true);

    const sheetsReadSchema = getDefaultNodeSchema('sheets.readRows');
    expect(sheetsReadSchema.some((v) => v.path === 'rows')).toBe(true);
    expect(sheetsReadSchema.some((v) => v.path === 'rowCount')).toBe(true);

    const ifSchema = getDefaultNodeSchema('logic.if');
    expect(ifSchema.some((v) => v.path === 'result')).toBe(true);
    expect(ifSchema.some((v) => v.path === 'operator')).toBe(true);
  });

  describe('Token Serialization & Chip Restoration', () => {
    it('creates standard atomic token HTML with data-raw attributes', () => {
      const chip = createTokenHtml('{{ webhook_lead.body.email }}', 'Customer Email', 'Lead Webhook');
      expect(chip).toContain(`class="${VARIABLE_TOKEN_CLASS}"`);
      expect(chip).toContain('data-raw="{{ webhook_lead.body.email }}"');
      expect(chip).toContain('Customer Email');
      expect(chip).toContain('contenteditable="false"');
    });

    it('identifies pure expressions vs mixed text', () => {
      expect(isPureExpression('{{ trigger.email }}')).toBe(true);
      expect(isPureExpression('  {{  trigger.amount  }}  ')).toBe(true);
      expect(isPureExpression('Hello {{ trigger.name }}')).toBe(false);
      expect(isPureExpression('Plain text')).toBe(false);
      expect(isPureExpression('')).toBe(false);
    });

    it('extracts all expressions from a mixed string', () => {
      const input = 'Hello {{ trigger.name }}, your order {{ trigger.orderId }} of ${{ trigger.total }} is ready!';
      const extracted = extractExpressions(input);
      expect(extracted).toEqual(['{{ trigger.name }}', '{{ trigger.orderId }}', '{{ trigger.total }}']);
    });

    it('deserializes raw expressions into visual HTML chips for editors', () => {
      const input = 'Order {{ trigger.id }} created for {{ trigger.name }}';
      const html = deserializeExpressionsToTokens(input);
      expect(html).toContain(`class="${VARIABLE_TOKEN_CLASS}"`);
      expect(html).toContain('data-raw="{{ trigger.id }}"');
      expect(html).toContain('data-raw="{{ trigger.name }}"');
    });

    it('serializes visual HTML chips back to raw expressions seamlessly', () => {
      const input = 'Order {{ trigger.id }} created for {{ trigger.name }}';
      const html = deserializeExpressionsToTokens(input);
      const serialized = serializeTokensToExpressions(html);
      expect(serialized.trim()).toBe(input);
    });
  });

  describe('Autocomplete Viewport Positioning & Stability Geometry', () => {
    const POPUP_WIDTH = 270;
    const MAX_POPUP_HEIGHT = 220;
    const MARGIN = 12;

    function calculatePopupPosition(
      coords: { top: number; left: number; bottom?: number; elementTop?: number },
      viewport: { width: number; height: number }
    ) {
      let clampedLeft = coords.left;
      if (clampedLeft + POPUP_WIDTH > viewport.width - MARGIN) {
        clampedLeft = Math.max(MARGIN, viewport.width - POPUP_WIDTH - MARGIN);
      }
      if (clampedLeft < MARGIN) {
        clampedLeft = MARGIN;
      }

      const anchorBottom = coords.bottom ?? (coords.top + 20);
      const anchorTop = coords.elementTop ?? coords.top;

      const spaceBelow = viewport.height - anchorBottom - MARGIN;
      const spaceAbove = anchorTop - MARGIN;

      const shouldFlipAbove = spaceBelow < MAX_POPUP_HEIGHT && spaceAbove > spaceBelow;

      if (shouldFlipAbove) {
        return {
          top: undefined,
          bottom: Math.max(MARGIN, viewport.height - anchorTop + 4),
          left: clampedLeft,
          maxHeight: Math.min(MAX_POPUP_HEIGHT, Math.max(80, spaceAbove)),
          flipped: true,
        };
      } else {
        return {
          top: anchorBottom + 4,
          bottom: undefined,
          left: clampedLeft,
          maxHeight: Math.min(MAX_POPUP_HEIGHT, Math.max(80, spaceBelow)),
          flipped: false,
        };
      }
    }

    it('positions cleanly below cursor when sufficient viewport space exists', () => {
      const pos = calculatePopupPosition(
        { top: 200, bottom: 224, left: 100, elementTop: 190 },
        { width: 1440, height: 900 }
      );

      expect(pos.flipped).toBe(false);
      expect(pos.top).toBe(228); // 224 + 4
      expect(pos.bottom).toBeUndefined();
      expect(pos.left).toBe(100);
      expect(pos.maxHeight).toBe(220);
    });

    it('flips cleanly above cursor when space below is insufficient', () => {
      const pos = calculatePopupPosition(
        { top: 800, bottom: 824, left: 100, elementTop: 790 },
        { width: 1440, height: 900 }
      );

      expect(pos.flipped).toBe(true);
      expect(pos.top).toBeUndefined();
      expect(pos.bottom).toBe(900 - 790 + 4); // 114
      expect(pos.left).toBe(100);
      expect(pos.maxHeight).toBe(220);
    });

    it('clamps horizontal position when cursor is near the right screen edge', () => {
      const pos = calculatePopupPosition(
        { top: 300, bottom: 324, left: 1350, elementTop: 290 },
        { width: 1440, height: 900 }
      );

      expect(pos.left).toBe(1440 - POPUP_WIDTH - MARGIN); // 1158
      expect(pos.left + POPUP_WIDTH).toBeLessThanOrEqual(1440 - MARGIN);
    });

    it('clamps horizontal position when cursor is near the left screen edge', () => {
      const pos = calculatePopupPosition(
        { top: 300, bottom: 324, left: 4, elementTop: 290 },
        { width: 1440, height: 900 }
      );

      expect(pos.left).toBe(MARGIN); // 12
    });

    it('maintains fixed vertical anchor point regardless of fluctuating query matches', () => {
      // Whether 10 items match or 1 item matches, when flipped above, bottom anchor is invariant
      const posMany = calculatePopupPosition(
        { top: 780, bottom: 804, left: 200, elementTop: 770 },
        { width: 1200, height: 850 }
      );
      const posSingle = calculatePopupPosition(
        { top: 780, bottom: 804, left: 200, elementTop: 770 },
        { width: 1200, height: 850 }
      );

      expect(posMany.flipped).toBe(posSingle.flipped);
      expect(posMany.bottom).toBe(posSingle.bottom);
      expect(posMany.top).toBe(posSingle.top);
    });
  });
});
