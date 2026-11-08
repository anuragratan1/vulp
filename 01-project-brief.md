# Visual Workflow Automation Platform
## Project Brief

### 1. Product Overview

A visual, no-code/low-code workflow automation platform that allows users to connect triggers, actions and logic nodes to automate repetitive tasks.

Users create workflows on a visual canvas, configure individual nodes, connect them, execute workflows and monitor each step through live execution logs.

**Product promise:** Powerful automation, without the complexity.

### 2. Problem Statement

Users often need to automate repetitive tasks across different applications and services. Existing automation tools can be difficult for beginners, while building custom integrations requires programming knowledge.

This project aims to provide an intuitive visual environment where users can design and execute useful automations without needing to write code.

### 3. Objectives

- Provide a visual drag-and-drop workflow editor.
- Support manual, webhook and scheduled triggers.
- Connect actions and logic through configurable nodes.
- Pass data between nodes using expressions.
- Execute workflows and display their progress.
- Provide execution history, logs and error visibility.
- Demonstrate object-oriented design through the actual implementation.

### 4. Target Users

- Students and beginners exploring automation.
- Developers who need to connect APIs and services.
- Individuals and small teams automating repetitive tasks.

### 5. MVP Scope

**Triggers**
- Manual trigger with optional JSON payload.
- Webhook trigger.
- Scheduled trigger using cron expressions.

**Actions**
- HTTP Request.
- Slack: post a message using an incoming webhook.
- Telegram: send a message using a bot token.
- GitHub: create an issue using a personal access token.

**Logic**
- IF / ELSE.
- Merge.
- Delay.

**Core capabilities**
- Visual node editor with connections.
- Node configuration forms.
- Save and load workflows.
- Activate and deactivate workflows.
- Run workflows manually.
- Data mapping using `{{ nodeKey.path.to.value }}`.
- Credential storage with encryption.
- Execution history and per-node logs.
- Live execution status.
- Retry failed nodes.
- Stop or continue after node errors.
- Two preconfigured example workflows.

### 6. Explicitly Out of Scope for MVP

To protect the development timeline, the following are deferred:

- Loops and ForEach.
- Google Sheets integration.
- Code execution nodes.
- User authentication and multi-tenancy.
- Team collaboration and permissions.
- Parallel branch execution.
- Large integration marketplace.
- Advanced analytics and billing.

### 7. Expected Outcome

A working application in which a user can:

1. Open the workflow editor.
2. Create a workflow by adding and connecting nodes.
3. Configure a trigger, actions and logic.
4. Save the workflow.
5. Execute it manually or through a webhook/schedule.
6. Observe each node's execution status.
7. Inspect inputs, outputs, logs and errors.
8. Retry failed nodes where appropriate.

The MVP should be demonstrable locally without requiring a cloud deployment.

### 8. Success Criteria

- A complete workflow can be created and saved.
- Supported nodes execute according to the defined graph semantics.
- Data can be passed between nodes through expressions.
- IF/ELSE and Merge behave correctly.
- Failed executions are recorded and inspectable.
- Credentials are encrypted and never exposed through API responses or logs.
- The core engine passes its mandatory automated tests.
- The application has a polished, consistent user interface.

### 9. Development Constraint

The initial implementation is time-constrained. Prioritize a reliable, demonstrable MVP over feature breadth or architectural complexity.

Documentation for academic submission will be prepared after implementation and should accurately reflect the actual product.