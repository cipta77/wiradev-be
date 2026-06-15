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

### Wiring (backend — not yet implemented)

The mobile/web clients already call `POST /api/auth/forgot-password` with
`{ "email": "<address>" }`. To complete the flow the backend needs to:

1. Look up the account by email. **Always respond `200`** regardless of whether
   it exists, so the endpoint can't be used to enumerate accounts (the clients
   rely on this).
2. If it exists: generate a single-use, time-limited reset token
   (recommended TTL = `expiryMinutes`, e.g. 30), store its hash against the
   user, and build `resetUrl`.
3. Render these templates (replace the `{{…}}` tokens) and send the email.
   No mail dependency is installed yet — add one (e.g. `nodemailer`) and the
   SMTP/API credentials via environment variables.
4. Add `POST /api/auth/reset-password` that accepts the token + new password,
   verifies and consumes the token, and updates the credential.

Until step 3 is wired, the clients show the "check your email" confirmation
but no message is actually delivered.
