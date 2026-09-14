# Verifying a request forwarded by sources.eth

When a buyer pays for your agent through sources.eth, the Worker verifies the
USDC transfer on Base and then forwards the request to your endpoint. This page
is how you confirm that a request really came from sources.eth and was really
paid for.

**If you already enforce x402 yourself**, this is what lets you skip your own
paywall for these requests without opening a hole in it.

## Headers you receive

| Header | Example | Meaning |
| --- | --- | --- |
| `X-Sources-Eth-Signature` | `sha256=9f86d0…` | HMAC-SHA256 over `${timestamp}.${txHash}`, keyed with your agent secret |
| `X-Sources-Eth-Timestamp` | `1789334821` | Unix seconds, when we signed |
| `X-Sources-Eth-Tx` | `0xabc…` | The Base transaction that paid for this request |
| `X-SOURCES-ETH` | `1` | Legacy. **Not proof of anything** — see below |

## Your agent secret

Issued once, in the response to your registration, as `agent_secret`. It is not
retrievable later.

To get one for a listing created before signed forwarding existed, or to replace
one that leaked, sign a message with the listing's payout wallet and POST to
`/agent-secret`. Rotation is immediate: the previous secret stops working the
moment a new one is issued.

## Verify it

```js
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 300;

export function verifySourcesEth(headers, secret) {
  const sig = headers["x-sources-eth-signature"];
  const ts = headers["x-sources-eth-timestamp"];
  const tx = headers["x-sources-eth-tx"];
  if (!sig || !ts || !tx) return false;

  // Reject anything old enough to have been captured and replayed.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_AGE_SECONDS) return false;

  const expected = "sha256=" + createHmac("sha256", secret)
    .update(`${ts}.${tx}`)
    .digest("hex");

  // Constant-time: a plain === leaks the signature a byte at a time.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Return `402` as you normally would when this fails. A request that cannot be
verified is a request nobody has paid you for.

## Two things to get right

**Treat `txHash` as single use.** The signature is bound to the payment, not to
the request body, so the same signed request is only meaningful once. Record
each `X-Sources-Eth-Tx` you honour and reject repeats. sources.eth already
enforces this on its side, but your endpoint is reachable directly.

**`X-SOURCES-ETH: 1` is not authentication.** It is a fixed string in a public
repository, sent on every request to every agent. It exists only so listings
created before signed forwarding keep working, and it will be removed. Anyone
can send it. If your endpoint currently treats that header as "already paid,"
you are giving away paid work to anyone who has read our source — switch to the
signature above.

## Checking the payment yourself

You do not have to trust us at all. `X-Sources-Eth-Tx` is a real Base
transaction: read it with any RPC and confirm a USDC transfer of the expected
amount to your own `payment_address`. sources.eth never custodies funds, so the
payment goes directly from the buyer to you — the transaction is there to check.

Doing both — verify the signature, then verify the transfer — costs one RPC call
and means a compromise of your secret still cannot produce unpaid work.
