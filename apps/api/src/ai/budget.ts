import { Logger } from '@nestjs/common';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Spending guard for the paid AI API.
 *
 * Every reply reports how many tokens it used; we turn that into dollars and
 * keep a running total in a small JSON file (survives restarts). Once today's
 * or the overall budget is used up, calls are refused before they reach the
 * API, and the app falls back to its built-in safe replies.
 *
 * .env (all optional)
 *   AI_DAILY_BUDGET_USD=0.25     per day (Asia/Bangkok)
 *   AI_TOTAL_BUDGET_USD=4.50     for good; raise it after topping up
 *   AI_PRICE_IN_PER_MTOK=0.1     override the price table (USD / 1M tokens)
 *   AI_PRICE_OUT_PER_MTOK=0.5
 *   AI_SPEND_FILE=.ai-spend.json
 */
export class BudgetExceededError extends Error {}

export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface SpendFile {
  total: number;
  days: Record<string, number>;
  calls: number;
}

/** Estimated list prices, USD per 1M tokens. Check the pricing page and override in .env if they differ. */
function priceFor(model: string): { in: number; out: number } {
  const m = model.toLowerCase();
  // Anthropic list prices (Nov 2026). Haiku 5.5: prompts up to 100K tokens; ours are ~2K.
  if (m.includes('haiku')) return { in: 0.1, out: 0.5 };
  if (m.includes('opus')) return { in: 4, out: 20 };
  return { in: 2, out: 10 }; // sonnet and anything else
}

export class AiBudget {
  private readonly logger = new Logger('AiBudget');
  private data: SpendFile;

  constructor(
    private readonly cfg: {
      dailyUsd: number;
      totalUsd: number;
      file: string;
      priceIn?: number;
      priceOut?: number;
    },
  ) {
    this.data = this.load();
    this.logger.log(
      `AI budget: $${this.spentToday().toFixed(3)} / $${cfg.dailyUsd} today, ` +
        `$${this.data.total.toFixed(3)} / $${cfg.totalUsd} total`,
    );
  }

  /** Throws if there is no money left for another call. */
  check() {
    if (this.data.total >= this.cfg.totalUsd) {
      throw new BudgetExceededError(`AI total budget used up ($${this.data.total.toFixed(2)} of $${this.cfg.totalUsd})`);
    }
    if (this.spentToday() >= this.cfg.dailyUsd) {
      throw new BudgetExceededError(`AI daily budget used up ($${this.spentToday().toFixed(2)} of $${this.cfg.dailyUsd})`);
    }
  }

  record(model: string, usage: Usage | undefined) {
    if (!usage) return;
    const p = priceFor(model);
    const pin = this.cfg.priceIn ?? p.in;
    const pout = this.cfg.priceOut ?? p.out;
    const inTok =
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * 0.1;
    const usd = (inTok * pin + (usage.output_tokens ?? 0) * pout) / 1_000_000;
    const day = today();
    this.data.total += usd;
    this.data.days[day] = (this.data.days[day] ?? 0) + usd;
    this.data.calls += 1;
    // keep only the last 60 days
    const keys = Object.keys(this.data.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete this.data.days[k];
    this.save();
  }

  spentToday() {
    return this.data.days[today()] ?? 0;
  }

  summary() {
    return { today: this.spentToday(), total: this.data.total, calls: this.data.calls, ...this.cfg };
  }

  private load(): SpendFile {
    try {
      const j = JSON.parse(readFileSync(this.cfg.file, 'utf8'));
      return { total: Number(j.total) || 0, days: j.days ?? {}, calls: Number(j.calls) || 0 };
    } catch {
      return { total: 0, days: {}, calls: 0 };
    }
  }

  private save() {
    try {
      mkdirSync(dirname(this.cfg.file), { recursive: true });
      writeFileSync(this.cfg.file, JSON.stringify(this.data, null, 2));
    } catch (e) {
      this.logger.warn(`Could not save AI spend: ${(e as Error).message}`);
    }
  }
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}
