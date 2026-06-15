import fs from "fs";
import path from "path";

interface PasswordResetVars {
  userName: string;
  resetUrl: string;
  expiryMinutes: number;
}

/**
 * Renders and delivers transactional emails.
 *
 * Delivery is best-effort and dependency-optional: if SMTP is configured via
 * env and `nodemailer` is installed, the email is sent; otherwise the rendered
 * message is logged to the console so the flow remains testable in development
 * without credentials. Add `nodemailer` to dependencies and set the SMTP_* env
 * vars to enable real delivery.
 */
export class EmailService {
  private templatesDir = path.join(process.cwd(), "src", "templates");
  private supportEmail = process.env.SUPPORT_EMAIL || "support@wirapath.com";
  private fromAddress =
    process.env.MAIL_FROM || `Wirapath <no-reply@wirapath.com>`;

  private render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key in vars ? vars[key] : `{{${key}}}`
    );
  }

  private readTemplate(file: string): string | null {
    try {
      return fs.readFileSync(path.join(this.templatesDir, file), "utf8");
    } catch (err) {
      console.error(`[Email] Could not read template ${file}:`, err);
      return null;
    }
  }

  async sendPasswordResetEmail(to: string, vars: PasswordResetVars): Promise<void> {
    const replacements: Record<string, string> = {
      userName: vars.userName,
      resetUrl: vars.resetUrl,
      expiryMinutes: String(vars.expiryMinutes),
      supportEmail: this.supportEmail,
      year: String(new Date().getFullYear()),
    };

    const htmlTpl = this.readTemplate("password-reset-email.html");
    const textTpl = this.readTemplate("password-reset-email.txt");

    const html = htmlTpl
      ? this.render(htmlTpl, replacements)
      : undefined;
    const text = this.render(
      textTpl ??
        "Reset your Wirapath password: {{resetUrl}} (expires in {{expiryMinutes}} minutes).",
      replacements
    );

    await this.send({
      to,
      subject: "Reset your Wirapath password",
      html,
      text,
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    html?: string;
    text: string;
  }): Promise<void> {
    const host = process.env.SMTP_HOST;

    // No SMTP configured -> dev fallback: log instead of sending so the flow
    // works end-to-end without credentials.
    if (!host) {
      console.log(
        `[Email] SMTP not configured; logging instead of sending.\n` +
          `  to:      ${message.to}\n` +
          `  subject: ${message.subject}\n` +
          `  text:    ${message.text.replace(/\n/g, "\n           ")}`
      );
      return;
    }

    // Load nodemailer lazily so the project builds/runs even when the
    // dependency isn't installed yet. The indirection keeps the compiler from
    // statically resolving the (optional) module.
    let nodemailer: any;
    try {
      const moduleName = "nodemailer";
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodemailer = require(moduleName);
    } catch {
      console.error(
        "[Email] SMTP_HOST is set but 'nodemailer' is not installed. " +
          "Run `npm install nodemailer` to enable email delivery."
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    await transporter.sendMail({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
