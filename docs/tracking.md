## Conversion tracking

With the tracked `/r/…` link, attribution takes three small pieces on the brand's side: the click id travels in the URL, and you report the sale from your server. With your own per-creator landing pages, see below.

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

### Pixel

No server code? Put a 1×1 pixel on the landing page instead. Each load counts as a visit to that creator's live offer (bots and link previews aren't counted). Use your brand workspace's slug and the creator's handle:

landing page (HTML)

```
<img src="https://transformer.gg/p/<brand-slug>/<handle>.gif" width="1" height="1" alt="" />
```

The pixel only counts visits. Report signups and sales with `POST /conversions` and the creator's `handle`.
