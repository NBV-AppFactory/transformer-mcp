## REST reference

Base URL `https://transformer.gg/api/v1`. Requests and responses are JSON. Amounts are in US dollars. In the examples, `$OFFER_ID` is an offer's `id`.

GET `/api/v1/me` brand or creator key

The workspace this key acts for, its connected X account (creators) and totals. Use it to check whether you're on the brand or creator side.

Request

```
curl "https://transformer.gg/api/v1/me" \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "workspace": {
    "id": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
    "kind": "brand",
    "name": "Acme"
  },
  "x": null,
  "stats": {
    "offers": 4,
    "active": 1,
    "completed": 2,
    "payoutsUsd": 500,
    "clicks": 640,
    "revenueUsd": 882,
    "commissionUsd": 88.2
  }
}
```

GET `/api/v1/creators?q=fitness` brand key

Search creators with a connected X account, by handle or name. Up to 50 results, largest audience first.

| Field | Type | Description |
| --- | --- | --- |
| q | string | Part of an X handle or name. |

Request

```
curl "https://transformer.gg/api/v1/creators?q=fitness" \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "creators": [
    {
      "workspaceId": "c41a9e2d-7b6f-4a1e-9c3d-5e8f7a6b2c10",
      "name": "Demo Creator",
      "x": "@demo_creator",
      "xName": "Demo Creator",
      "followers": 48210,
      "avatar": "https://pbs.twimg.com/…"
    }
  ]
}
```

POST `/api/v1/offers` brand key

Send a creator an offer. Returns `201`. Share `inviteUrl` with the creator if they're not on Transformer yet.

| Field | Type | Description |
| --- | --- | --- |
| creator | string | The creator's X handle ("@demo_creator"), an email address, or a creator workspace id. |
| title | string | Short name for the offer. |
| brief | string | Your note to the creator: what to say, what to avoid. |
| url | string | The page to promote. The tracked link redirects here. |
| deliverable | "post" \| "thread" \| "video" | What the creator publishes on X. |
| quantity | integer | How many deliverables, 1–20. Default 1. |
| payoutUsd | number | Fixed payout. The brand's saved card is charged when the creator accepts; it's held and released once the Transformer team confirms the post. |
| commissionPercent | number | Optional commission on reported sales, 0–50. Default 0. |
| expiresInDays | integer | Offer is good for (days): 3, 7, 10 or 14; default 7. |

Request

```
curl https://transformer.gg/api/v1/offers \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"creator":"@demo_creator","title":"Launch week","brief":"Share what you think of Acme","url":"https://acme.com/launch","deliverable":"post","quantity":1,"payoutUsd":250,"commissionPercent":10}'
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "sent",
    "paymentStatus": "unfunded",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "x": "@demo_creator",
      "email": null
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": null,
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": null,
    "verifiedAt": null,
    "createdAt": "2026-10-25T14:02:11Z"
  }
}
```

GET `/api/v1/offers?status=sent` brand or creator key

Offers this workspace sent (brand), or that were sent to this creator or its X handle, newest first.

| Field | Type | Description |
| --- | --- | --- |
| status | string | Optional filter: sent, accepted, submitted, verified, paid, declined, cancelled, expired, or all. |

Request

```
curl "https://transformer.gg/api/v1/offers?status=sent" \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "offers": [
    {
      "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
      "status": "sent",
      "paymentStatus": "unfunded",
      "title": "Launch week",
      "brief": "Share what you think of Acme",
      "url": "https://acme.com/launch",
      "deliverable": "post",
      "quantity": 1,
      "payoutUsd": 250,
      "commissionPercent": 10,
      "brand": {
        "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
        "name": "Acme"
      },
      "creator": {
        "x": "@demo_creator",
        "email": null
      },
      "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
      "trackedUrl": null,
      "landingUrl": "https://acme.com/x/demo_creator",
      "postLink": "https://acme.com/x/demo_creator",
      "mustInclude": [
        "https://acme.com/x/demo_creator",
        "X's Paid partnership label"
      ],
      "submissions": [],
      "expiresAt": "2026-11-08T14:02:11Z",
      "acceptedAt": null,
      "verifiedAt": null,
      "createdAt": "2026-10-25T14:02:11Z"
    }
  ]
}
```

GET `/api/v1/offers/{id}` brand or creator key

One offer, including its tracked link once accepted, its submissions and its stats.

Request

```
curl "https://transformer.gg/api/v1/offers/$OFFER_ID" \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "accepted",
    "paymentStatus": "unfunded",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "workspaceId": "c41a9e2d-7b6f-4a1e-9c3d-5e8f7a6b2c10",
      "name": "Demo Creator",
      "x": "@demo_creator"
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": "https://transformer.gg/r/k3v9x2",
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": "2026-10-25T15:40:03Z",
    "verifiedAt": null,
    "createdAt": "2026-10-25T14:02:11Z",
    "stats": {
      "clicks": 312,
      "conversions": 9,
      "revenueUsd": 441,
      "commissionUsd": 44.1,
      "verifiedPosts": 0
    }
  }
}
```

POST `/api/v1/offers/{id}/accept` creator key

Accept an offer that's still `sent`. The response includes `trackedUrl`, the link to put in your post. Connect X first; your account must match the handle the offer was sent to.

Request

```
curl -X POST https://transformer.gg/api/v1/offers/$OFFER_ID/accept \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "accepted",
    "paymentStatus": "unfunded",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "workspaceId": "c41a9e2d-7b6f-4a1e-9c3d-5e8f7a6b2c10",
      "name": "Demo Creator",
      "x": "@demo_creator"
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": "https://transformer.gg/r/k3v9x2",
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": "2026-10-25T15:40:03Z",
    "verifiedAt": null,
    "createdAt": "2026-10-25T14:02:11Z"
  }
}
```

POST `/api/v1/offers/{id}/decline` creator key

Decline an offer that's still `sent`.

Request

```
curl -X POST https://transformer.gg/api/v1/offers/$OFFER_ID/decline \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "declined",
    "paymentStatus": "unfunded",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "x": "@demo_creator",
      "email": null
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": null,
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": null,
    "verifiedAt": null,
    "createdAt": "2026-10-25T14:02:11Z"
  }
}
```

POST `/api/v1/offers/{id}/cancel` brand key

Cancel an offer that's `sent` or `accepted`.

Request

```
curl -X POST https://transformer.gg/api/v1/offers/$OFFER_ID/cancel \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "cancelled",
    "paymentStatus": "unfunded",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "x": "@demo_creator",
      "email": null
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": null,
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": null,
    "verifiedAt": null,
    "createdAt": "2026-10-25T14:02:11Z"
  }
}
```

POST `/api/v1/offers/{id}/submissions` creator key

Submit a post you published on X yourself (Transformer never posts for you), for the Transformer team's review (automated checks assist): it must be public, from the creator's own account, contain everything in the offer's `mustInclude` (its `postLink`), carry X's Paid partnership label, plus a video for `video` offers. The submission is `pending` until the team confirms it or sends it back with a reason (`rejected`; you can resubmit). A URL that isn't an X post returns `400`.

| Field | Type | Description |
| --- | --- | --- |
| url | string | The URL of a post on X from your connected account. |

Request

```
curl https://transformer.gg/api/v1/offers/$OFFER_ID/submissions \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://x.com/demo_creator/status/123"}'
```

Response

```
{
  "offer": {
    "id": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
    "status": "verified",
    "paymentStatus": "released",
    "title": "Launch week",
    "brief": "Share what you think of Acme",
    "url": "https://acme.com/launch",
    "deliverable": "post",
    "quantity": 1,
    "payoutUsd": 250,
    "commissionPercent": 10,
    "brand": {
      "workspaceId": "8d0e5b7a-1f2c-4d3e-8a9b-0c1d2e3f4a5b",
      "name": "Acme"
    },
    "creator": {
      "workspaceId": "c41a9e2d-7b6f-4a1e-9c3d-5e8f7a6b2c10",
      "name": "Demo Creator",
      "x": "@demo_creator"
    },
    "inviteUrl": "https://transformer.gg/claim/9QxW2mLr7Tq",
    "trackedUrl": "https://transformer.gg/r/k3v9x2",
    "landingUrl": "https://acme.com/x/demo_creator",
    "postLink": "https://acme.com/x/demo_creator",
    "mustInclude": [
      "https://acme.com/x/demo_creator",
      "X's Paid partnership label"
    ],
    "submissions": [
      {
        "id": "e19b3c7d-2a4f-4b8e-9d1c-6f0a5e2b7c84",
        "url": "https://x.com/demo_creator/status/123",
        "status": "verified",
        "note": "Confirmed by the Transformer team.",
        "createdAt": "2026-10-25T16:05:40Z",
        "verifiedAt": "2026-10-25T16:05:41Z"
      }
    ],
    "expiresAt": "2026-11-08T14:02:11Z",
    "acceptedAt": "2026-10-25T15:40:03Z",
    "verifiedAt": "2026-10-25T16:05:41Z",
    "createdAt": "2026-10-25T14:02:11Z"
  }
}
```

POST `/api/v1/visits` brand key

Record a visit to a brand's own per-creator landing page, server-side. It counts as a click on the offer. Returns `201` with a `clickId`: keep it in the visitor's session and send it to `POST /conversions` when they sign up or buy. `404` if there's no live offer to that handle. Repeat visits from the same visitor are deduplicated (`duplicate: true`).

| Field | Type | Description |
| --- | --- | --- |
| handle | string | The creator's X handle, e.g. from your /x/{handle} landing page (with or without @, any case). Uses your latest live offer to them. |
| offerId | string | Instead of handle, when you know the offer. |
| clickId | string | Optional. The tf_click query value if the visitor came through the tracked /r link: that click is reused, not counted twice. |
| url | string | Optional. The landing page URL. |
| ip | string | Optional. The visitor's IP, hashed for deduplication and never stored. |
| userAgent | string | Optional. Bots are not counted. |
| referrer | string | Optional. |

Request

```
curl https://transformer.gg/api/v1/visits \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"handle":"demo_creator","ip":"203.0.113.7","userAgent":"Mozilla/5.0 …","referrer":"https://t.co/abc"}'
```

Response

```
{
  "recorded": true,
  "duplicate": false,
  "clickId": "b2e7d4a1-5c3f-4e8a-9d61-7a0c2f9e8b14",
  "offerId": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90"
}
```

POST `/api/v1/conversions` brand key

Report a sale or signup (send `amountUsd: 0` for a signup) that came from a creator's link. Returns `201`; `duplicate` is true if that order was already reported. Call it from your backend; see conversion tracking.

| Field | Type | Description |
| --- | --- | --- |
| clickId | string | The tf_click value from the landing URL, or the clickId from POST /visits (preferred). |
| handle | string | The creator's X handle. Used when there's no clickId, or as a fallback if the clickId is unknown. Uses your latest live offer to them. |
| offerId | string | Instead of clickId, when the sale can't be tied to a click. |
| amountUsd | number | Order value the commission is calculated on. |
| orderId | string | Your order id. Reporting the same order twice is a no-op. |

Request

```
curl https://transformer.gg/api/v1/conversions \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clickId":"b2e7d4a1-5c3f-4e8a-9d61-7a0c2f9e8b14","amountUsd":49.00,"orderId":"A-1001"}'
```

Response

```
{
  "recorded": true,
  "duplicate": false,
  "offerId": "3f6c1a2e-8b1d-4c3e-9a57-2d0b6f1e4c90",
  "amountUsd": 49,
  "commissionUsd": 4.9,
  "stats": {
    "clicks": 312,
    "conversions": 9,
    "revenueUsd": 441,
    "commissionUsd": 44.1,
    "verifiedPosts": 1
  }
}
```

GET `/api/v1/offers/{id}/stats` brand or creator key

Clicks on the tracked link, reported conversions, revenue, commission and confirmed posts for an offer.

Request

```
curl "https://transformer.gg/api/v1/offers/$OFFER_ID/stats" \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

Response

```
{
  "stats": {
    "clicks": 312,
    "conversions": 9,
    "revenueUsd": 441,
    "commissionUsd": 44.1,
    "verifiedPosts": 1
  }
}
```
