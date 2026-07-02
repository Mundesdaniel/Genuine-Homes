# Flutterwave sandbox round-trip — runbook

Goal: prove one **real** payment round-trip against the Flutterwave sandbox —
`initiate → hosted checkout → webhook → server-to-server verify → ledger settle
→ plan activation` — before payments are called "done".

The code path is identical to production; only the keys differ (`FLWSECK_TEST-…`).

## What the API does on a webhook (for reference)

1. `POST /api/payments/webhook` — signature checked against
   `FLUTTERWAVE_WEBHOOK_HASH` (`verif-hash` header, constant-time compare).
2. For a *successful* event the API **re-fetches the transaction** from
   `GET /v3/transactions/:id/verify` and refuses to settle unless status,
   `tx_ref`, currency and amount match the ledger row
   (`payment.verification_mismatch` is written to the audit trail on mismatch).
3. Settle is idempotent (`status='pending'` guard + unique `provider_ref`).
4. `PAYMENT_SUCCEEDED` event fans out: deposit → plan activation, installment →
   schedule item paid, notifications, audit `payment.settled`.

## One-time setup

1. **Create a Flutterwave account** (https://dashboard.flutterwave.com) and
   stay in **Test Mode**. Copy from *Settings → API keys*:
   - Secret key `FLWSECK_TEST-…`
2. **Expose your local API** so Flutterwave can call the webhook:
   ```bash
   ngrok http 3100        # or: cloudflared tunnel --url http://localhost:3100
   ```
3. **Configure the webhook** in *Settings → Webhooks*:
   - URL: `https://<your-tunnel>/api/payments/webhook`
   - Secret hash: any strong random string — this becomes `FLUTTERWAVE_WEBHOOK_HASH`.
4. **Set the environment** in `apps/api/.env`:
   ```env
   PAYMENT_GATEWAY=flutterwave
   FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxx
   FLUTTERWAVE_WEBHOOK_HASH=<the secret hash from step 3>
   ```
5. Restart the API (`pnpm dev:api`). The boot log must NOT show the
   "Payment gateway: MOCK" warning.

## The round-trip

### Scripted (payment settle only)

```bash
node scripts/payment-sandbox-smoke.mjs            # defaults: http://localhost:3100
# or: API_URL=https://<tunnel> node scripts/payment-sandbox-smoke.mjs
```

The script logs in as a seeded buyer, initiates a small `verification_fee`
payment, prints the hosted-checkout link for you to complete with a
[test card](https://developer.flutterwave.com/docs/test-cards)
(e.g. `5531 8866 5214 2950`, cvv `564`, expiry `09/32`, pin `3310`, otp `12345`),
then polls the ledger until the webhook settles it. Exit code 0 = round-trip proven.

### Full flow (deposit → plan activation), via the web app

1. `pnpm dev:web`, log in as the seeded buyer (`+256700000003` / `Password123!`).
2. Open an installment listing → create a plan → **Pay deposit**.
3. Complete the hosted checkout with a test card / test MoMo number.
4. Verify:
   - `GET /api/payments/mine` → the deposit is `successful` with a `providerRef`;
   - the plan status flipped `pending_deposit → active`;
   - an in-app "Deposit received" notification exists;
   - `GET /api/admin/audit-logs?action=payment.settled` (as admin) shows the event.

## Verification checklist (record the run)

- [ ] checkout link opened and paid in sandbox
- [ ] webhook received (API log line `Payment <id> settled as successful`)
- [ ] `payments.provider_ref` populated, status `successful`
- [ ] plan activated / notification created
- [ ] audit trail: `payment.initiated` → `payment.settled`
- [ ] duplicate webhook replay ignored (`already settled` log line)

Once all boxes tick, flag B-1 in `REMAINING_WORK.md` as done, noting the date
and the sandbox transaction id.
