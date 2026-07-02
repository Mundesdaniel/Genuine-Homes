#!/usr/bin/env node
/**
 * Flutterwave sandbox smoke test — proves initiate → checkout → webhook →
 * verify → settle against a locally running API (see
 * docs/payments-sandbox-runbook.md).
 *
 * Usage:
 *   node scripts/payment-sandbox-smoke.mjs
 *   API_URL=https://<tunnel> EMAIL=+256700000003 PASSWORD=Password123! \
 *     node scripts/payment-sandbox-smoke.mjs
 *
 * The script initiates a small verification_fee payment, prints the hosted
 * checkout link (complete it with a Flutterwave test card), then polls the
 * payment until the webhook settles it. Exit 0 = round-trip proven.
 */

const API_URL = (process.env.API_URL ?? 'http://localhost:3100').replace(/\/$/, '');
const EMAIL_OR_PHONE = process.env.EMAIL ?? '+256700000003'; // seeded buyer
const PASSWORD = process.env.PASSWORD ?? 'Password123!';
const AMOUNT = Number(process.env.AMOUNT ?? 5000); // UGX
const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 10 * 60_000;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

const log = (msg) => console.log(`[smoke] ${msg}`);

try {
  log(`API: ${API_URL}`);
  const auth = await api('/auth/login', {
    method: 'POST',
    body: { emailOrPhone: EMAIL_OR_PHONE, password: PASSWORD },
  });
  const token = auth.accessToken;
  log(`logged in as ${EMAIL_OR_PHONE}`);

  const initiation = await api('/payments/initiate', {
    method: 'POST',
    token,
    body: { purpose: 'verification_fee', amount: AMOUNT, provider: 'card' },
  });
  const paymentId = initiation.payment.id;
  log(`payment ${paymentId} initiated (${AMOUNT} UGX)`);

  if (!initiation.redirectUrl) throw new Error('No checkout URL returned');
  if (initiation.redirectUrl.includes('/payments/mock-checkout/')) {
    throw new Error(
      'The API is running the MOCK gateway — set PAYMENT_GATEWAY=flutterwave + sandbox keys first.',
    );
  }
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  Open this checkout link and pay with a Flutterwave test card:');
  console.log(`  ${initiation.redirectUrl}`);
  console.log('  Test card: 5531 8866 5214 2950 · cvv 564 · 09/32 · pin 3310 · otp 12345');
  console.log('════════════════════════════════════════════════════════════\n');

  log('polling the ledger until the webhook settles the payment…');
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the webhook');
    const payment = await api(`/payments/${paymentId}`, { token });
    if (payment.status === 'successful') {
      log(`✅ settled: providerRef=${payment.providerRef}`);
      log('round-trip proven — record the transaction id in REMAINING_WORK.md');
      process.exit(0);
    }
    if (payment.status === 'failed') throw new Error('Payment settled as FAILED');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
} catch (err) {
  console.error(`[smoke] ❌ ${err.message}`);
  process.exit(1);
}
