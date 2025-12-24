import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type SendParams = {
  to: string;
  subject: string;
  html: string;
  fallbackLog?: string;
  errorLabel?: string;
};

@Injectable()
export class MailService {
  private mailer?: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;

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

  async sendMail(params: SendParams) {
    const { to, subject, html, fallbackLog, errorLabel } = params;
    if (this.mailer) {
      try {
        await this.mailer.sendMail({
          to,
          from:
            this.configService.get<string>('SMTP_FROM') ||
            this.configService.get<string>('SMTP_USER'),
          subject,
          html,
        });
        return;
      } catch (err) {
        console.error(`Failed to send ${errorLabel || 'email'}`, err);
      }
    }
    if (fallbackLog) {
      console.info(fallbackLog);
    }
  }
}
