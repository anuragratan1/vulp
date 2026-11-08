import {
  ConfigError,
  Json,
  ParamField,
  PortName,
  RunContext,
} from '../../../contracts.js';
import {
  IIntegrationOperation,
  IntegrationActionNode,
} from '../../base/IntegrationActionNode.js';
import { GoogleAuthHelper } from './GoogleAuthHelper.js';

export class CalendarCreateEventOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawSummary = params.summary;
    if (!rawSummary || String(rawSummary).trim() === '') {
      throw new ConfigError("Parameter 'summary' (Event Title) is required for Google Calendar: Create Event.");
    }
    const summary = String(rawSummary).trim();

    const rawStartTime = params.startTime;
    if (!rawStartTime || String(rawStartTime).trim() === '') {
      throw new ConfigError("Parameter 'startTime' is required for Google Calendar: Create Event (e.g. 2026-11-06T10:00:00Z).");
    }
    const startTimeStr = String(rawStartTime).trim();

    const rawEndTime = params.endTime;
    if (!rawEndTime || String(rawEndTime).trim() === '') {
      throw new ConfigError("Parameter 'endTime' is required for Google Calendar: Create Event.");
    }
    const endTimeStr = String(rawEndTime).trim();

    const description = params.description ? String(params.description) : '';
    const timeZone = params.timeZone ? String(params.timeZone).trim() : 'UTC';
    const calendarId = params.calendarId ? String(params.calendarId).trim() : 'primary';

    // Parse attendees if provided
    let attendeesList: Array<{ email: string }> = [];
    if (params.attendees) {
      if (Array.isArray(params.attendees)) {
        attendeesList = params.attendees.map((e) => ({
          email: typeof e === 'object' && e !== null && 'email' in e ? String((e as any).email) : String(e),
        }));
      } else if (typeof params.attendees === 'string') {
        attendeesList = params.attendees
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e.length > 0)
          .map((email) => ({ email }));
      }
    }

    ctx.log('info', `Creating Google Calendar event "${summary}" starting at ${startTimeStr}`);

    const eventPayload: Record<string, any> = {
      summary,
      description,
      start: {
        dateTime: startTimeStr.includes('T') ? startTimeStr : `${startTimeStr}T09:00:00Z`,
        timeZone,
      },
      end: {
        dateTime: endTimeStr.includes('T') ? endTimeStr : `${endTimeStr}T10:00:00Z`,
        timeZone,
      },
    };

    if (attendeesList.length > 0) {
      eventPayload.attendees = attendeesList;
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`;

    const res = await GoogleAuthHelper.fetchGoogle(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      },
      secrets,
      ctx,
      'Google Calendar'
    );

    ctx.log('info', `Event created successfully (id: ${res?.id || 'unknown'})`);

    return {
      id: res?.id || null,
      summary: res?.summary || summary,
      htmlLink: res?.htmlLink || null,
      startTime: res?.start?.dateTime || startTimeStr,
      endTime: res?.end?.dateTime || endTimeStr,
      status: res?.status || 'confirmed',
      calendarId,
    };
  }
}

export class CalendarCreateEventNode extends IntegrationActionNode {
  readonly type = 'calendar.createEvent';
  readonly label = 'Google Calendar: Create Event';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'calendar.createEvent';

  readonly params: ParamField[] = [
    {
      name: 'summary',
      label: 'Event Title',
      kind: 'string',
      required: true,
      default: 'Team Sync: {{ $node.trigger.output.topic }}',
    },
    {
      name: 'description',
      label: 'Description / Notes',
      kind: 'text',
      required: false,
      default: 'Automated calendar event created by Vulp.',
    },
    {
      name: 'startTime',
      label: 'Start Time (ISO 8601 or YYYY-MM-DDTHH:mm:ssZ)',
      kind: 'string',
      required: true,
      default: '2026-11-06T10:00:00Z',
    },
    {
      name: 'endTime',
      label: 'End Time (ISO 8601 or YYYY-MM-DDTHH:mm:ssZ)',
      kind: 'string',
      required: true,
      default: '2026-11-06T11:00:00Z',
    },
    {
      name: 'timeZone',
      label: 'Timezone',
      kind: 'string',
      required: false,
      default: 'UTC',
    },
    {
      name: 'calendarId',
      label: 'Calendar ID (defaults to primary)',
      kind: 'string',
      required: false,
      default: 'primary',
    },
    {
      name: 'attendees',
      label: 'Attendees (comma-separated emails)',
      kind: 'string',
      required: false,
    },
  ];

  private readonly op = new CalendarCreateEventOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
