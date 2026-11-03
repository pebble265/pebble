import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { AI_PROVIDER } from '../ai/ai.provider';
import type { AiProvider, ChatTurn } from '../ai/ai.provider';
import { addDays, localDateOf, zonedToUtc } from '../common/time';
import { CryptoService } from '../crypto/crypto.service';
import { DosesService } from '../doses/doses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isCrisis,
  SAFE_CRISIS_REPLY,
  SAFE_FALLBACK_REPLY,
} from './crisis';
import { companionSystemPrompt, SUMMARY_PROMPT } from './prompts';

/** A conversation ends after this long without a message. */
export const IDLE_MINUTES = 30;
/** Turns kept in memory and sent to the AI (user + assistant). */
const MAX_TURNS = 20;
/** Don't raise a second crisis alert for the same conversation within this window. */
const CRISIS_ALERT_COOLDOWN_MIN = 30;

interface Session {
  userId: string;
  deviceId: string | null;
  turns: ChatTurn[];
  lastActive: number;
  crisis: boolean;
}

/**
 * Transcripts are NOT stored in the database. The live turns of an open
 * conversation are kept in server memory only; when it ends, an encrypted
 * summary + mood score is saved and the turns are dropped.
 */
@Injectable()
export class ChatService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatService.name);
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly doses: DosesService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  // =====================================================================
  // Send a message
  // =====================================================================
  async send(
    userId: string,
    message: string,
    conversationId?: string,
    deviceId: string | null = null,
  ) {
    const text = message.trim();
    const { id, session } = await this.openSession(userId, conversationId, deviceId);

    // ---- Crisis check on the user's words (independent of the chat AI) ----
    const inputMod = await this.ai.moderate(text);
    const crisisNow = isCrisis(text, inputMod);
    if (crisisNow) session.crisis = true;

    session.turns.push({ role: 'user', content: text });

    // ---- Ask the AI ----
    let reply: string;
    let aiOk = true;
    try {
      const system = companionSystemPrompt(await this.promptContext(userId, session.crisis));
      reply = await this.ai.chat(system, session.turns.slice(-MAX_TURNS));
    } catch (e) {
      aiOk = false;
      this.logger.error(`AI chat failed: ${(e as Error).message}`);
      reply = session.crisis ? SAFE_CRISIS_REPLY : SAFE_FALLBACK_REPLY;
    }

    // ---- Check the AI's own reply before it reaches the user ----
    if (aiOk) {
      const outMod = await this.ai.moderate(reply);
      if (outMod?.selfHarmInstructions) {
        this.logger.warn(`Blocked an unsafe AI reply in conversation ${id}`);
        reply = SAFE_CRISIS_REPLY;
      }
    }

    session.turns.push({ role: 'assistant', content: reply });
    if (session.turns.length > MAX_TURNS) {
      session.turns.splice(0, session.turns.length - MAX_TURNS);
    }
    session.lastActive = Date.now();

    await this.prisma.conversations.update({
      where: { id },
      data: { turn_count: { increment: 1 } },
    });

    let crisis: { detected: true; contacts: { label: string; phone: string }[] } | null = null;
    if (crisisNow) {
      await this.raiseCrisisAlert(userId, id, deviceId);
      const contacts = await this.prisma.emergency_contacts.findMany({
        where: { user_id: userId },
        orderBy: { sort_order: 'asc' },
        select: { label: true, phone: true },
      });
      crisis = { detected: true, contacts };
    }

    return { conversationId: id, reply, crisis };
  }

  // =====================================================================
  // End a conversation -> encrypted summary + mood + memories
  // =====================================================================
  async end(userId: string, conversationId: string) {
    const convo = await this.prisma.conversations.findFirst({
      where: { id: conversationId, user_id: userId, deleted_at: null },
      select: { id: true, ended_at: true },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    if (convo.ended_at) return { conversationId, ended: true };
    await this.finish(conversationId);
    return { conversationId, ended: true };
  }

  /** Called by the idle job and on shutdown. */
  async endIdle(): Promise<number> {
    const cutoff = Date.now() - IDLE_MINUTES * 60_000;
    const idle = [...this.sessions.entries()].filter(([, s]) => s.lastActive < cutoff);
    for (const [id] of idle) await this.finish(id);
    return idle.length;
  }

  async onModuleDestroy() {
    for (const id of [...this.sessions.keys()]) await this.finish(id);
  }

  private async finish(conversationId: string) {
    const session = this.sessions.get(conversationId);
    this.sessions.delete(conversationId);

    let summary: string | null = null;
    let mood: number | null = null;
    let memories: string[] = [];

    if (session && session.turns.length) {
      try {
        const transcript = session.turns
          .map((t) => `${t.role === 'user' ? 'USER' : 'ROBOT'}: ${t.content}`)
          .join('\n');
        const raw = await this.ai.chat(
          SUMMARY_PROMPT,
          [{ role: 'user', content: transcript }],
          { json: true, maxTokens: 400 },
        );
        const parsed = JSON.parse(raw);
        if (typeof parsed.summary === 'string') summary = parsed.summary.slice(0, 1000);
        if (Number.isInteger(parsed.mood) && parsed.mood >= 1 && parsed.mood <= 5) {
          mood = parsed.mood;
        }
        if (Array.isArray(parsed.memories)) {
          memories = parsed.memories
            .filter((m: unknown): m is string => typeof m === 'string' && !!m.trim())
            .slice(0, 3)
            .map((m: string) => m.trim().slice(0, 200));
        }
      } catch (e) {
        this.logger.warn(`Summary failed for ${conversationId}: ${(e as Error).message}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const c = await tx.conversations.update({
        where: { id: conversationId },
        data: { ended_at: new Date() },
        select: { user_id: true },
      });
      if (summary !== null || session?.crisis) {
        await tx.conversation_summaries.upsert({
          where: { conversation_id: conversationId },
          create: {
            conversation_id: conversationId,
            summary_enc: this.crypto.encrypt(summary ?? '(ไม่มีสรุป)'),
            mood_score: mood,
            risk_flagged: !!session?.crisis,
          },
          update: {},
        });
      }
      if (memories.length) {
        await tx.companion_memories.createMany({
          data: memories.map((m) => ({
            user_id: c.user_id,
            content_enc: this.crypto.encrypt(m),
            source_conversation_id: conversationId,
          })),
        });
      }
    });
  }

  // =====================================================================
  // History & memories (user can see and delete what Pebble remembers)
  // =====================================================================
  async history(userId: string) {
    const rows = await this.prisma.conversations.findMany({
      where: { user_id: userId, deleted_at: null, ended_at: { not: null } },
      include: { conversation_summaries: true },
      orderBy: { started_at: 'desc' },
      take: 30,
    });
    return rows.map((c) => ({
      id: c.id,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      messages: c.turn_count,
      fromRobot: c.device_id !== null,
      summary: c.conversation_summaries
        ? this.crypto.decrypt(c.conversation_summaries.summary_enc)
        : null,
      mood: c.conversation_summaries?.mood_score ?? null,
    }));
  }

  async deleteConversation(userId: string, conversationId: string) {
    const { count } = await this.prisma.conversations.updateMany({
      where: { id: conversationId, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (count === 0) throw new NotFoundException('Conversation not found');
    this.sessions.delete(conversationId);
    await this.prisma.conversation_summaries.deleteMany({
      where: { conversation_id: conversationId },
    });
  }

  async memories(userId: string) {
    const rows = await this.prisma.companion_memories.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((m) => ({
      id: m.id,
      content: this.crypto.decrypt(m.content_enc),
      createdAt: m.created_at,
    }));
  }

  async deleteMemory(userId: string, memoryId: string) {
    const { count } = await this.prisma.companion_memories.deleteMany({
      where: { id: memoryId, user_id: userId },
    });
    if (count === 0) throw new NotFoundException('Memory not found');
  }

  // =====================================================================
  // Helpers
  // =====================================================================
  private async openSession(
    userId: string,
    conversationId: string | undefined,
    deviceId: string | null,
  ): Promise<{ id: string; session: Session }> {
    if (conversationId) {
      const existing = this.sessions.get(conversationId);
      if (existing && existing.userId === userId) return { id: conversationId, session: existing };

      // Server restarted, or the id belongs to an older/other conversation.
      const convo = await this.prisma.conversations.findFirst({
        where: { id: conversationId, user_id: userId, deleted_at: null, ended_at: null },
        select: { id: true },
      });
      if (!convo) throw new NotFoundException('Conversation not found or already ended');
      const session: Session = {
        userId,
        deviceId,
        turns: [],
        lastActive: Date.now(),
        crisis: false,
      };
      this.sessions.set(convo.id, session);
      return { id: convo.id, session };
    }

    const created = await this.prisma.conversations.create({
      data: { user_id: userId, device_id: deviceId },
      select: { id: true },
    });
    const session: Session = {
      userId,
      deviceId,
      turns: [],
      lastActive: Date.now(),
      crisis: false,
    };
    this.sessions.set(created.id, session);
    return { id: created.id, session };
  }

  private async raiseCrisisAlert(userId: string, conversationId: string, deviceId: string | null) {
    const since = new Date(Date.now() - CRISIS_ALERT_COOLDOWN_MIN * 60_000);
    const recent = await this.prisma.alerts.findFirst({
      where: {
        user_id: userId,
        type: 'crisis',
        related_conversation_id: conversationId,
        created_at: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return;
    await this.prisma.alerts.create({
      data: {
        user_id: userId,
        device_id: deviceId,
        type: 'crisis',
        severity: 'critical',
        related_conversation_id: conversationId,
      },
    });
  }

  private async promptContext(userId: string, crisis: boolean) {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
      select: { display_name: true, timezone: true, locale: true, uses_medication: true },
    });
    const settings = await this.prisma.robot_settings.findUnique({
      where: { user_id: userId },
      select: { robot_name: true },
    });
    const tz = user.timezone;
    const today = localDateOf(new Date(), tz);
    // Make sure today's doses exist even if a medication was added minutes ago.
    if (user.uses_medication) await this.doses.ensureDoseEvents(userId, tz, today, 1);

    const [memRows, sumRows, doses] = await Promise.all([
      this.prisma.companion_memories.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 20,
        select: { content_enc: true },
      }),
      this.prisma.conversation_summaries.findMany({
        where: { conversations: { user_id: userId, deleted_at: null } },
        orderBy: { created_at: 'desc' },
        take: 3,
        select: { summary_enc: true },
      }),
      this.prisma.dose_events.findMany({
        where: {
          user_id: userId,
          scheduled_at: {
            gte: zonedToUtc(today, '00:00', tz),
            lt: zonedToUtc(addDays(today, 1), '00:00', tz),
          },
        },
        orderBy: { scheduled_at: 'asc' },
        select: { scheduled_at: true, status: true },
      }),
    ]);

    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
    const nowLocal = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    return {
      robotName: settings?.robot_name ?? 'Pebble',
      userName: user.display_name,
      locale: user.locale,
      nowLocal,
      crisis,
      memories: memRows.map((m) => this.crypto.decrypt(m.content_enc)),
      recentSummaries: sumRows.map((s) => this.crypto.decrypt(s.summary_enc)),
      doseLines: doses.map((d) => `- ${timeFmt.format(d.scheduled_at)}: ${d.status}`),
    };
  }
}
