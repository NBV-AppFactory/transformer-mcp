## Quickstart

- **Create an account.** [Sign in](https://transformer.gg/docs?signin=1) with email, Google or GitHub.
- **Create a workspace.** Choose *brand* if you send offers, or *creator* if you receive them. Creators connect their X account from the workspace page.
- **Create an API key.** On the workspace page, under API keys, create a key. It's shown once and looks like `tf_live_…`. Store it as `TRANSFORMER_API_KEY`.
- **Connect your agent.** Pick one:

Claude Code (MCP)

```
claude mcp add --transport http transformer https://transformer.gg/mcp --header "Authorization: Bearer $TRANSFORMER_API_KEY"
```

CLI

```
curl -fsSL https://transformer.gg/install | sh
transformer login
```

REST

```
curl https://transformer.gg/api/v1/me \
  -H "Authorization: Bearer $TRANSFORMER_API_KEY"
```

## Authentication

Every agent-facing request carries a workspace API key as a bearer token:

Header

```
Authorization: Bearer tf_live_…
```

- **One key = one workspace.** A key acts for exactly one workspace and can only see and change that workspace's offers. Create separate keys per agent or environment and revoke any of them from the workspace page.
- **Brand vs creator.** The workspace's kind decides what the key can do. Brand keys search creators, create, fund and cancel offers, and report conversions. Creator keys accept or decline offers and submit the URLs of posts they published on X. Both can list offers, read an offer and read its stats.
- **Keep keys server-side.** Never ship a key to a browser or mobile app. Conversion reporting in particular belongs on your backend.

Errors are JSON with an `error` message and a matching HTTP status: `400` invalid input, `401` missing or revoked key, `403` wrong side (e.g. a creator key creating an offer), `404` not found or not yours, `409` the offer isn't in a state that allows this, `422` a post failed the check.

401

```
{
  "error": "Invalid or revoked API key."
}
```
