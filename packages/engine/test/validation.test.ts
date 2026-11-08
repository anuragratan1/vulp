import { describe, it, expect } from 'vitest';
import {
  GraphValidator,
  ValidationError,
  WorkflowGraph,
  createDefaultNodeRegistry,
} from '../src/index.js';

describe('GraphValidator Rejection Criteria', () => {
  const registry = createDefaultNodeRegistry();

  it('rejects empty graphs', () => {
    const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
    expect(() => GraphValidator.validate(emptyGraph, registry)).toThrowError(
      /graph contains no nodes/i
    );
  });

  it('rejects graphs missing a trigger node', () => {
    const noTriggerGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'action_1',
          type: 'http.request',
          name: 'Action',
          position: { x: 0, y: 0 },
          params: { method: 'GET', url: 'https://example.com' },
        },
      ],
      edges: [],
    };
    expect(() => GraphValidator.validate(noTriggerGraph, registry)).toThrowError(
      /contains no trigger nodes/i
    );
  });

  it('rejects duplicate node keys with actionable error identifying key', () => {
    const duplicateKeyGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'dup_key',
          type: 'manual.trigger',
          name: 'Trigger 1',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'dup_key',
          type: 'manual.trigger',
          name: 'Trigger 2',
          position: { x: 100, y: 0 },
          params: {},
        },
      ],
      edges: [],
    };

    expect(() => GraphValidator.validate(duplicateKeyGraph, registry)).toThrowError(
      /duplicate node key 'dup_key'/i
    );
  });

  it('rejects unknown node types identifying affected node', () => {
    const unknownTypeGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'bogus_node',
          type: 'non.existent.type',
          name: 'Bogus',
          position: { x: 100, y: 0 },
          params: {},
        },
      ],
      edges: [],
    };

    expect(() => GraphValidator.validate(unknownTypeGraph, registry)).toThrowError(
      /node 'bogus_node' uses unknown type 'non.existent.type'/i
    );
  });

  it('rejects unknown source nodes identifying edge', () => {
    const unknownSourceGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
      ],
      edges: [
        { id: 'edge_broken', source: 'ghost_source', sourcePort: 'default', target: 'trig' },
      ],
    };

    expect(() => GraphValidator.validate(unknownSourceGraph, registry)).toThrowError(
      /edge 'edge_broken' references unknown source node 'ghost_source'/i
    );
  });

  it('rejects unknown target nodes identifying edge', () => {
    const unknownTargetGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
      ],
      edges: [
        { id: 'edge_broken', source: 'trig', sourcePort: 'default', target: 'ghost_target' },
      ],
    };

    expect(() => GraphValidator.validate(unknownTargetGraph, registry)).toThrowError(
      /edge 'edge_broken' references unknown target node 'ghost_target'/i
    );
  });

  it('rejects invalid source ports identifying node and available outputs', () => {
    const invalidPortGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'http_node',
          type: 'http.request',
          name: 'HTTP',
          position: { x: 100, y: 0 },
          params: { method: 'GET', url: 'https://example.com' },
        },
      ],
      edges: [
        // manual.trigger only has 'default', so 'non_existent_port' is invalid
        { id: 'edge_port', source: 'trig', sourcePort: 'invalid_port', target: 'http_node' },
      ],
    };

    expect(() => GraphValidator.validate(invalidPortGraph, registry)).toThrowError(
      /invalid source port 'invalid_port'/i
    );
  });

  it('rejects missing required node parameters identifying node and parameter', () => {
    const missingParamGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'http_node',
          type: 'http.request',
          name: 'HTTP Action',
          position: { x: 100, y: 0 },
          // Missing required 'url' parameter
          params: { method: 'GET' },
        },
      ],
      edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'http_node' }],
    };

    expect(() => GraphValidator.validate(missingParamGraph, registry)).toThrowError(
      /node 'http_node' .* is missing required parameter 'url'/i
    );
  });

  describe('Draft Workflow Validation (allowDraft: true)', () => {
    it('permits draft graph with missing required parameters (e.g. Gmail without to)', () => {
      const draftGmailGraph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gmail_sendEmail_t62f',
            type: 'gmail.sendEmail',
            name: 'Gmail: Send Email',
            position: { x: 200, y: 0 },
            params: { to: '', subject: 'Hi', body: 'Hello' },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_sendEmail_t62f' }],
      };

      // Strict validation fails
      expect(() => GraphValidator.validate(draftGmailGraph, registry)).toThrowError(
        /missing required parameter 'to'/i
      );

      // Draft validation succeeds
      expect(() =>
        GraphValidator.validate(draftGmailGraph, registry, { allowDraft: true })
      ).not.toThrow();
    });

    it('permits draft graph without a trigger node', () => {
      const actionOnlyGraph: WorkflowGraph = {
        nodes: [
          {
            key: 'gmail_node',
            type: 'gmail.sendEmail',
            name: 'Gmail Action',
            position: { x: 100, y: 100 },
            params: {},
          },
        ],
        edges: [],
      };

      expect(() =>
        GraphValidator.validate(actionOnlyGraph, registry, { allowDraft: true })
      ).not.toThrow();
    });

    it('permits empty draft graph', () => {
      const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
      expect(() =>
        GraphValidator.validate(emptyGraph, registry, { allowDraft: true })
      ).not.toThrow();
    });

    it('still rejects duplicate node keys and unknown node types in draft mode', () => {
      const dupGraph: WorkflowGraph = {
        nodes: [
          { key: 'same_key', type: 'manual.trigger', name: 'N1', position: { x: 0, y: 0 }, params: {} },
          { key: 'same_key', type: 'manual.trigger', name: 'N2', position: { x: 10, y: 0 }, params: {} },
        ],
        edges: [],
      };
      expect(() => GraphValidator.validate(dupGraph, registry, { allowDraft: true })).toThrowError(
        /duplicate node key/i
      );
    });
  });
});

