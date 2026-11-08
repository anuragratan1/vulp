import { NodeRegistry } from '../../registry/NodeRegistry.js';
import { ManualTriggerNode } from './ManualTriggerNode.js';
import { WebhookTriggerNode } from './WebhookTriggerNode.js';
import { ScheduleTriggerNode } from './ScheduleTriggerNode.js';
import { HttpRequestNode } from './HttpRequestNode.js';
import { IfNode } from './IfNode.js';
import { MergeNode } from './MergeNode.js';
import { DelayNode } from './DelayNode.js';
import { TelegramSendMessageNode } from '../integrations/telegram/TelegramSendMessageNode.js';
import { SlackPostMessageNode } from '../integrations/slack/SlackPostMessageNode.js';
import { GitHubCreateIssueNode } from '../integrations/github/GitHubCreateIssueNode.js';
import {
  GoogleFormsTriggerNode,
  GmailSendEmailNode,
  SheetsReadRowsNode,
  SheetsAppendRowNode,
  SheetsUpdateRowNode,
  DriveUploadFileNode,
  DriveSearchFilesNode,
  CalendarCreateEventNode,
} from '../integrations/google/index.js';

export * from './ManualTriggerNode.js';
export * from './WebhookTriggerNode.js';
export * from './ScheduleTriggerNode.js';
export * from './HttpRequestNode.js';
export * from './IfNode.js';
export * from './MergeNode.js';
export * from './DelayNode.js';
export * from '../base/IntegrationActionNode.js';
export * from '../integrations/index.js';

export function createDefaultNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.register(new ManualTriggerNode());
  registry.register(new WebhookTriggerNode());
  registry.register(new ScheduleTriggerNode());
  registry.register(new GoogleFormsTriggerNode());
  registry.register(new HttpRequestNode());
  registry.register(new IfNode());
  registry.register(new MergeNode());
  registry.register(new DelayNode());
  registry.register(new TelegramSendMessageNode());
  registry.register(new SlackPostMessageNode());
  registry.register(new GitHubCreateIssueNode());
  registry.register(new GmailSendEmailNode());
  registry.register(new SheetsReadRowsNode());
  registry.register(new SheetsAppendRowNode());
  registry.register(new SheetsUpdateRowNode());
  registry.register(new DriveUploadFileNode());
  registry.register(new DriveSearchFilesNode());
  registry.register(new CalendarCreateEventNode());
  return registry;
}
