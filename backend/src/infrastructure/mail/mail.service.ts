import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
};

type SendParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  errorLabel?: string;
  throwOnError?: boolean;
};

@Injectable()
export class MailService {
  private mailer?: nodemailer.Transporter;
  private readonly mailFrom?: string;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;

    this.mailFrom = this.configService.get<string>('SMTP_FROM') || smtpUser;

    if (smtpHost && smtpUser && smtpPass) {
      this.mailer = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.mailer);
  }

  async sendMail(params: SendParams): Promise<boolean> {
    const {
      to,
      subject,
      html,
      text,
      attachments,
      errorLabel,
      throwOnError = false,
    } = params;

    if (!this.mailer) {
      if (throwOnError) {
        throw new Error('Email service not configured');
      }
      return false;
    }

    try {
      await this.mailer.sendMail({
        to,
        from: this.mailFrom,
        subject,
        text,
        html,
        attachments,
      });
      return true;
    } catch (err) {
      if (throwOnError) {
        throw err;
      }
      console.error(`Failed to send ${errorLabel || 'email'}`, err);
      return false;
    }
  }
}
