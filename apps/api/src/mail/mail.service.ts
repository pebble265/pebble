import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends email over SMTP (any provider: Gmail app password, Resend, Brevo, ...).
 *
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
 *   MAIL_FROM  e.g.  "Pebble(a) <no-reply@yourdomain.com>"
 *
 * Needs `npm i nodemailer` in apps/api. With no SMTP_HOST the mail is only
 * written to the server log, which is handy while developing.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private transport: Promise<{ sendMail(m: object): Promise<unknown> }> | null = null;

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return !!this.config.get<string>('SMTP_HOST');
  }

  async send(mail: Mail): Promise<void> {
    if (!this.configured) {
      this.log.warn(`SMTP_HOST is not set, so this email was NOT sent.\n  To: ${mail.to}\n  Subject: ${mail.subject}\n${mail.text}`);
      return;
    }
    const transport = await this.getTransport();
    await transport.sendMail({
      from: this.config.get<string>('MAIL_FROM') ?? this.config.get<string>('SMTP_USER'),
      ...mail,
    });
  }

  private getTransport() {
    this.transport ??= (async () => {
      const name = 'nodemailer'; // optional dependency, loaded only when SMTP is configured
      const nodemailer = (await import(name)) as {
        createTransport(o: object): { sendMail(m: object): Promise<unknown> };
      };
      const port = Number(this.config.get('SMTP_PORT') ?? 587);
      return nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') },
      });
    })().catch((e) => {
      this.transport = null;
      throw e;
    });
    return this.transport;
  }
}
