import { describe, it, expect, vi } from 'vitest';
import { ExpressionResolver } from '../src/expressions/ExpressionResolver.js';

describe('ExpressionResolver', () => {
  const context = {
    triggerKey: 'trigger_1',
    nodeOutputs: {
      trigger_1: {
        name: 'Order Event',
        amount: 250,
        active: true,
        items: [
          { id: 101, title: 'Mechanical Keyboard', price: 150 },
          { id: 102, title: 'Ergonomic Mouse', price: 100 }
        ],
        customer: {
          id: 'cust_abc',
          address: { city: 'San Francisco', zip: '94103' }
        }
      },
      http_1: {
        status: 200,
        data: { id: 'ext_999', score: 4.5 }
      }
    }
  };

  it('resolves exact expressions preserving raw types', () => {
    // Number
    const num = ExpressionResolver.resolve('{{ trigger.amount }}', context);
    expect(num).toBe(250);
    expect(typeof num).toBe('number');

    // Boolean
    const bool = ExpressionResolver.resolve('{{ trigger.active }}', context);
    expect(bool).toBe(true);
    expect(typeof bool).toBe('boolean');

    // Array
    const arr = ExpressionResolver.resolve('{{ trigger.items }}', context);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(2);

    // Object
    const obj = ExpressionResolver.resolve('{{ http_1.data }}', context);
    expect(obj).toEqual({ id: 'ext_999', score: 4.5 });
  });

  it('resolves nested array index and property access: items[0].title', () => {
    const title = ExpressionResolver.resolve('{{ trigger.items[0].title }}', context);
    expect(title).toBe('Mechanical Keyboard');

    const secondPrice = ExpressionResolver.resolve('{{ trigger.items[1].price }}', context);
    expect(secondPrice).toBe(100);

    const city = ExpressionResolver.resolve('{{ trigger.customer.address.city }}', context);
    expect(city).toBe('San Francisco');
  });

  it('resolves $now to an ISO 8601 timestamp string', () => {
    const now = ExpressionResolver.resolve('{{ $now }}', context);
    expect(typeof now).toBe('string');
    expect(!isNaN(Date.parse(now as string))).toBe(true);
  });

  it('interpolates embedded expressions into strings and stringifies objects', () => {
    const text = ExpressionResolver.resolve(
      'Order {{ trigger.name }} has total: ${{ trigger.amount }}',
      context
    );
    expect(text).toBe('Order Order Event has total: $250');

    const withObj = ExpressionResolver.resolve(
      'Response info: {{ http_1.data }}',
      context
    );
    expect(withObj).toBe('Response info: {"id":"ext_999","score":4.5}');
  });

  it('resolves missing paths to null and invokes onWarning', () => {
    const warnings: string[] = [];
    const ctx = {
      ...context,
      onWarning: (w: string) => warnings.push(w)
    };

    const res1 = ExpressionResolver.resolve('{{ trigger.non_existent }}', ctx);
    expect(res1).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);

    const res2 = ExpressionResolver.resolve('{{ unknown_node.data }}', ctx);
    expect(res2).toBeNull();
    expect(warnings.length).toBeGreaterThan(1);
  });

  it('recursively resolves nested expressions in objects and arrays', () => {
    const template = {
      summary: 'Order for {{ trigger.customer.address.city }}',
      count: '{{ trigger.amount }}',
      meta: {
        firstItem: '{{ trigger.items[0].title }}',
        httpStatus: '{{ http_1.status }}'
      },
      list: ['{{ trigger.customer.id }}', 42, true]
    };

    const resolved = ExpressionResolver.resolve(template, context) as any;
    expect(resolved.summary).toBe('Order for San Francisco');
    expect(resolved.count).toBe(250);
    expect(resolved.meta.firstItem).toBe('Mechanical Keyboard');
    expect(resolved.meta.httpStatus).toBe(200);
    expect(resolved.list).toEqual(['cust_abc', 42, true]);
  });

  it('resolves trigger fields across body wrapper, flat payload, and aliases', () => {
    const webhookCtx = {
      triggerKey: 'webhook_trigger_vvrf',
      nodeOutputs: {
        webhook_trigger_vvrf: {
          leadId: 'LEAD-TEST-003',
          name: 'Anurag Integration Test',
          email: 'anuragratan2590@gmail.com',
          phone: '+91-9000000000',
          score: 98,
          source: 'VULP End-to-End Test',
          body: {
            leadId: 'LEAD-TEST-003',
            name: 'Anurag Integration Test',
            email: 'anuragratan2590@gmail.com',
            phone: '+91-9000000000',
            score: 98,
            source: 'VULP End-to-End Test',
          },
          headers: { host: 'localhost:3000' },
          query: {},
          method: 'POST',
        },
      },
    };

    // 1. trigger.<field>
    expect(ExpressionResolver.resolve('{{ trigger.leadId }}', webhookCtx)).toBe('LEAD-TEST-003');
    expect(ExpressionResolver.resolve('{{ trigger.name }}', webhookCtx)).toBe('Anurag Integration Test');
    expect(ExpressionResolver.resolve('{{ trigger.email }}', webhookCtx)).toBe('anuragratan2590@gmail.com');
    expect(ExpressionResolver.resolve('{{ trigger.phone }}', webhookCtx)).toBe('+91-9000000000');
    expect(ExpressionResolver.resolve('{{ trigger.score }}', webhookCtx)).toBe(98);
    expect(ExpressionResolver.resolve('{{ trigger.source }}', webhookCtx)).toBe('VULP End-to-End Test');

    // 2. trigger.body.<field>
    expect(ExpressionResolver.resolve('{{ trigger.body.leadId }}', webhookCtx)).toBe('LEAD-TEST-003');
    expect(ExpressionResolver.resolve('{{ trigger.body.name }}', webhookCtx)).toBe('Anurag Integration Test');

    // 3. Exact nodeKey.body.<field> and nodeKey.<field>
    expect(ExpressionResolver.resolve('{{ webhook_trigger_vvrf.body.leadId }}', webhookCtx)).toBe('LEAD-TEST-003');
    expect(ExpressionResolver.resolve('{{ webhook_trigger_vvrf.name }}', webhookCtx)).toBe('Anurag Integration Test');

    // 4. Node key prefix/alias
    expect(ExpressionResolver.resolve('{{ webhook_trigger.email }}', webhookCtx)).toBe('anuragratan2590@gmail.com');

    // 5. Bare field names (like {{ name }}, {{ leadId }})
    expect(ExpressionResolver.resolve('{{ name }}', webhookCtx)).toBe('Anurag Integration Test');
    expect(ExpressionResolver.resolve('{{ leadId }}', webhookCtx)).toBe('LEAD-TEST-003');
    expect(ExpressionResolver.resolve('{{ score }}', webhookCtx)).toBe(98);

    // 6. $node syntax: $node.trigger.output.name
    expect(ExpressionResolver.resolve('{{ $node.trigger.output.name }}', webhookCtx)).toBe('Anurag Integration Test');

    // 7. Interpolation in message
    const message = ExpressionResolver.resolve(
      'Lead: {{ name }} (ID: {{ leadId }}), Score: {{ score }}',
      webhookCtx
    );
    expect(message).toBe('Lead: Anurag Integration Test (ID: LEAD-TEST-003), Score: 98');
  });

  it('throws UnresolvedExpressionError in strict mode identifying expression, step, and context', () => {
    const strictCtx = {
      currentNodeKey: 'gmail_sendEmail_w6y5',
      currentNodeName: 'Gmail: Send Email',
      strict: true,
      triggerKey: 'webhook_1',
      nodeOutputs: {
        webhook_1: {
          name: 'Alice',
          email: 'alice@example.com',
        },
      },
    };

    // Exact expression missing
    expect(() => {
      ExpressionResolver.resolve('{{ trigger.nonExistentField }}', strictCtx);
    }).toThrowError(/Unresolved variable expression.*nonExistentField.*in step 'Gmail: Send Email'/i);

    // Embedded expression missing
    expect(() => {
      ExpressionResolver.resolve('Hello {{ trigger.missingVar }}!', strictCtx);
    }).toThrowError(/Unresolved variable expression.*missingVar.*in step 'Gmail: Send Email'/i);
  });

  it('distinguishes existing null value from missing unresolved property', () => {
    const ctx = {
      strict: true,
      triggerKey: 'trig',
      nodeOutputs: {
        trig: {
          existingNull: null,
          validString: 'hello',
        },
      },
    };

    // Should NOT throw for existing null property
    const res = ExpressionResolver.resolve('{{ trigger.existingNull }}', ctx);
    expect(res).toBeNull();

    // String interpolation with real null returns "null" without error
    const strRes = ExpressionResolver.resolve('Value is {{ trigger.existingNull }}', ctx);
    expect(strRes).toBe('Value is null');

    // But genuinely missing property throws in strict mode
    expect(() => {
      ExpressionResolver.resolve('{{ trigger.completelyMissing }}', ctx);
    }).toThrowError(/Unresolved variable expression/);
  });
});

