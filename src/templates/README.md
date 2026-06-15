# Email templates

Templates sent to users by the backend. Both an HTML and a plaintext variant
are provided for each message — always send **both** as a multipart email so
clients that block HTML still render the text part.

## password-reset-email

Sent when a user requests a password reset (mobile `Forgot Password` flow →
`POST /api/auth/forgot-password`, and the equivalent web flow).

| Placeholder        | Meaning                                              | Example                                              |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| `{{userName}}`     | Display name; fall back to `there` if unknown        | `Andi`                                               |
| `{{resetUrl}}`     | Full one-time reset link (token embedded)            | `https://app.wirapath.com/reset-password?token=abc…` |
| `{{expiryMinutes}}`| Link lifetime in minutes (keep in sync with token)   | `30`                                                 |
| `{{supportEmail}}` | Support address                                      | `support@wirapath.com`                               |
| `{{year}}`         | Current year                                         | `2026`                                               |

### Wiring (backend — implemented)

The flow is implemented in `auth.controller.ts` / `auth.service.ts` /
`email.service.ts`:

- `POST /api/auth/forgot-password` `{ email }` → always responds `200`
  (anti-enumeration); if the account exists and has a password, issues a
  30-minute JWT reset token and emails the link. The token is signed with a
  per-user secret derived from the current password hash, so it is implicitly
  single-use — once the password changes, old tokens stop verifying.
- `POST /api/auth/reset-password` `{ token, password }` → verifies the token
  against the user's current hash and stores the new password (min 8 chars).
- `EmailService` renders these templates and sends them.

### Configuration

| Env var            | Purpose                                              | Default                          |
| ------------------ | ---------------------------------------------------- | -------------------------------- |
| `APP_URL`          | Frontend base for `resetUrl`                         | `http://localhost:3000`          |
| `JWT_RESET_SECRET` | Base secret for reset tokens                         | `reset_secret` (set in prod!)    |
| `SMTP_HOST`        | SMTP server host — **email is only sent if set**     | _(unset → dev console fallback)_ |
| `SMTP_PORT`        | SMTP port                                            | `587`                            |
| `SMTP_SECURE`      | `true` for implicit TLS (port 465)                   | `false`                          |
| `SMTP_USER`/`SMTP_PASS` | SMTP credentials (optional)                     | _(unset)_                        |
| `MAIL_FROM`        | From header                                          | `Wirapath <no-reply@wirapath.com>` |
| `SUPPORT_EMAIL`    | Support address shown in the email                   | `support@wirapath.com`           |

`nodemailer` is declared in `package.json` but loaded lazily: until you run
`npm install` and set `SMTP_HOST`, the rendered email is logged to the console
(including the reset link) so the flow is fully testable in development without
credentials.

> The frontend still needs a `/reset-password?token=…` page that collects the
> new password and calls `POST /api/auth/reset-password`.
