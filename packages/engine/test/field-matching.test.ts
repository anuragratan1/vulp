import { describe, it, expect } from 'vitest';
import {
  scoreFieldMatch,
  matchTargetField,
  autoMapFields,
  normalizeFieldName,
  compactNormalized,
  detectSemanticFamily,
  getSampleValueEvidenceBoost,
  SourceFieldDefinition,
  TargetFieldDefinition,
} from '../src/mapping/FieldMatchingEngine.js';

describe('FieldMatchingEngine', () => {
  const sampleSources: SourceFieldDefinition[] = [
    {
      id: 'trigger.name',
      rawExpression: '{{ trigger.name }}',
      nodeKey: 'trigger',
      stepName: 'Manual Trigger',
      path: 'name',
      label: 'Full Name',
      type: 'string',
      sampleValue: 'Sarah Connor',
    },
    {
      id: 'trigger.email',
      rawExpression: '{{ trigger.email }}',
      nodeKey: 'trigger',
      stepName: 'Manual Trigger',
      path: 'email',
      label: 'Email',
      type: 'string',
      sampleValue: 'sarah.c@sky.net',
    },
    {
      id: 'trigger.company',
      rawExpression: '{{ trigger.company }}',
      nodeKey: 'trigger',
      stepName: 'Manual Trigger',
      path: 'company',
      label: 'Company Name',
      type: 'string',
      sampleValue: 'Cyberdyne Systems',
    },
    {
      id: 'trigger.phone',
      rawExpression: '{{ trigger.phone }}',
      nodeKey: 'trigger',
      stepName: 'Manual Trigger',
      path: 'phone',
      label: 'Phone Number',
      type: 'string',
      sampleValue: '+1 555-019-2834',
    },
    {
      id: 'trigger.lead_score',
      rawExpression: '{{ trigger.lead_score }}',
      nodeKey: 'trigger',
      stepName: 'Manual Trigger',
      path: 'lead_score',
      label: 'Lead Score',
      type: 'number',
      sampleValue: 95,
    },
    {
      id: 'system.now',
      rawExpression: '{{ $now }}',
      nodeKey: '$now',
      stepName: 'System',
      path: '$now',
      label: 'Current Date & Time',
      type: 'string',
      sampleValue: '2026-11-07T12:00:00.000Z',
    },
  ];

  describe('String Normalization & Semantic Detection', () => {
    it('normalizes camelCase, snake_case, and kebab-case into words', () => {
      expect(normalizeFieldName('customerEmailAddress')).toBe('customer email address');
      expect(normalizeFieldName('customer_email_address')).toBe('customer email address');
      expect(normalizeFieldName('customer-email-address')).toBe('customer email address');
      expect(normalizeFieldName('body.customer.email')).toBe('body customer email');
    });

    it('compacts strings by stripping non-alphanumeric chars', () => {
      expect(compactNormalized('Customer Name (VIP)!')).toBe('customernamevip');
      expect(compactNormalized('Phone #')).toBe('phone');
    });

    it('detects correct semantic families', () => {
      expect(detectSemanticFamily('Customer Name')).toBe('name');
      expect(detectSemanticFamily('email_address')).toBe('email');
      expect(detectSemanticFamily('cell_phone')).toBe('phone');
      expect(detectSemanticFamily('Organization')).toBe('company');
      expect(detectSemanticFamily('Due Date')).toBe('date');
      expect(detectSemanticFamily('deal_value')).toBe('amount');
    });
  });

  describe('Single Field Matching & Scoring', () => {
    it('assigns 100 for exact name match', () => {
      const match = scoreFieldMatch(
        { key: 'email' },
        { id: '1', rawExpression: '{{ email }}', path: 'email', label: 'Email' }
      );
      expect(match.score).toBe(100);
      expect(match.reason).toBe('Exact name match');
    });

    it('assigns 95-98 for normalized match across casing and spaces', () => {
      const match = scoreFieldMatch(
        { key: 'Lead Score' },
        { id: '1', rawExpression: '{{ lead_score }}', path: 'lead_score', label: 'lead_score' }
      );
      expect(match.score).toBeGreaterThanOrEqual(95);
    });

    it('identifies semantic aliases: Customer Name -> name', () => {
      const match = scoreFieldMatch(
        { key: 'Customer Name' },
        { id: '1', rawExpression: '{{ trigger.name }}', path: 'name', label: 'Name' }
      );
      expect(match.score).toBeGreaterThanOrEqual(85);
      expect(match.reason).toContain('Semantic alias match');
    });

    it('identifies semantic aliases: Email Address -> email', () => {
      const match = scoreFieldMatch(
        { key: 'Email Address' },
        { id: '1', rawExpression: '{{ trigger.email }}', path: 'email', label: 'Email' }
      );
      expect(match.score).toBeGreaterThanOrEqual(85);
    });

    it('matches path leaves: body.customer.email -> Email', () => {
      const match = scoreFieldMatch(
        { key: 'Email' },
        { id: '1', rawExpression: '{{ webhook.body.customer.email }}', path: 'body.customer.email', label: 'Customer Email' }
      );
      expect(match.score).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Sample Value Evidence', () => {
    it('boosts candidate when base score >= 60 and sample value matches target concept', () => {
      const boost = getSampleValueEvidenceBoost('Email', 'alice@wonderland.io', 70);
      expect(boost.boost).toBe(10);
      expect(boost.reason).toContain('valid email address');
    });

    it('never boosts candidate when base score < 60 even if sample value looks valid', () => {
      // Unrelated field with low score should NOT be boosted purely by value
      const boost = getSampleValueEvidenceBoost('random_id', 'alice@wonderland.io', 40);
      expect(boost.boost).toBe(0);
    });
  });

  describe('Ambiguity Detection', () => {
    it('downgrades confidence to medium when two candidates have close scores', () => {
      const competingSources: SourceFieldDefinition[] = [
        {
          id: 'src.first_name',
          rawExpression: '{{ user.first_name }}',
          path: 'first_name',
          label: 'First Name',
        },
        {
          id: 'src.last_name',
          rawExpression: '{{ user.last_name }}',
          path: 'last_name',
          label: 'Last Name',
        },
      ];

      const match = matchTargetField({ key: 'Name' }, competingSources);
      expect(match.isAmbiguous).toBe(true);
      expect(match.confidence).toBe('medium');
    });
  });

  describe('Full autoMapFields Workflow Orchestration', () => {
    it('automatically maps high confidence spreadsheet columns', () => {
      const headers = ['Full Name', 'Email Address', 'Company', 'Phone'];
      const result = autoMapFields({
        targets: headers,
        sources: sampleSources,
      });

      expect(result.mappings['Full Name']).toBe('{{ trigger.name }}');
      expect(result.mappings['Email Address']).toBe('{{ trigger.email }}');
      expect(result.mappings['Company']).toBe('{{ trigger.company }}');
      expect(result.mappings['Phone']).toBe('{{ trigger.phone }}');

      expect(result.summary.total).toBe(4);
      expect(result.summary.mapped).toBe(4);
      expect(result.summary.autoMapped).toBe(4);
      expect(result.summary.unmapped).toBe(0);
      expect(result.validation.valid).toBe(true);
    });

    it('strictly preserves existing manual mappings and does not overwrite them', () => {
      const headers = ['Name', 'Email', 'Company'];
      const existingValues = {
        'Email': 'static-support@mycorp.com', // User manually set this static email
      };
      const existingMeta = {
        'Email': { origin: 'manual' as const, value: 'static-support@mycorp.com' },
      };

      const result = autoMapFields({
        targets: headers,
        sources: sampleSources,
        existingValues,
        existingMeta,
      });

      // Manual email must be preserved
      expect(result.mappings['Email']).toBe('static-support@mycorp.com');
      const emailEntry = result.entries.find((e) => e.targetKey === 'Email');
      expect(emailEntry?.origin).toBe('manual');

      // Others should be auto mapped
      expect(result.mappings['Name']).toBe('{{ trigger.name }}');
      expect(result.mappings['Company']).toBe('{{ trigger.company }}');
      expect(result.summary.manual).toBe(1);
      expect(result.summary.autoMapped).toBe(2);
    });

    it('reports missing required fields in validation', () => {
      const targets: TargetFieldDefinition[] = [
        { key: 'to', required: true },
        { key: 'subject', required: true },
        { key: 'unmatched_secret_code', required: true },
      ];

      const result = autoMapFields({
        targets,
        sources: sampleSources,
      });

      expect(result.validation.valid).toBe(false);
      expect(result.validation.missingRequired).toContain('unmatched_secret_code');
      expect(result.validation.messages.some((m) => m.includes('Required fields missing'))).toBe(true);
    });

    it('generates compact summary and percentage', () => {
      const headers = ['Name', 'Email', 'UnmatchedOne', 'UnmatchedTwo'];
      const result = autoMapFields({
        targets: headers,
        sources: sampleSources,
      });

      expect(result.summary.total).toBe(4);
      expect(result.summary.mapped).toBe(2);
      expect(result.summary.unmapped).toBe(2);
      expect(result.summary.percentageMapped).toBe(50);
      expect(result.validation.unmapped).toEqual(['UnmatchedOne', 'UnmatchedTwo']);
    });
  });
});

