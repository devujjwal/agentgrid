/** Server transport only. Public code must never import from backend/. */
export type EmailFailure =
  'invalid-input' | 'transport-failed' | 'provider-rejected' | 'invalid-response';

export class EmailDeliveryError extends Error {
  readonly code: EmailFailure;

  constructor(code: EmailFailure) {
    // Provider messages, response bodies and request values can contain secrets.
    super(`AgentGrid email delivery: ${code}`);
    this.name = 'EmailDeliveryError';
    this.code = code;
  }
}

export interface SignInEmail {
  recipient: string;
  code: string;
  expiresInMinutes: number;
  /** An opaque challenge UUID, reused when retrying this exact delivery. */
  challengeId: string;
}

export interface ResendConfiguration {
  apiKey: string;
  fromEmail: string;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAILBOX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;

function validate(configuration: ResendConfiguration, email: SignInEmail): void {
  if (
    !/^re_[A-Za-z0-9_-]{20,}$/.test(configuration.apiKey) ||
    !/^[A-Za-z0-9._+-]+@mail\.agentgrid\.me$/.test(configuration.fromEmail) ||
    email.recipient.length > 254 ||
    !MAILBOX.test(email.recipient) ||
    !/^\d{6,10}$/.test(email.code) ||
    !Number.isInteger(email.expiresInMinutes) ||
    email.expiresInMinutes < 1 ||
    email.expiresInMinutes > 60 ||
    !UUID.test(email.challengeId)
  ) {
    throw new EmailDeliveryError('invalid-input');
  }
}

/** API acceptance is a receipt, not proof that the recipient received the email. */
export async function sendSignInEmail(
  configuration: ResendConfiguration,
  email: SignInEmail,
  transport: typeof fetch = fetch,
): Promise<{ receiptId: string }> {
  validate(configuration, email);
  let response: Response;
  try {
    response = await transport('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `agentgrid_signin_${email.challengeId}`,
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: `AgentGrid <${configuration.fromEmail}>`,
        to: [email.recipient],
        subject: 'Your AgentGrid sign-in code',
        // No link, tracking pixel, user-supplied HTML or code in the subject.
        text: `Your AgentGrid sign-in code is ${email.code}.\n\nIt expires in ${email.expiresInMinutes} minutes. Enter it only on AgentGrid.\n\nIf you did not request this code, you can ignore this email.`,
        tags: [{ name: 'application', value: 'agentgrid' }],
      }),
    });
  } catch {
    throw new EmailDeliveryError('transport-failed');
  }
  if (!response.ok) throw new EmailDeliveryError('provider-rejected');
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new EmailDeliveryError('invalid-response');
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !UUID.test(body.id)
  ) {
    throw new EmailDeliveryError('invalid-response');
  }
  return { receiptId: body.id };
}
