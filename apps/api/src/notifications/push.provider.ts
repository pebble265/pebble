import { Logger } from '@nestjs/common';

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface PushMessage {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** 'high' wakes the phone (crisis, dose due); 'normal' otherwise. */
  priority?: 'high' | 'normal';
}

export interface PushResult {
  /** Tokens the push service says are no longer valid — delete them. */
  invalidTokens: string[];
  sent: number;
  failed: number;
}

export interface PushProvider {
  readonly name: string;
  send(messages: PushMessage[]): Promise<PushResult>;
}

/** Expo Push API — works for both iOS and Android apps built with Expo. */
export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';
  private readonly logger = new Logger(ExpoPushProvider.name);
  private static readonly URL = 'https://exp.host/--/api/v2/push/send';
  private static readonly BATCH = 100; // Expo's limit per request

  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushResult> {
    const result: PushResult = { invalidTokens: [], sent: 0, failed: 0 };

    for (let i = 0; i < messages.length; i += ExpoPushProvider.BATCH) {
      const batch = messages.slice(i, i + ExpoPushProvider.BATCH).map((m) => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data ?? {},
        sound: 'default',
        priority: m.priority ?? 'normal',
        channelId: m.priority === 'high' ? 'urgent' : 'default',
      }));

      try {
        const res = await fetch(ExpoPushProvider.URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          this.logger.error(`Expo push HTTP ${res.status}`);
          result.failed += batch.length;
          continue;
        }
        const json: any = await res.json();
        const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
        tickets.forEach((t, idx) => {
          if (t?.status === 'ok') {
            result.sent++;
          } else {
            result.failed++;
            if (t?.details?.error === 'DeviceNotRegistered') {
              result.invalidTokens.push(batch[idx].to);
            }
          }
        });
      } catch (e) {
        this.logger.error(`Expo push failed: ${(e as Error).message}`);
        result.failed += batch.length;
      }
    }
    return result;
  }
}

/** Dev mode: prints instead of sending (PUSH_PROVIDER=log). */
export class LogPushProvider implements PushProvider {
  readonly name = 'log';
  private readonly logger = new Logger('Push(log)');
  readonly sentLog: PushMessage[] = [];

  async send(messages: PushMessage[]): Promise<PushResult> {
    for (const m of messages) {
      this.sentLog.push(m);
      this.logger.log(`-> ${m.to.slice(0, 22)}… [${m.priority ?? 'normal'}] ${m.title}: ${m.body}`);
    }
    return { invalidTokens: [], sent: messages.length, failed: 0 };
  }
}
