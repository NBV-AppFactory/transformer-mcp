## Concepts

### Workspaces

A workspace is a brand or a creator. People join workspaces as members; agents act for a workspace through its API keys. A creator workspace has one connected X account.

### Offers and their lifecycle

An offer is what a brand sends a creator: a title and note (`brief`), a link to promote (`url`), a deliverable, a quantity, a payout and an optional commission on sales. Brands address creators by X handle (or by email, or creator workspace id); the creator who accepts must own that handle. Unanswered offers expire when their window ends (the brand picks 3, 7, 10 or 14 days; default 7). The `status` field below is the raw state; every offer also carries `stageInfo`, the one status shown everywhere (sent, viewed, countered, accepted, payment needed, funded, in review, confirmed, paid; not delivered, sent back; declined, expired, cancelled), worded for your side, with `stages` (history) and `timeline` (timestamps).

stageInfo.key (the status to show)

sent → viewed → countered_by_creator / countered_by_brand → accepted → funded → in_review → approved → paid_out

problems: not_delivered · payment_needed · rejected · endings: declined · expired · cancelled

raw status (legacy, for older clients)

sent → accepted → submitted → verified → paid

sent → declined · sent / accepted → cancelled · sent → expired

- `sent`: the brand created the offer; the creator gets an invite.
- `accepted`: the creator accepted; a tracked link now exists. The brand's saved card is charged at that moment. If the charge fails, `stage` is `awaiting_payment` (`payment.failure` says why, `funding.due` how much and by when, and submitting a post returns 409 `payment_pending`); unpaid by then, the offer is cancelled.
- `submitted`: the creator submitted a post; the Transformer team is reviewing it (or some, but not yet all, deliverables are confirmed).
- `verified`: the Transformer team confirmed every deliverable: live on X, from the right account, with the tracked link and the Paid partnership label.
- `paid`: the held payout was released to the creator.
- `declined` by the creator, `cancelled` by the brand, or `expired` unanswered.

### Deliverables

`post` (a single X post), `thread` (an X thread) or `video` (an X post with video). `quantity` (1–20) is how many of them the offer covers. X is the first platform; more will follow.

### Tracked links and tf_click

When a creator accepts, the offer gets a tracked link like `https://transformer.gg/r/k3v9x2`. Each click is counted and redirected to the offer's `url` with a `tf_click` query parameter appended, e.g. `https://acme.com/launch?tf_click=b2e7d4a1-5c3f-4e8a-9d61-7a0c2f9e8b14`. That id identifies the click, and through it the offer and creator.

### The link creators post: postLink

Every offer has a `postLink`, the exact link the creator puts in their post, and `mustInclude`, the list the post check looks for (that link and the disclosure). The post must carry X's Paid partnership label (that's the disclosure; no hashtag is needed). If the brand has a landing page per creator, set a `landingUrlTemplate` such as `https://acme.com/x/{handle}` (on the brand's pricing settings, a template, or the offer itself): each offer then gets its own `landingUrl`, e.g. `https://acme.com/x/demo_creator`, and that is the `postLink`. Otherwise `postLink` is the tracked `/r/…` link (which redirects to the creator's landing page, if there is one, with `?tf_click=` appended). The check accepts the link as X shows it (expanded from t.co), ignoring scheme, `www.`, case, a trailing slash and the query string.

### Conversions and commission

A conversion is a sale the brand reports with the `tf_click` id, an amount and its own order id. If the offer has a `commissionPercent`, commission is calculated on the amount and credited to the creator. Order ids are unique per offer, so reporting the same order twice is a no-op and retries are safe. If a sale can't be tied to a click, report it with the creator's `handle` (their latest live offer from you) or the `offerId`.

### Payments

Sending needs a card on file (409 `card_required` with a `setupUrl` otherwise); the card is charged when the creator accepts, and the payout is held. A failed charge can be paid with `POST /offers/:id/pay` or `POST /pay-due`. When the Transformer team confirms the creator's deliverables, the held payout is released to the creator; the offer moves to `paid` once it's paid out. Each offer reports its `paymentStatus`: `unfunded`, `funded`, `released`, `paid_out` or `refunded`.

### Webhooks

Not yet available. Poll `GET /api/v1/offers` and `GET /api/v1/offers/{id}/stats` for now.
