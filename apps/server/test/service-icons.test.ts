import { describe, it, expect } from 'vitest';
import { INTEGRATION_REGISTRY } from '../src/routes/integrations.js';

describe('Integration Registry & Official Service Branding Verification', () => {
  it('contains all required official service integrations', () => {
    const integrationIds = INTEGRATION_REGISTRY.map((i) => i.id);
    expect(integrationIds).toContain('google');
    expect(integrationIds).toContain('telegram');
    expect(integrationIds).toContain('slack');
    expect(integrationIds).toContain('github');
  });

  it('provides official brand colors and valid metadata for each registered service', () => {
    for (const integration of INTEGRATION_REGISTRY) {
      expect(integration.brandColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(integration.name.length).toBeGreaterThan(0);
      expect(integration.description.length).toBeGreaterThan(10);
      expect(integration.operations.length).toBeGreaterThan(0);
    }
  });

  it('maps all Google Workspace sub-services across registered operations', () => {
    const google = INTEGRATION_REGISTRY.find((i) => i.id === 'google');
    expect(google).toBeDefined();

    const opTypes = google!.operations.map((op) => op.type);
    expect(opTypes).toContain('gmail.sendEmail');
    expect(opTypes).toContain('sheets.readRows');
    expect(opTypes).toContain('sheets.appendRow');
    expect(opTypes).toContain('sheets.updateRow');
    expect(opTypes).toContain('drive.uploadFile');
    expect(opTypes).toContain('drive.searchFiles');
    expect(opTypes).toContain('calendar.createEvent');
  });

  it('maps all third-party messaging and developer tool operations', () => {
    const telegram = INTEGRATION_REGISTRY.find((i) => i.id === 'telegram');
    expect(telegram).toBeDefined();
    expect(telegram!.operations.map((o) => o.type)).toContain('telegram.sendMessage');

    const slack = INTEGRATION_REGISTRY.find((i) => i.id === 'slack');
    expect(slack).toBeDefined();
    expect(slack!.operations.map((o) => o.type)).toContain('slack.postMessage');

    const github = INTEGRATION_REGISTRY.find((i) => i.id === 'github');
    expect(github).toBeDefined();
    expect(github!.operations.map((o) => o.type)).toContain('github.createIssue');
  });
});

