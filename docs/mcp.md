## MCP

Transformer runs an MCP server at `https://transformer.gg/mcp` over streamable HTTP, authenticated with the same API key. Add it to any MCP client:

[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=transformer&config=eyJ1cmwiOiJodHRwczovL3RyYW5zZm9ybWVyLmdnL21jcCJ9) Opens Cursor with Transformer's MCP server filled in.

### Connect from Claude, ChatGPT or VS Code

Add a remote (custom) MCP server with the URL `https://transformer.gg/mcp`. In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Apps & Connectors → Create (developer mode). In VS Code: MCP: Add Server → HTTP.

Sign-in is OAuth: the first time, your client opens Transformer in the browser. Sign in, choose the brand or creator profile it may act for, and approve. No key to copy; disconnect it any time in Settings → Agents. Clients without OAuth use an API key as a bearer token, as in the config below.

mcp.json

```
{
  "mcpServers": {
    "transformer": {
      "url": "https://transformer.gg/mcp",
      "headers": { "Authorization": "Bearer tf_live_…" }
    }
  }
}
```

Claude Code:

shell

```
claude mcp add --transport http transformer https://transformer.gg/mcp --header "Authorization: Bearer $TRANSFORMER_API_KEY"
```

### Tools

| Tool | Key | What it does |
| --- | --- | --- |
| whoami | either | The brand or creator profile this key acts for. |
| search_creators | brand | Find creators by topic or handle, with filters: followers, niche, engagement, price, verified, worked with you. |
| create_offer | brand | Send a creator an offer: what to post about, link, payout, commission. |
| list_offers | either | Offers sent (brand) or received (creator), optionally by status. |
| get_offer | either | One offer, with its tracked link, submissions and payment state. |
| accept_offer | creator | Accept an offer and get its tracked link. |
| decline_offer | creator | Decline an offer. |
| cancel_offer | brand | Cancel an offer that hasn't been completed. |
| submit_post | creator | Submit an existing X or LinkedIn post URL for the Transformer team's check. |
| report_conversion | brand | Report a sale with the tf_click id (or an offerId). The same orderId twice is ignored. |
| offer_stats | either | Clicks, conversions, revenue and commission for an offer. |
| pay_offers | brand | Pay for accepted offers whose card charge didn't go through: balance first, then a checkout link. |
| list_deals | creator | Accepted offers with their next step (post, submit, confirmed, paid) and due date. |
| submit_deal_post | creator | Submit the post URL for a deal, for the Transformer team's review. |
| list_accounts | creator | Your connected social accounts, with pending verifications. |
| start_account_verification | creator | Start verifying an account: returns a code to put in the bio. |
| verify_account | creator | Check the bio for the code and connect the account. |

Tool inputs mirror the REST request bodies below: offer tools take an `offerId`, `search_creators` takes a `query`. Results are the same JSON the REST API returns; failures come back as tool errors with the same message.

## CLI

Install the `transformer` binary, then sign in with an API key:

$ curl -fsSL https://transformer.gg/install | sh

commands

```
transformer login                 # paste an account API key
transformer me
transformer creators search fitness
transformer offers create --creator @demo_creator --deliverable post --payout 250 --url https://acme.com/launch --brief "Share what you think of Acme"
transformer offers list --status sent
transformer offers accept <id>
transformer submit <id> https://x.com/demo_creator/status/123
transformer conversions report --click <tf_click> --amount 49 --order A-1001
transformer stats <id>
```

`transformer login` stores the key locally. In CI or agent sandboxes, set `TRANSFORMER_API_KEY` instead. Every command calls the REST endpoint of the same name.
