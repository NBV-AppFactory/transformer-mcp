<p align="center">
  <img src="assets/icon.png" alt="Transformer" width="88">
</p>

# Transformer MCP server, CLI and docs

[Transformer](https://transformer.gg/?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme) is an influencer marketplace for paid partnerships on X (Twitter), built so AI agents can run it. Brands paste their website, get X creators matched to what they sell, and send offers. Creators accept, post in their own words with X's Paid partnership label on, and are paid once the post is confirmed. People can use the web dashboard, or an agent can do the same through this MCP server, the CLI or the REST API.

- **MCP server:** `https://transformer.gg/mcp` (streamable HTTP, OAuth 2.1 or a `tf_live_` workspace key)
- **Free, no key:** `get_influencer_value {handle}` at `https://transformer.gg/mcp/public` gives any X account's [influencer value](https://transformer.gg/value?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme), our estimate of what one sponsored post on that account is worth
- **MCP Registry name:** `gg.transformer/transformer` ([server.json](server.json))
- **Pricing:** no subscription. Brands set the price of each offer, creators keep 80% and Transformer keeps 20% ([pricing](https://transformer.gg/pricing?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme))

## Connect an agent

**Claude Code**

```bash
claude mcp add --transport http transformer https://transformer.gg/mcp
```

**Claude, ChatGPT, VS Code:** add a remote (custom) MCP server with the URL `https://transformer.gg/mcp`, then sign in with X and pick the workspace the agent acts for.

**Cursor:** [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=transformer&config=eyJ1cmwiOiJodHRwczovL3RyYW5zZm9ybWVyLmdnL21jcCJ9), or add it to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "transformer": { "url": "https://transformer.gg/mcp" }
  }
}
```

**Headless agents:** create a workspace key in [Settings → Agents](https://transformer.gg/settings/agents?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme) and send it as `Authorization: Bearer tf_live_…`. Each key or connection acts for one brand or creator workspace.

**Try it with no account:**

```json
{
  "mcpServers": {
    "transformer-public": { "url": "https://transformer.gg/mcp/public" }
  }
}
```

## CLI

```bash
curl -fsSL https://transformer.gg/install | sh
transformer login
```

Source: [cli/transformer.mjs](cli/transformer.mjs). It needs Node.js 18 or newer.

## Agent skills

The [skills](skills/) folder holds `transformer-brand`, `transformer-creator` and `transformer`, which works out whether you're a brand or a creator. Install them with `npx skills add transformer-gg/skills`. They never send an offer, accept one or move money unless you say yes in the chat.

## Docs

| Doc | What's in it |
| --- | --- |
| [Quickstart](docs/quickstart.md) | Account, workspace, API key, connecting an agent |
| [Concepts](docs/concepts.md) | Workspaces, the offer lifecycle, deliverables, tracked links, conversions, payments |
| [MCP server and CLI](docs/mcp.md) | Tools for finding creators, sending and accepting offers, submitting posts and reporting sales |
| [REST reference](docs/rest.md) | Endpoints under `/api/v1` |
| [Conversion tracking](docs/tracking.md) | `tf_click`, server-side conversions, landing pages, pixel |
| [Pricing](docs/pricing.md) | The 80/20 split and pricing FAQ |
| [llms.txt](llms.txt) | A summary of the whole product for LLMs |

The live docs are at [transformer.gg/docs](https://transformer.gg/docs?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme). If the two ever differ, the live docs are correct.

## Learn more

- [Influencer values by creator](https://transformer.gg/value/creators?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme)
- [Sponsored posts on X: the 2026 data from 309,000 accounts](https://transformer.gg/blog/sponsored-posts-on-x-2026-data?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme)
- [How does a creator marketplace work?](https://transformer.gg/blog/how-does-a-creator-marketplace-work?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme)
- [Blog](https://transformer.gg/blog?utm_source=github&utm_medium=referral&utm_campaign=public_repo&utm_content=readme)

---

Transformer is run by North Bay Opco I, Inc., a North Bay Ventures company. Questions go to support@transformer.gg. This repository is a published copy, and the product code lives elsewhere. Please report problems in [Issues](../../issues).
