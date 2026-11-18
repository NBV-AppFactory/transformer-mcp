## Conversion tracking

Every offer has a tracked `/r/…` link. When a visitor clicks it, Transformer sends them to your site with a `?tf_click=…` id. The quickest way to turn those clicks into sign-ups and sales is the Transformer pixel below; for sales that pay creators a commission, also report them from your server.

### The Transformer pixel

Paste this on every page of your site, before `</head>`. Keep the first line: it lets you call `tf(…)` before the script has loaded. Your real brand id and a ready-made copy are on **Tracking** (in your brand menu), or ask an agent with the `tracking_snippet` MCP tool.

every page (HTML)

```
<!-- Every page, before </head>. Your real brand id is on Tracking (in your brand menu). -->
<script>window.tf=window.tf||function(){(window.tf.q=window.tf.q||[]).push(arguments)};</script>
<script async src="https://transformer.gg/t.js" data-brand="YOUR_BRAND_ID"></script>
```

The pixel keeps the `tf_click` id in a first-party cookie on your own domain, so a visitor stays attributed to the creator for 30 days. It sends a `PageView` on every page, including route changes in single-page apps. Then send the events that matter:

browser

```
// After a sign-up, lead, add to cart or purchase (value and currency are optional):
tf("track", "SignUp", { orderId: "user-123" });
tf("track", "Purchase", { value: 49.99, currency: "USD", orderId: "A-1001" });
tf("track", "StartedTrial"); // your own event name
```

- Standard events: `PageView`, `SignUp`, `Lead`, `AddToCart`, `Purchase`. Or your own name (letters, digits and `_`, up to 40 characters).
- Limits: up to 50 events per tracked click per day, up to 50 custom event names per brand, 4 KB per event, and a daily cap on events from visitors who didn't come through a creator's link.
- Send an `orderId` with sign-ups and purchases. The same order sent twice (by the pixel, your server or both) counts once, and your server's copy wins.
- Watch them arrive on **Tracking** (in your brand menu): your last events, live, and counts for the last 24 hours.

The pixel never moves money: anyone can send browser events. Commission sales are paid only from conversions your server reports (below). Purchase values the pixel alone reports are shown apart, as not confirmed.

From your server, send the same events with `POST /api/v1/events` (or the `track_event` MCP tool). This is the reliable path when browsers block scripts:

server

```
curl https://transformer.gg/api/v1/events \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"Purchase","clickId":"<tf_click>","value":49.99,"currency":"USD","orderId":"A-1001"}'
```

What you then see on each offer: the post's numbers over time next to clicks, the visitors the pixel saw, sign-ups, purchases, revenue and return on the post, from the click to the sale.

### Server-side conversions

For sales that pay a creator a commission, report them from your server. It takes three small pieces: the click id travels in the URL, and you report the sale from your server. With your own per-creator landing pages, see below.

### 1. Read tf_click on your site

Visitors from a tracked link land on your offer `url` with `?tf_click=…` appended. Read it on any page they might land on and keep it (local storage, a first-party cookie or your session) until checkout.

browser

```
// On every landing page: keep the click id from the tracked link.
const tfClick = new URLSearchParams(location.search).get("tf_click");
if (tfClick) localStorage.setItem("tf_click", tfClick);

// At checkout: send it with the order to your own backend.
await fetch("/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cart, tfClick: localStorage.getItem("tf_click") }),
});
```

### 2. Store it with the order

Save the `tf_click` value on the order record when it's created, the same way you'd keep a coupon code.

### 3. Report the conversion server-side

When the order is paid, call `POST /api/v1/conversions` with a brand key. Use your own order id so a retry never double-counts.

server

```
// On your server, once the order is paid (store tfClick with the order first).
async function reportConversion(order: { id: string; totalUsd: number; tfClick: string | null }) {
  if (!order.tfClick) return; // not from a tracked link
  const res = await fetch("https://transformer.gg/api/v1/conversions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TRANSFORMER_API_KEY}`, // brand workspace key
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clickId: order.tfClick, amountUsd: order.totalUsd, orderId: order.id }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
}
```

Agents can do the same with the `report_conversion` MCP tool or `transformer conversions report --click <tf_click> --amount 49 --order A-1001`.

### Per-creator landing pages

If creators post a link to your own page (e.g. `https://acme.com/x/demo_creator`, from `landingUrlTemplate`), visitors don't pass through the tracked redirect, so tell Transformer about the visit yourself. On the server that renders `/x/:handle`:

server

```
// GET /x/:handle — record the visit, keep the clickId for the signup.
const res = await fetch("https://transformer.gg/api/v1/visits", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.TRANSFORMER_API_KEY}`, // brand workspace key
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ handle: req.params.handle, clickId: req.query.tf_click, ip: req.ip, userAgent: req.get("user-agent"), referrer: req.get("referer") }),
});
if (res.ok) req.session.tfClick = (await res.json()).clickId;
```

Then report the signup or sale with that `clickId`. If you didn't keep it, send the creator's `handle` instead:

signup

```
curl https://transformer.gg/api/v1/conversions \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clickId":"b2e7d4a1-5c3f-4e8a-9d61-7a0c2f9e8b14","amountUsd":0,"orderId":"signup-8812"}'
# or, without a clickId:  -d '{"handle":"demo_creator","amountUsd":0,"orderId":"signup-8812"}'
```

### Older landing-page pixel

Before the Transformer pixel there was a 1×1 image for per-creator landing pages, and it still works. Use the Transformer pixel above for new sites. To use the image, put it on the landing page. Each load counts as a visit to that creator's live offer (bots and link previews aren't counted). Use your brand workspace's slug and the creator's handle:

landing page (HTML)

```
<img src="https://transformer.gg/p/<brand-slug>/<handle>.gif" width="1" height="1" alt="" />
```

The pixel only counts visits. Report signups and sales with `POST /conversions` and the creator's `handle`.
