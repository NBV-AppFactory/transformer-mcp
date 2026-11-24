#!/usr/bin/env node
// transformer: the CLI for Transformer (https://transformer.gg). Every command is one REST call; needs Node 18+.
// Key: TRANSFORMER_API_KEY, or `transformer login` (stored in ~/.config/transformer/config.json).
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const CONFIG = join(homedir(), ".config", "transformer", "config.json");
const cfg = (() => { try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; } })();
const BASE = (process.env.TRANSFORMER_URL || cfg.baseUrl || "https://transformer.gg").replace(/\/$/, "");
const KEY = process.env.TRANSFORMER_API_KEY || cfg.apiKey;

const [cmd, ...rest] = process.argv.slice(2);
const BOOL_FLAGS = new Set([
  "json", "open", "acknowledge-binding", "accept-usual-price", "allow-ai",
  "approve", "added", "worked-with-us", "unclaimed", "pending", "confirm-not-ready", "preview",
]);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    if (BOOL_FLAGS.has(k)) {
      flags[k] = rest[i + 1] === "true" || rest[i + 1] === "false" ? rest[++i] : "true";
    } else {
      flags[k] = rest[i + 1] !== undefined && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
    }
  } else args.push(rest[i]);
}
const flagOn = (k) => k in flags && flags[k] !== "false";
const json = flagOn("json");

async function call(method, path, body) {
  if (!KEY) die(`No API key. Run: transformer login   (create a key on a workspace page at ${BASE}/dashboard)`);
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method, headers: { Authorization: `Bearer ${KEY}`, ...(body && { "Content-Type": "application/json" }) }, body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(data.error || `HTTP ${res.status}`);
  return data;
}
function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }
const usd = (n) => `$${Number(n).toFixed(n % 1 ? 2 : 0)}`;
const out = (data, pretty) => (json ? console.log(JSON.stringify(data, null, 2)) : pretty(data));
const creatorOf = (o) => {
  if (o.network === "linkedin") {
    const liSocial = (o.creator?.socials ?? []).find((s) => s.provider === "linkedin")?.handle;
    const liSlug = o.creator?.linkedin || liSocial;
    if (liSlug) return `in/${String(liSlug).replace(/^\/?in\//i, "").replace(/\/+$/, "")}`;
    if (o.creator?.name) return o.creator.name;
  }
  return o.creator?.x || (o.creator?.linkedin ? `in/${o.creator.linkedin}` : null) || o.creator?.name || o.creator?.email || o.brand?.name || "";
};
const offerLine = (o) => `${o.id}  ${o.status.padEnd(9)} ${usd(o.payoutUsd).padStart(7)}  ${(o.network && o.network !== "x" ? `${o.network}:${o.deliverable}` : o.deliverable).padEnd(13)} ${creatorOf(o).padEnd(20)} ${o.title}`;
const offerCard = ({ offer: o }) => {
  console.log(`✓ ${o.title}  [${o.status}]  ${usd(o.payoutUsd)}${o.commissionPercent ? ` + ${o.commissionPercent}% of sales` : ""}`);
  if (o.network && o.network !== "x") console.log(`  network     ${o.network}`);
  if (o.creatorEarnsUsd != null) console.log(`  creator     earns ${usd(o.creatorEarnsUsd)}${o.creatorCommissionPercent ? ` + ${o.creatorCommissionPercent}% of sales` : ""} (platform fee ${o.platformFeePercent}%)`);
  console.log(`  id          ${o.id}`);
  if (o.trackedUrl) console.log(`  tracked     ${o.trackedUrl}`);
  console.log(`  invite      ${o.inviteUrl}`);
  for (const s of o.submissions || []) console.log(`  post        ${s.url}  ${s.status}${s.note ? ` (${s.note})` : ""}`);
  if (o.payment && o.payment.state !== "unfunded") console.log(`  payment     ${o.payment.state}${o.payment.dispute?.status === "open" ? " (dispute open)" : ""}${o.payment.timeline?.length ? `  ${o.payment.timeline.map((t) => `${t.event} ${String(t.at).slice(0, 10)}`).join(" → ")}` : ""}`);
  if (o.stats) console.log(`  stats       ${o.stats.clicks} clicks · ${o.stats.conversions} sales · ${usd(o.stats.revenueUsd)} revenue`);
};

const balanceLine = (d) => {
  console.log(`available ${usd(d.availableUsd)} · requested ${usd(d.requestedUsd)} · paid ${usd(d.paidUsd)} (this year ${usd(d.paidThisYearUsd)}) · pending ${usd(d.pendingUsd)}`);
  if (d.taxFormRequired) console.log(`  a tax form is needed before payouts reach $${d.thresholdUsd} this year: transformer tax-form submit --file form.json`);
};
const rate = (n) => (n.engagement?.engagementRatePercent != null ? `${n.engagement.engagementRatePercent}% eng` : "");
const networkCard = (n) => {
  const e = n.engagement ?? {};
  console.log(`${n.provider.toUpperCase()} ${n.handle}${n.verified ? " ✓" : ""}${n.status !== "connected" ? ` (${n.status}: reconnect)` : ""}  ${n.profileUrl ?? ""}`);
  console.log(`  ${n.followers ?? "?"} followers · ${n.following ?? "?"} following · ${n.posts ?? "?"} posts`);
  if (e.sampleSize) console.log(`  last ${e.sampleSize} posts: avg ${e.avgViews ?? "?"} views · ${e.avgLikes ?? "?"} likes · ${e.avgComments ?? "?"} replies · ${e.avgShares ?? "?"} reposts · ${rate(n) || "n/a"}`);
  for (const p of n.recent ?? []) console.log(`  · ${String(p.views ?? "?").padStart(7)} views ${String(p.likes ?? "?").padStart(5)} likes  ${(p.text ?? "").replace(/\s+/g, " ").slice(0, 60)}`);
  console.log(`  synced ${n.lastSyncedAt ?? "never"}`);
};

const commands = {
  async login() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const key = (flags.key || (await rl.question(`API key from ${BASE}/dashboard (workspace page → Agent API keys): `))).trim();
    rl.close();
    const res = await fetch(`${BASE}/api/v1/me`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) die("That key didn't work.");
    const me = await res.json();
    mkdirSync(join(homedir(), ".config", "transformer"), { recursive: true });
    writeFileSync(CONFIG, JSON.stringify({ apiKey: key, baseUrl: BASE }, null, 2));
    chmodSync(CONFIG, 0o600);
    console.log(`✓ signed in as ${me.workspace.kind} workspace "${me.workspace.name}"`);
  },
  async me() {
    out(await call("GET", "/me"), (d) => {
      console.log(`${d.workspace.name} (${d.workspace.kind})${(d.socials ?? []).map((n) => ` · ${n.provider.toUpperCase()} ${n.handle} (${n.followers ?? "?"} followers)`).join("")}`);
      const s = d.stats;
      console.log(`${s.offers} offers · ${s.active} active · ${s.completed} completed · ${s.clicks} clicks · ${usd(s.revenueUsd)} tracked sales`);
    });
  },
  // transformer creators [search] [query] [--min-followers 10000] [--niche ai] [--max-price 300] [--sort followers] …
  // Suggested creators from your brand profile (no brief): transformer suggestions [--budget 300] [--size micro|mid|large] [--added] [--page 2]
  async suggestions() {
    const params = new URLSearchParams();
    for (const k of ["budget", "size", "page"]) if (flags[k]) params.set(k, flags[k]);
    if (flagOn("added")) params.set("added", "1");
    return out(await call("GET", `/suggestions${params.size ? `?${params}` : ""}`), (d) => {
      if (!d.items.length) return console.log(d.note ?? "No suggestions yet.");
      for (const s of d.items) console.log(`@${s.xHandle.padEnd(18)} ${String(s.followers ?? "?").padStart(8)} followers  ${s.price.postUsd != null ? `$${s.price.lowUsd}–$${s.price.highUsd}` : "custom"}  ${s.why}${s.onTransformer ? "" : "  (not on Transformer yet)"}  ${s.profileId}`);
      if (d.more) console.log(`More: --page ${d.page + 1}`);
    });
  },
  // Suggested X posts in each creator's voice: transformer posts --creator <profileId|@handle> [--creator …] [--url https://…] [--previous "…"]
  async posts() {
    const pick = (k) => process.argv.slice(2).flatMap((v, i, a) => (v === `--${k}` && a[i + 1] ? [a[i + 1]] : []));
    const creators = pick("creator");
    if (!creators.length) die('usage: transformer posts --creator <profileId|@handle> [--creator …] [--url https://…] [--previous "<earlier draft>"]');
    const items = creators.map((c) => (/^[0-9a-f-]{36}$/i.test(c) ? { profileId: c } : { creator: c }));
    return out(await call("POST", "/post-drafts", { items, ...(flags.url ? { url: flags.url } : {}), ...(flags.previous ? { previous: flags.previous } : {}) }), (d) => {
      d.drafts.forEach((x, i) => console.log(`${creators[i]}:\n${x.text}\n`));
      console.log(`cost $${d.costUsd}`);
    });
  },
  // Add creators by handle (we look them up on X and index them; contacts nobody): transformer add @a @b x.com/c  ·  transformer added [--status ready]
  async add() {
    if (!args.length) die("usage: transformer add @handle [@handle… | x.com/handle…]   (brand; up to 50 at a time)");
    return out(await call("POST", "/creators/add", { handles: args }), (d) => {
      for (const a of d.added) console.log(`${a.handle.padEnd(20)} ${a.status}${a.detail ? `  ${a.detail}` : ""}`);
      if (d.invalid.length) console.log(`Couldn't read: ${d.invalid.join(", ")}`);
      if (d.lookups) console.log(`Looking up ${d.lookups} on X; check with: transformer added`);
    });
  },
  async added() {
    return out(await call("GET", `/creators/added${flags.status ? `?status=${flags.status}` : ""}`), (d) => {
      if (!d.added.length) return console.log("No creators added yet. Add some: transformer add @handle");
      for (const a of d.added) console.log(`${a.handle.padEnd(20)} ${a.status.padEnd(12)} ${a.profileId ?? ""}${a.detail ? `  ${a.detail}` : ""}`);
    });
  },
  async creators() {
    const q = args[0] === "search" ? args.slice(1).join(" ") : args.join(" ");
    const keys = ["network", "min-rating", "topics", "brand-fit", "tone", "min-followers", "max-followers", "niche", "min-engagement", "max-price", "country", "language", "metro", "active-days", "sponsors", "sort", "page", "limit"];
    const params = new URLSearchParams(q ? { q } : {});
    for (const k of keys) if (flags[k]) params.set(k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), flags[k]);
    for (const k of ["worked-with-us", "unclaimed"]) if (flagOn(k)) params.set(k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), "1");
    out(await call("GET", `/creators/search?${params}`), (d) => {
      for (const c of d.results) {
        const nets = c.networks.map((n) => `${n.network}:@${n.handle} ${n.followers ?? "?"}`).join("  ");
        const price = c.rates?.post != null ? `$${c.rates.post}/post` : "";
        console.log(`${c.kind === "unclaimed" ? "[invite only] " : ""}${c.name}  ${nets}  ${c.engagementRate != null ? `${c.engagementRate}% eng` : ""}  ${price}${c.workedWithUs ? "  (worked with you)" : ""}`);
      }
      console.log(d.results.length ? `${d.total} creators · page ${d.page}` : "No creators found.");
    });
  },
  // Creator: connected accounts (X for now; the server lists only enabled networks).
  async accounts() {
    const sub = args[0] || "list";
    if (sub === "list")
      return out(await call("GET", "/accounts"), (d) => {
        for (const n of d.networks) {
          console.log(`${n.label} (${n.methods.join(", ")})`);
          for (const a of n.accounts) console.log(`  ${a.primary ? "★" : " "} @${a.handle}  ${a.followers ?? "?"} followers  ${a.verificationMethod}  since ${String(a.connectedAt).slice(0, 10)}  earned $${a.earnedUsd}  ${a.id}`);
          for (const v of n.claims) console.log(`  … @${v.handle} ${v.status}: put ${v.code} in your bio, then: transformer accounts verify ${n.network} ${v.id}`);
          if (!n.accounts.length && !n.claims.length) console.log("  none");
        }
      });
    if (sub === "add") {
      if (!args[1] || !args[2]) die("usage: transformer accounts add x <handle>");
      return out(await call("POST", `/accounts/${args[1]}/claims`, { handle: args[2] }), ({ claim: v }) => {
        console.log(v.instructions);
        console.log(`Then: transformer accounts verify ${v.network} ${v.id}`);
      });
    }
    if (sub === "verify") {
      if (!args[1] || !args[2]) die("usage: transformer accounts verify <network> <verification-id>");
      return out(await call("POST", `/accounts/${args[1]}/claims/${args[2]}/verify`), (d) =>
        console.log(d.verified ? `✓ verified @${d.account?.handle}. You can remove ${d.claim.code} from your bio now.` : `… waiting for a manual check by Transformer (${d.claim.status}).`));
    }
    if (sub === "primary") return out(await call("POST", `/accounts/${args[1] || die("usage: transformer accounts primary <account-id>")}/primary`), (d) => console.log(`✓ @${d.account.handle} is now primary`));
    if (sub === "remove") return out(await call("DELETE", `/accounts/${args[1] || die("usage: transformer accounts remove <account-id>")}`), () => console.log("✓ removed"));
    if (sub === "check-post") return out(await call("POST", "/accounts/check-post", { url: args[1] || die("usage: transformer accounts check-post <url>") }), (d) =>
      console.log(d.ok ? `✓ ${d.network} post by @${d.account.handle}: ${d.post?.views ?? "?"} views, ${d.post?.likes ?? "?"} likes` : `✗ ${d.reason}`));
    die("usage: transformer accounts list | add <network> <handle> | verify <network> <id> | primary <id> | remove <id> | check-post <url>   (creator)");
  },
  async creator() {
    if (!args[0]) die("usage: transformer creator <creator-workspace-id>");
    out(await call("GET", `/creators/${args[0]}`), ({ creator: c }) => {
      console.log(c.name);
      for (const n of c.socials) networkCard(n);
    });
  },
  async social() {
    const sub = args[0] || "show";
    if (sub === "show") return out(await call("GET", "/social"), (d) => (d.accounts.length ? d.accounts.forEach(networkCard) : console.log("No networks connected. Connect X from the dashboard.")));
    if (sub === "sync") return out(await call("POST", `/social/${args[1] || "x"}/sync`), (d) => { console.log(d.synced ? "✓ synced" : "= synced in the last 10 minutes; showing stored data"); networkCard(d.account); });
    die("usage: transformer social show|sync");
  },
  async profile() {
    const sub = args[0] || "show";
    const show = ({ profile: p }) => {
      console.log(`${p.visibility === "listed" ? "● listed" : "○ hidden"}  @${p.x.handle}  ${p.publicUrl}`);
      if (p.headline) console.log(p.headline);
      if (p.niches.length) console.log(`niches: ${p.niches.join(", ")}`);
      console.log(`rates: ${["post", "thread", "video"].map((k) => `${k} ${p.rates[k] == null ? "-" : usd(p.rates[k])}`).join(" · ")}${p.openToOffers ? "" : "  (not open to offers)"}`);
    };
    if (sub === "show") return out(await call("GET", "/profile"), show);
    if (sub === "list" || sub === "hide") return out(await call("PATCH", "/profile", { visibility: sub === "list" ? "listed" : "hidden" }), show);
    if (sub === "set") {
      const rates = Object.fromEntries(["post", "thread", "video"].filter((k) => flags[k] !== undefined).map((k) => [k, flags[k] === "none" ? null : Number(flags[k])]));
      const body = {
        headline: flags.headline, bio: flags.bio, audience: flags.audience, niches: flags.niches && String(flags.niches).split(",").map((s) => s.trim()).filter(Boolean),
        rates: Object.keys(rates).length ? rates : undefined, openToOffers: flags.open === undefined ? undefined : flags.open !== "false",
      };
      return out(await call("PATCH", "/profile", body), show);
    }
    if (sub === "remove") return out(await call("POST", "/profile/remove"), () => console.log("✓ removed from the directory (transformer profile list brings it back)"));
    if (sub === "audience") {
      // The audience profile built from your X posts: show | set <field> <json|text> | remove|reset <field> | hide | unhide | reviewed | rebuild
      const [, act = "show", field, ...val] = args;
      const card = (d) => {
        const p = d.profile ?? {};
        console.log(`${d.status}${d.hidden ? " · hidden from brands" : ""}${d.reviewed ? " · reviewed" : ""}${d.builtAt ? ` · built ${String(d.builtAt).slice(0, 10)} from ${d.source.posts} posts` : ""}`);
        if (p.summary) console.log(p.summary);
        if (p.topics?.length) console.log(`topics: ${p.topics.map((t) => `${t.key} ${t.weight}`).join(", ")}`);
        for (const k of ["interests", "themes", "tone", "brandFit"]) if (p[k]?.length) console.log(`${k}: ${p[k].join(", ")}`);
        if (p.engagement) console.log(`engagement: ${p.engagement.ratePercent ?? "?"}% · ${p.cadence?.postsPerWeek ?? "?"} posts/week · best hours (UTC) ${p.cadence?.bestHoursUtc?.join(", ") ?? "-"}`);
        if (p.partnerships?.length) console.log(`past partnerships: ${p.partnerships.map((x) => x.handle).join(", ")}`);
        if (p.rate) console.log(`suggested rate: ${p.rate.postUsd != null ? `${usd(p.rate.postUsd)} per post (estimate)` : "priced individually"}\n  ${p.rate.method}`);
        console.log(d.note);
      };
      if (act === "show") return out(await call("GET", "/profile/audience"), card);
      if (act === "rebuild") return out(await call("POST", "/profile/audience/rebuild"), () => console.log("✓ rebuilding from your latest X posts (about a minute); your edits are kept"));
      const parse = (v) => { try { return JSON.parse(v); } catch { return v; } };
      const body = act === "set" && field ? { set: { [field]: parse(val.join(" ")) } } : (act === "remove" || act === "reset") && field ? { [act]: [field] }
        : act === "hide" || act === "unhide" ? { hidden: act === "hide" } : act === "reviewed" ? { reviewed: true } : null;
      if (body) return out(await call("PATCH", "/profile/audience", body), card);
    }
    die("usage: transformer profile show|list|hide|remove | set [--headline …] [--niches ai,devtools] [--post 250] [--thread none] [--open false]\n       transformer profile audience [show|set <field> <value>|remove <field>|reset <field>|hide|unhide|reviewed|rebuild]");
  },
  // Send offers (pay on accept): transformer offer --url https://… --creator <profileId|@handle> --price 125 --ask "…" [--creator … --price … --ask …] [--days 7]
  async offer() {
    const pick = (k) => process.argv.slice(2).flatMap((v, i, a) => (v === `--${k}` && a[i + 1] ? [a[i + 1]] : []));
    const creators = pick("creator"), prices = pick("price"), asks = pick("ask"), posts = pick("post");
    if (!flags.url || !creators.length || creators.length !== prices.length || creators.length !== asks.length) die('usage: transformer offer --url https://… --creator <profileId|@handle> --price 125 --ask "…" (repeat --creator/--price/--ask for each creator) [--days 7]');
    const items = creators.map((c, i) => ({ ...(/^[0-9a-f-]{36}$/i.test(c) ? { profileId: c } : { creator: c }), priceUsd: Number(prices[i]), ask: asks[i], ...(posts[i] ? { post: posts[i] } : {}), ...(flags.days ? { expiresInDays: Number(flags.days) } : {}) }));
    return out(await call("POST", "/offers/batch", { url: flags.url, items }), (d) => {
      console.log(`✓ ${d.offerIds.length} offer${d.offerIds.length === 1 ? "" : "s"} sent · $${d.totalUsd} if all accept · nothing charged now`);
      console.log(d.message);
      console.log("  → when a creator accepts, pay within 72 hours: transformer pay [offer-id…]");
    });
  },
  async offers() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", `/offers${flags.status ? `?status=${flags.status}` : ""}`), (d) => (d.offers.length ? d.offers.forEach((o) => console.log(offerLine(o))) : console.log("No offers.")));
    // transformer offers status: each offer's stage (awaiting_payment → sent → accepted → posted → verified → paid, or declined / expired / refunded_to_balance)
    if (sub === "status") return out(await call("GET", "/offers"), (d) => (d.offers.length ? d.offers.forEach((o) => console.log(`${o.id}  ${(o.stage ?? o.status).padEnd(19)} ${usd(o.payoutUsd).padStart(7)}  ${creatorOf(o).padEnd(20)} ${o.title}`)) : console.log("No offers.")));
    if (sub === "create") {
      // Fields left out come from --template (if given) or the server defaults.
      const net = flags.network ? String(flags.network).toLowerCase() : undefined;
      if (net && !["x", "linkedin"].includes(net)) die("--network must be x or linkedin");
      const inferredNet = net ?? (flags.creator && (/linkedin\.com\/in\//i.test(flags.creator) || /^\/?in\//i.test(flags.creator)) ? "linkedin" : undefined);
      const acceptUsual = flagOn("accept-usual-price");
      const fields = {
        templateId: flags.template, title: flags.title, brief: flags.brief, url: flags.url, deliverable: flags.deliverable,
        quantity: flags.quantity && Number(flags.quantity), payoutUsd: flags.payout && Number(flags.payout), commissionPercent: flags.commission && Number(flags.commission),
        ...(inferredNet ? { network: inferredNet } : {}),
        ...(flags.days ? { expiresInDays: Number(flags.days) } : {}),
        ...(flags.email ? { email: flags.email } : {}),
        ...("acknowledge-binding" in flags && { acknowledgeBinding: flagOn("acknowledge-binding") }),
        ...(acceptUsual ? { acceptUsualPrice: true } : {}),
        ...(flags["expected-price"] ? { expectedPriceUsd: Number(flags["expected-price"]) } : {}),
        ...("allow-ai" in flags && { allowAi: flagOn("allow-ai") }),
      };
      if (!flags.template) {
        if (!flags.url) die("--url is required (or use --template <id>)");
        if (!flags.payout && !acceptUsual) die("--payout is required (or use --template <id> or --accept-usual-price)");
        fields.title ??= "Sponsored post";
      }
      // Many creators: --creators @a,@b,@c or --csv file (first column = handle/email; a "creator" header row is skipped).
      if (flags.creators || flags.csv) {
        if (inferredNet === "linkedin") die("--creators / --csv bulk offers are X-only; use `transformer launch create --creators ...` for multi-creator LinkedIn offers");
        if (!flags.template && !flags.payout) die("--payout is required for bulk --creators / --csv offers (or use --template <id>)");
        let list = flags.creators ? String(flags.creators).split(/[\s,;]+/) : [];
        if (flags.csv) {
          const { readFileSync } = await import("node:fs");
          list = list.concat(readFileSync(flags.csv, "utf8").split(/\r?\n/).map((l) => l.split(",")[0].trim().replace(/^"|"$/g, "")).filter((c) => c && !/^(creator|handle|x|email)$/i.test(c)));
        }
        return out(await call("POST", "/offers/bulk", { ...fields, creators: list.filter(Boolean), label: flags.label }), (d) => {
          console.log(`✓ batch "${d.batch.label}" (${d.batch.id}): ${d.created} created, ${d.existing} already had an offer, ${d.failed} failed`);
          for (const r of d.results) console.log(r.ok ? `  ${r.creator.padEnd(24)} ${r.inviteUrl}${r.existing ? "  (existing)" : ""}` : `  ${r.creator.padEnd(24)} ✗ ${r.error}`);
        });
      }
      if (!flags.creator) die("--creator @handle (or LinkedIn URL with --network linkedin, or --creators @a,@b / --csv file) is required");
      const creatorVal = inferredNet === "linkedin" ? String(flags.creator).replace(/^\/?in\//i, "").replace(/\/+$/, "") : flags.creator;
      return out(await call("POST", "/offers", { ...fields, creator: creatorVal }),
        (d) => {
          offerCard(d);
          console.log("  → you pay only when the creator accepts; share the invite link with the creator, or they'll see it in Transformer");
        });
    }
    if (sub === "show") return out(await call("GET", `/offers/${args[1]}`), offerCard);
    if (["accept", "decline", "cancel"].includes(sub)) return out(await call("POST", `/offers/${args[1]}/${sub}`), offerCard);
    if (sub === "approve-early" && args[1]) return out(await call("POST", `/offers/${args[1]}/approve-early`), offerCard);
    if (sub === "dispute" && args[1]) {
      if (!flags.reason || !flags.details) die("usage: transformer offers dispute <id> --reason not_posted|post_issue|cancel_request|other --details \"…\"");
      return out(await call("POST", `/offers/${args[1]}/disputes`, { reason: flags.reason, details: flags.details }), (d) =>
        console.log(`✓ dispute ${d.dispute.id} opened; the held payment is frozen until an admin resolves it`));
    }
    die("usage: transformer offers list|create|show|accept|decline|cancel|approve-early|dispute");
  },
  async reviews() {
    const sub = args[0] || "pending";
    const starLine = (r) => `${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}  ${r.reviewer?.name ?? ""}${r.revealed ? "" : "  (not public yet)"}${r.hidden ? "  [hidden]" : ""}  ${r.id}${r.text ? `\n    ${r.text}` : ""}${r.reply ? `\n    ↳ ${r.reply.text}` : ""}`;
    const ratingLine = (r) => (r?.count ? `${r.avgStars}★ from ${r.count} review${r.count === 1 ? "" : "s"}, ${r.positivePct}% positive` : "no reviews yet");
    if (sub === "pending") return out(await call("GET", "/reviews/pending"), (d) =>
      d.pending.length ? d.pending.forEach((p) => console.log(`${p.offerId}  ${p.counterpart?.name ?? ""}: ${p.title}  (closes ${String(p.windowClosesAt).slice(0, 10)})`)) : console.log("No deals waiting for your review."));
    if (sub === "show" && args[1]) return out(await call("GET", `/offers/${args[1]}/reviews`), (d) => {
      d.reviews.forEach((r) => console.log(starLine(r)));
      if (d.canReview) console.log(`→ transformer reviews leave ${args[1]} --stars 5 [--text "…"]   sub-ratings: ${d.subRatings.join(", ")}`);
    });
    if ((sub === "leave" || sub === "edit") && args[1]) {
      const ratings = flags.ratings ? Object.fromEntries(String(flags.ratings).split(",").map((kv) => { const [k, v] = kv.split("="); return [k.trim(), Number(v)]; })) : undefined;
      const body = { stars: flags.stars ? Number(flags.stars) : undefined, text: flags.text, ratings };
      if (sub === "leave" && !body.stars) die("--stars 1-5 is required");
      return out(await call(sub === "leave" ? "POST" : "PATCH", `/offers/${args[1]}/review`, body), (d) => console.log(`✓ ${starLine(d.review)}`));
    }
    if (sub === "reply" && args[1] && flags.text) return out(await call("POST", `/reviews/${args[1]}/reply`, { text: flags.text }), () => console.log("✓ replied"));
    if (sub === "report" && args[1] && flags.reason) return out(await call("POST", `/reviews/${args[1]}/report`, { reason: flags.reason }), () => console.log("✓ reported to the moderators"));
    if (sub === "list" && args[1]) return out(await call("GET", `/workspaces/${args[1]}/reviews?${new URLSearchParams({ ...(flags.stars && { stars: flags.stars }), ...(flags.page && { page: flags.page }) })}`), (d) => {
      console.log(ratingLine(d.rating));
      d.reviews.forEach((r) => console.log(starLine(r)));
    });
    die("usage: transformer reviews pending | show <offerId> | leave <offerId> --stars 5 [--text …] [--ratings communication=5,on_time=4] | reply <reviewId> --text … | report <reviewId> --reason … | list <workspaceId> [--stars 5] [--page 2]");
  },
  async disputes() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", `/admin/disputes?status=${flags.status || "open"}`), (d) =>
      d.disputes.length ? d.disputes.forEach((x) => console.log(`${x.id}  ${x.status.padEnd(8)} ${x.reason.padEnd(14)} by ${x.openedBy}  ${usd(x.offer.amountUsd)}  ${x.brand} → ${x.creator ?? ""}: ${x.offer.title}`)) : console.log("No disputes."));
    if (sub === "resolve" && args[1] && flags.outcome && flags.note) return out(await call("POST", `/admin/disputes/${args[1]}/resolve`, { outcome: flags.outcome, note: flags.note }), (d) => console.log(`✓ resolved: payment ${d.payment.state}`));
    if (sub === "refunds") return out(await call("GET", `/admin/refunds?status=${flags.status || "due"}`), (d) =>
      d.refunds.length ? d.refunds.forEach((r) => console.log(`${r.offerId}  ${usd(r.amountUsd).padStart(8)}  ${r.brand.name}: ${r.title}${r.paidAt ? `  paid ${String(r.paidAt).slice(0, 10)} ref ${r.reference}` : ""}`)) : console.log("No refunds due."));
    if (sub === "refund-paid" && args[1] && flags.reference) return out(await call("POST", `/admin/refunds/${args[1]}/paid`, { reference: flags.reference }), () => console.log("✓ marked paid"));
    die("usage: transformer disputes list [--status open|resolved|all] | resolve <id> --outcome release|refund --note … | refunds [--status due|paid|all] | refund-paid <offerId> --reference …   (admin keys)");
  },
  async earnings() {
    out(await call("GET", "/earnings"), (d) => {
      for (const i of d.items) console.log(`${i.status.padEnd(9)} ${usd(i.amountUsd).padStart(8)}  ${i.brand}: ${i.title}`);
      balanceLine(d);
    });
  },
  async balance() {
    out(await call("GET", "/balance"), balanceLine);
  },
  async methods() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", "/payout-methods"), (d) => {
      if (!d.methods.length) console.log("No payout methods. Add one on the website, signed in: https://transformer.gg/settings/payouts");
      for (const m of d.methods) console.log(`${m.id}  ${m.type.padEnd(7)} ${m.masked}${m.isDefault ? "  (default)" : ""}${m.enabled === false ? "  (disabled)" : ""}`);
      console.log(`enabled: ${d.options.methods.join(", ")}`);
    });
    // Adding a method or changing which one is the default is website-only (2026-11-07): an agent or a key must never
    // decide where money goes. The API answers 403 payout_method_web_only; the CLI says so up front.
    if (sub === "add" || sub === "default")
      die("Payout methods can only be added or made the default on the website, signed in: https://transformer.gg/settings/payouts\n(The CLI can list them, remove one, and request a payout to a method saved there.)");
    if (sub === "remove" && args[1]) return out(await call("DELETE", `/payout-methods/${args[1]}`), () => console.log("✓ removed"));
    die("usage: transformer methods list | remove <id>   (add or change methods at https://transformer.gg/settings/payouts)");
  },
  async payout() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", "/payout-requests"), (d) =>
      d.requests.length ? d.requests.forEach((r) => console.log(`${r.id}  ${r.status.padEnd(9)} ${usd(r.amountUsd).padStart(8)}  ${r.method.masked}${r.reference ? `  ref ${r.reference}` : ""}${r.rejectReason ? `  (${r.rejectReason})` : ""}`)) : console.log("No payout requests."));
    if (sub === "request") return out(await call("POST", "/payout-requests", { amountUsd: flags.amount ? Number(flags.amount) : undefined, methodId: flags.method }), (d) =>
      console.log(`✓ requested ${usd(d.request.amountUsd)} to ${d.request.method.masked}${d.request.flagged ? " (held for review: payout method changed in the last 24 h)" : ""}: ${d.request.id}`));
    if (sub === "cancel" && args[1]) return out(await call("POST", `/payout-requests/${args[1]}/cancel`), () => console.log("✓ cancelled; the amount is available again"));
    die("usage: transformer payout list | request [--amount 40] [--method <id>] | cancel <id>");
  },
  async "tax-form"() {
    if ((args[0] || "show") === "show") return out(await call("GET", "/tax-form"), (d) =>
      console.log(d.taxForm ? `${d.taxForm.type} signed ${d.taxForm.signedAt} (${d.taxForm.status}${d.taxForm.expiresAt ? `, valid to ${d.taxForm.expiresAt}` : ""}), TIN …${d.taxForm.tinLast4 ?? "none"}` : "No tax form on file."));
    if (args[0] === "submit" && flags.file) {
      const { readFileSync } = await import("node:fs");
      return out(await call("POST", "/tax-form", JSON.parse(readFileSync(flags.file, "utf8"))), (d) => console.log(`✓ ${d.taxForm.type} on file, signed ${d.taxForm.signedAt}`));
    }
    die("usage: transformer tax-form show | submit --file form.json   (W-9 or W-8BEN fields; see docs)");
  },
  // Feature flags (admin keys; docs/feature-flags.md): new work ships to prd behind a flag, then rolls out.
  async flags() {
    const sub = args[0] || "list";
    const line = (f) => `${f.key.padEnd(20)} ${f.state.padEnd(8)} ${f.state === "percent" ? `${f.rules.percent ?? 0}% ` : ""}${f.state === "targets" ? `${(f.rules.users ?? []).length} users, ${(f.rules.workspaces ?? []).length} workspaces ` : ""}${f.summary ?? f.description}${f.notReady ? `  [${f.notReady}]` : ""}${f.createdAt ? `  (added ${String(f.createdAt).slice(0, 10)})` : ""}`;
    // --pending: only flags not live (on for everyone) yet.
    if (sub === "list") return out(await call("GET", `/admin/flags${flagOn("pending") ? "?pending=1" : ""}`), (d) => (d.flags.length ? d.flags.forEach((f) => console.log(line(f))) : console.log("Every flag is live.")));
    if (sub === "get" && args[1]) return out(await call("GET", `/admin/flags/${args[1]}`), (d) => {
      console.log(line(d.flag));
      for (const h of d.history) console.log(`  ${String(h.at).slice(0, 16)}  ${h.by}: ${h.from.state} → ${h.to.state}${h.note ? `  (${h.note})` : ""}`);
    });
    if (sub === "set" && args[1] && args[2]) {
      const rules = flags.percent !== undefined ? { percent: Number(flags.percent) } : undefined;
      return out(await call("PATCH", `/admin/flags/${args[1]}`, { state: args[2], ...(rules ? { rules } : {}), ...(flags.note ? { note: flags.note } : {}), ...(flagOn("confirm-not-ready") ? { confirmNotReady: true } : {}) }), (d) => console.log(`✓ ${line(d.flag)}`));
    }
    // Several at once: on for everyone, or back to admins only (one transaction; flags that aren't ready are refused).
    if (sub === "bulk" && ["on", "admins"].includes(args[1]) && args[2])
      return out(await call("POST", "/admin/flags/bulk", { keys: args.slice(2), state: args[1], ...(flags.note ? { note: flags.note } : {}) }), (d) => d.flags.forEach((f) => console.log(`✓ ${line(f)}`)));
    if (sub === "target" && args[1]) {
      const list = (v) => (v ? String(v).split(",").map((x) => x.trim()).filter(Boolean) : undefined);
      const rules = { ...(flags.users ? { users: list(flags.users) } : {}), ...(flags.workspaces ? { workspaces: list(flags.workspaces) } : {}) };
      return out(await call("PATCH", `/admin/flags/${args[1]}`, { state: "targets", rules, ...(flags.note ? { note: flags.note } : {}) }), (d) => console.log(`✓ ${line(d.flag)}`));
    }
    if (sub === "kill" && args[1]) return out(await call("POST", `/admin/flags/${args[1]}/kill`, { note: flags.note }), (d) => console.log(`✓ off for everyone: ${line(d.flag)}`));
    die("usage: transformer flags list [--pending] | get <key> | set <key> off|admins|targets|percent|on [--percent 10] [--note …] [--confirm-not-ready] | bulk on|admins <key>… [--note …] | target <key> --users a@x.com,<id> [--workspaces <id>,…] | kill <key> [--note …]   (admin keys)");
  },
  async "brand-profile"() {
    const sub = args[0] || "show";
    const card = (d) => {
      const p = d.profile;
      console.log(`${d.status}${p ? `  ${p.name ?? ""} · ${p.website}` : ""}`);
      if (p?.description) console.log(p.description);
      if (p) console.log(`category: ${p.category ?? "-"} · audience: ${p.audience ?? "-"} · topics: ${p.topics.join(", ") || "-"}`);
    };
    if (sub === "show") return out(await call("GET", "/brand-profile"), card);
    if (sub === "analyze" && args[1]) return out(await call("POST", "/brand-profile/analyze", { website: args[1] }), (d) => { card(d); console.log("→ check it, then: transformer brand-profile confirm"); });
    if (sub === "set" || sub === "confirm") {
      const f = {};
      for (const k of ["name", "headline", "tagline", "website", "description", "category", "audience"]) if (flags[k]) f[k] = flags[k];
      if (flags.logo) f.logoUrl = flags.logo;
      if (flags.topics) f.topics = String(flags.topics).split(",").map((x) => x.trim()).filter(Boolean);
      return out(await call("PUT", "/brand-profile", { ...f, ...(sub === "confirm" ? { confirm: true } : {}) }), card);
    }
    die("usage: transformer brand-profile show | analyze <website> | set|confirm [--name …] [--description …] [--category devtools] [--audience …] [--topics ai_agents,mcp]");
  },
  async brands() {
    // New brand from its website (session-only route; an admin key's owner gets it via MCP create_brand_from_website).
    if (args[0] === "create" && args[1]) return out(await call("POST", "/brands", { website: args[1], name: flags.name }), (d) => {
      console.log(`✓ brand ${d.workspace.name} (${d.workspace.id}) from ${d.workspace.website}`);
      if (d.profile) console.log(`  ${d.profile.tagline ?? d.profile.description ?? ""}\n  → review it in the dashboard (/w/${d.workspace.id}/brand); make a key for the new workspace to act in it`);
      if (d.error) console.log(`  couldn't read the site yet: ${d.error}`);
    });
    die("usage: transformer brands create <website>");
  },
  async launch() {
    const sub = args[0] || "list";
    const parseLaunchItem = (raw, defaultNet) => {
      const s = String(raw).trim();
      const prof = s.match(/^profile:([0-9a-f-]{36})$/i);
      if (prof) return { profileId: prof[1], network: defaultNet };
      const liPref = s.match(/^(?:linkedin|li):(.+)$/i);
      if (liPref) return { creator: liPref[1].trim().replace(/^\/?in\//i, "").replace(/\/+$/, ""), network: "linkedin" };
      const xPref = s.match(/^x:(.+)$/i);
      if (xPref) return { creator: xPref[1].trim(), network: "x" };
      if (/linkedin\.com\/in\//i.test(s)) return { creator: s, network: "linkedin" };
      const inSlug = s.match(/^\/?in\/([a-z0-9-]{3,100})\/?$/i);
      if (inSlug) return { creator: inSlug[1], network: "linkedin" };
      return { creator: s, network: defaultNet };
    };
    const pkgLine = (p) => {
      const s = p.summary ?? {};
      return `${p.brief.id}  ${p.launchDate ?? "-"} (${p.launchWindowHours ?? 24}h)  ${s.totalOffers ?? 0} offers (${s.accepted ?? 0} accepted, ${s.confirmed ?? 0} confirmed, ${usd(s.spentUsd ?? 0)} spent)  ${p.brief.title}${p.brief.isOpen ? "  [open]" : ""}`;
    };
    if (sub === "list") {
      return out(await call("GET", "/launch-packages"), (d) =>
        d.packages.length ? d.packages.forEach((p) => console.log(pkgLine(p))) : console.log("No launch packages."));
    }
    if (sub === "show" && args[1]) {
      return out(await call("GET", `/launch-packages/${args[1]}`), (d) => {
        const s = d.summary ?? {};
        console.log(`${d.brief.title}  (${d.brief.launchDate ?? "-"}, ${d.brief.launchWindowHours ?? 24}h window)${d.brief.isOpen ? "  [open]" : ""}`);
        console.log(`  id          ${d.brief.id}`);
        console.log(`  summary     ${s.totalOffers ?? 0} offers · ${s.sent ?? 0} sent · ${s.accepted ?? 0} accepted · ${s.confirmed ?? 0} confirmed · ${usd(s.spentUsd ?? 0)} spent`);
        for (const o of d.offers ?? []) console.log(`  ${offerLine(o)}`);
      });
    }
    if (sub === "create" || sub === "add") {
      const defaultNet = flags.network ? String(flags.network).toLowerCase() : "x";
      if (!["x", "linkedin"].includes(defaultNet)) die("--network must be x or linkedin");
      const repeated = process.argv.slice(2).flatMap((v, i, a) => (v === "--creator" && a[i + 1] && !a[i + 1].startsWith("--") ? [a[i + 1]] : []));
      const list = [...(flags.creators ? String(flags.creators).split(/[\s,;]+/) : []), ...repeated].map((x) => x.trim()).filter(Boolean);
      if (!list.length) die('usage: transformer launch create --title "..." --url https://... --launch-date YYYY-MM-DD --creators @a,https://linkedin.com/in/b [--window-hours 24] [--price 200] [--open] [--brief <id>] [--acknowledge-binding] [--accept-usual-price]');
      const briefId = sub === "add" ? (args[1] || flags.brief) : flags.brief;
      if (sub === "add" && !briefId) die("usage: transformer launch add <briefId> --creators @a,https://linkedin.com/in/b [--price 200] [--acknowledge-binding]");
      if (!briefId) {
        for (const k of ["title", "url", "launch-date"]) if (!flags[k]) die(`--${k} is required (or pass --brief <id> to add creators to an existing launch package)`);
      }
      const priceRaw = flags.price ?? flags.payout;
      const items = list.map((raw) => ({
        ...parseLaunchItem(raw, defaultNet),
        ...(priceRaw != null ? { priceUsd: Number(priceRaw) } : {}),
        ...(flags["expected-price"] ? { expectedPriceUsd: Number(flags["expected-price"]) } : {}),
        ...(flags.ask ? { ask: flags.ask } : {}),
        ...(flags.days ? { expiresInDays: Number(flags.days) } : {}),
      }));
      const common = {
        items,
        ...(flags.email ? { email: flags.email } : {}),
        ...("acknowledge-binding" in flags ? { acknowledgeBinding: flags["acknowledge-binding"] !== "false" } : {}),
        ...("accept-usual-price" in flags ? { acceptUsualPrice: flags["accept-usual-price"] !== "false" } : {}),
      };
      const body = briefId
        ? { briefId, ...common }
        : {
            title: flags.title,
            url: flags.url,
            launchDate: flags["launch-date"],
            ...(flags["window-hours"] ? { launchWindowHours: Number(flags["window-hours"]) } : {}),
            ...(flags.product ? { product: flags.product } : {}),
            ...(flags.description ? { description: flags.description } : {}),
            ...(flags.points ? { talkingPoints: String(flags.points).split("|").map((x) => x.trim()).filter(Boolean) } : {}),
            ...(flags.avoid ? { avoid: String(flags.avoid).split("|").map((x) => x.trim()).filter(Boolean) } : {}),
            ...(flags.deliverable ? { deliverable: flags.deliverable } : {}),
            ...(flags.commission ? { commissionPercent: Number(flags.commission) } : {}),
            ...(flags.budget ? { budgetUsd: Number(flags.budget) } : {}),
            ...(flags["target-creators"] ? { targetCreators: Number(flags["target-creators"]) } : {}),
            ...("open" in flags ? { isOpen: flags.open !== "false" } : {}),
            ...("allow-ai" in flags ? { allowAi: flags["allow-ai"] !== "false" } : {}),
            ...common,
          };
      return out(await call("POST", "/launch-packages", body), (d) => {
        console.log(`✓ ${d.message}`);
        console.log(`  brief       ${d.brief.id}`);
        console.log(`  offers      ${d.offerIds.join(", ")}`);
        console.log(`  total       ${usd(d.totalUsd)}`);
      });
    }
    die('usage: transformer launch list | show <briefId> | create --title "..." --url https://... --launch-date YYYY-MM-DD --creators @a,https://linkedin.com/in/b [--window-hours 24] [--price 200] [--open] [--brief <id>] [--acknowledge-binding] [--accept-usual-price]   (brand)');
  },
  async briefs() {
    const sub = args[0] || "list";
    if (sub === "starter") return out(await call("POST", "/brand-profile/starter-briefs", { count: flags.count ? Number(flags.count) : undefined }), (d) => {
      for (const b of d.briefs) {
        console.log(`✓ draft ${b.id}  ${b.title}  (${b.starter?.goal})  ${b.url}`);
        if (b.starter?.keyMessage) console.log(`  message: ${b.starter.keyMessage}`);
        if (b.starter?.examplePost) console.log(`  example: ${b.starter.examplePost}`);
        if (b.starter?.budget) console.log(`  budget:  ${b.starter.budget.postUsd != null ? `$${b.starter.budget.postUsd}/post (estimate, ${b.starter.budget.basedOn})` : "priced individually"}`);
      }
      console.log("Nothing was sent. Edit with transformer briefs edit <id> …, then send from the brief.");
    });
    if (sub === "matches" && args[1]) return out(await call("GET", `/briefs/${args[1]}/matches${flags.page ? `?page=${flags.page}` : ""}`), (d) => {
      console.log(`Best matches for "${d.brief.title}" (topics ${d.want.topics?.join(", ") || "-"}; fit ${d.want.brandFit?.join(", ") || "-"})`);
      for (const c of d.results) console.log(`${String(c.match?.score ?? 0).padStart(3)}  @${c.xHandle.padEnd(18)} ${c.match?.why?.slice(0, 3).join(" · ") ?? ""}`);
    });
    const fields = () => {
      const f = {};
      for (const [k, v] of Object.entries({ title: "title", product: "product", description: "description", url: "url", landing: "landingUrlTemplate", deliverable: "deliverable", deadline: "deadline", status: "status", pricing: "pricing", type: "campaignType", "launch-date": "launchDate" })) if (flags[k]) f[v] = flags[k];
      for (const [k, v] of Object.entries({ points: "talkingPoints", avoid: "avoid", must: "mustHaves" })) if (flags[k]) f[v] = String(flags[k]).split("|").map((x) => x.trim()).filter(Boolean);
      if (flags.receives) f.creatorReceivesUsd = Number(flags.receives);
      if (flags.payout) f.payoutUsd = Number(flags.payout);
      if (flags.commission) f.commissionPercent = Number(flags.commission);
      if (flags.quantity) f.quantity = Number(flags.quantity);
      if (flags["window-hours"]) f.launchWindowHours = Number(flags["window-hours"]);
      if (flags.budget) f.budgetUsd = Number(flags.budget);
      if (flags["target-creators"]) f.targetCreators = Number(flags["target-creators"]);
      if ("open" in flags) f.isOpen = flags.open !== "false";
      if ("allow-ai" in flags) f.allowAi = flags["allow-ai"] !== "false";
      return f;
    };
    const line = (b) => `${b.id}  ${b.status.padEnd(7)} ${b.title}${b.isOpen ? " [open]" : ""}${b.launchDate ? ` (${b.launchDate})` : ""}  · ${b.creatorReceivesUsd != null ? `creator ${usd(b.creatorReceivesUsd)} (brand ${usd(b.payoutUsd)})` : "tiers"} · ${b.counts.sent + b.counts.accepted} out, ${b.counts.verified} confirmed, ${b.stats.clicks} clicks, ${b.stats.signups} signups`;
    if (sub === "list") return out(await call("GET", `/briefs${flags.status ? `?status=${flags.status}` : ""}`), (d) => (d.briefs.length ? d.briefs.forEach((b) => console.log(line(b))) : console.log("No briefs.")));
    if (sub === "create") return out(await call("POST", "/briefs", fields()), (d) => console.log(`✓ ${line(d.brief)}`));
    if (sub === "edit" && args[1]) return out(await call("PATCH", `/briefs/${args[1]}`, fields()), (d) => console.log(`✓ ${line(d.brief)}`));
    if (sub === "close" && args[1]) return out(await call("POST", `/briefs/${args[1]}/close`), (d) => console.log(`✓ closed ${d.brief.title}`));
    if (sub === "show" && args[1]) return out(await call("GET", `/briefs/${args[1]}`), (d) => { console.log(line(d.brief)); d.offers.forEach((o) => console.log(`  ${offerLine(o)}`)); });
    if (sub === "applications" && args[1]) {
      const qs = flags.status ? `?status=${encodeURIComponent(flags.status)}` : "";
      return out(await call("GET", `/briefs/${args[1]}/applications${qs}`), (d) => {
        if (!d.applications.length) return console.log("No applications.");
        for (const a of d.applications) {
          const who = a.creator?.xHandle ? `@${a.creator.xHandle}` : (a.creator?.name ?? "");
          console.log(`${a.id}  ${a.status.padEnd(9)} ${usd(a.proposedPriceUsd).padStart(7)}  ${who.padEnd(18)} ${a.note ?? ""}`);
        }
      });
    }
    if (sub === "accept" && args[1] && args[2]) {
      const body = {
        ...("acknowledge-binding" in flags ? { acknowledgeBinding: flags["acknowledge-binding"] !== "false" } : {}),
        ...(flags.email ? { email: flags.email } : {}),
      };
      return out(await call("POST", `/briefs/${args[1]}/applications/${args[2]}/accept`, body), (d) => {
        console.log(`✓ accepted application ${d.application.id}`);
        if (d.offer) offerCard({ offer: d.offer });
      });
    }
    if (sub === "decline" && args[1] && args[2]) {
      return out(await call("POST", `/briefs/${args[1]}/applications/${args[2]}/decline`), (d) =>
        console.log(`✓ declined application ${d.application.id}`));
    }
    if (sub === "send" && args[1]) {
      if (!flags.creators) die("--creators @a,@b is required");
      return out(await call("POST", `/briefs/${args[1]}/offers`, { creators: String(flags.creators).split(/[\s,;]+/).filter(Boolean), approve: flagOn("approve"), ...(flags.receives ? { creatorReceivesUsd: Number(flags.receives) } : {}) }), (d) => {
        console.log(`✓ ${d.drafted} offer${d.drafted === 1 ? "" : "s"} drafted from the brief${d.failed ? `, ${d.failed} skipped` : ""}${d.approved ? `; sent ${d.approved.approved}, waiting for funding ${d.approved.awaitingFunding}` : " (review: transformer drafts list)"}`);
      });
    }
    die('usage: transformer briefs list | create --title … --url … [--open] [--type single_post|launch_package] [--launch-date YYYY-MM-DD] [--window-hours 24] [--budget 1500] [--target-creators 5] [--receives 200] [--points "a|b"] [--avoid "…"] [--deadline 2026-11-15] | show|edit|close <id> | applications <briefId> [--status pending] | accept <briefId> <applicationId> [--acknowledge-binding] | decline <briefId> <applicationId> | send <id> --creators @a,@b [--approve]   (brand)');
  },
  async deals() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", `/deals${flags.status ? `?status=${flags.status}` : ""}`), (d) =>
      d.deals.length ? d.deals.forEach((x) => console.log(`${x.id}  ${x.dealStatus.padEnd(9)} next: ${String(x.nextStep ?? "-").padEnd(8)} ${x.dueAt ? `due ${x.dueAt.slice(0, 10)}  ` : ""}${x.title}  ${x.link ?? ""}`)) : console.log("No deals yet. Accept an offer first."));
    if (sub === "show" && args[1]) return out(await call("GET", `/deals/${args[1]}`), ({ deal: x }) => {
      console.log(`${x.title}  [${x.dealStatus}]${x.dueAt ? `  due ${x.dueAt.slice(0, 10)}` : ""}\n  your link: ${x.link}`);
      x.steps.forEach((s) => console.log(`  ${s.done ? "✓" : "·"} ${s.label}`));
      const b = x.brief ?? {};
      (b.talkingPoints ?? []).forEach((t) => console.log(`  • ${t}`));
      (b.avoid ?? []).forEach((t) => console.log(`  ✗ ${t}`));
      if (b.mustHaves?.length) console.log(`  must include: ${b.mustHaves.join(", ")}`);
    });
    if (sub === "submit" && args[1] && args[2]) return out(await call("POST", `/deals/${args[1]}/submissions`, { url: args[2] }), ({ deal: x }) => console.log(`✓ submitted · ${x.dealStatus}`));
    die("usage: transformer deals list [--status accepted] | show <id> | submit <id> <x-post-url>   (creator)");
  },
  // AI personas: the wizard, deals, content and review. Approving content needs a person in the dashboard.
  async persona() {
    const sub = args[0] || "list";
    const line = (p) => `${p.id}  ${p.status.padEnd(7)} ${p.name.padEnd(16)} ${(p.accounts ?? []).map((a) => `${a.network}:@${a.username}${a.aiBioMarker ? "" : " (bio needs AI marker)"}`).join(" ") || "no accounts"}  in review ${p.counts?.in_review ?? 0}  spent ${usd(p.generationSpendUsd ?? 0)}`;
    const wait = async (g) => {
      process.stderr.write(`… ${g.kind} ${g.id} (est ${g.estCredits} credits, ${usd(g.estCostUsd)})`);
      while (["queued", "running"].includes(g.status)) { await new Promise((r) => setTimeout(r, 3000)); g = (await call("GET", `/generations/${g.id}`)).generation; process.stderr.write("."); }
      process.stderr.write(`\n`);
      return g;
    };
    if (sub === "list") return out(await call("GET", "/personas"), (d) => (d.personas.length ? d.personas.forEach((p) => console.log(line(p))) : console.log("No personas. transformer persona create --name Nova --niches \"dev tools\" --look \"…\"")));
    if (sub === "create") {
      if (!flags.name) die('--name is required');
      return out(await call("POST", "/personas", { name: flags.name, niches: flags.niches ? String(flags.niches).split(",").map((x) => x.trim()) : [], tone: flags.tone, audience: flags.audience, look: flags.look }), (d) => {
        console.log(`✓ ${line(d.persona)}\n  bio: ${d.persona.bio}\n  next: transformer persona looks ${d.persona.id}`);
      });
    }
    const id = args[1];
    if (!id && sub !== "list") die("usage: transformer persona list | create --name … [--niches a,b] [--look …] | get|looks|select|voice|attest|activate|offers|accept|submit|stats <id> …");
    if (sub === "get") return out(await call("GET", `/personas/${id}`), ({ persona: p }) => {
      console.log(line(p));
      console.log(`  bio: ${p.bio}\n  look: ${p.primaryAsset?.url ?? "(not picked)"}  references: ${p.references.length}  voice: ${p.voice ? p.voice.description : "none"}`);
      if (p.missing.length) console.log(`  to activate: ${p.missing.join(", ")}`);
      const s = p.subscription;
      console.log(`  subscription: ${s.status}${s.active ? ` · ${s.remainingCredits} of ${s.includedCredits} credits left · renews/ends ${String(s.periodEnd).slice(0, 10)}` : ` · $${s.priceUsd}/month: transformer persona subscribe ${p.id}`}`);
    });
    if (sub === "looks") {
      const d = await call("POST", `/personas/${id}/looks`, { description: flags.look, count: flags.count ? Number(flags.count) : undefined });
      const g = await wait(d.generation);
      return out({ generation: g }, () => { g.outputs.forEach((o) => console.log(`${o.assetId}  ${o.url}`)); console.log(g.status === "succeeded" ? `pick one: transformer persona select ${id} <assetId>` : `✗ ${g.status}: ${g.error ?? ""}`); });
    }
    if (sub === "select" && args[2]) {
      const d = await call("POST", `/personas/${id}/looks/${args[2]}/select`, {});
      const g = d.generation ? await wait(d.generation) : null;
      return out({ ...d, generation: g }, () => console.log(`✓ look picked${g ? `; reference sheet ${g.status} (${g.outputs.length} images)` : ""}`));
    }
    if (sub === "voice") {
      if (args[2] === "select" && args[3]) return out(await call("POST", `/personas/${id}/voice/select`, { previewId: args[3] }), (d) => console.log(`✓ voice saved: ${d.persona.voice.description}`));
      if (!args[2]) die('usage: transformer persona voice <id> "<description>" [--gender female] | voice <id> select <previewId>');
      return out(await call("POST", `/personas/${id}/voice`, { description: args[2], ...(flags.gender && { gender: flags.gender }) }), (d) => { d.previews.forEach((v) => console.log(`${v.previewId}  ${v.name} · ${v.accent}  ${v.previewUrl}`)); console.log(`pick one: transformer persona voice ${id} select <previewId>`); });
    }
    if (sub === "subscribe") return out(await call("POST", `/personas/${id}/subscribe`), (d) => {
      const s = d.subscription;
      console.log(`${s.status === "active" ? "✓ active" : `subscription ${s.status}`}: $${s.priceUsd}/month, includes ${s.includedCredits} credits a month${s.periodEnd ? ` · until ${String(s.periodEnd).slice(0, 10)}` : ""}`);
      if (d.howToPay) { console.log(`How to pay (reference ${d.howToPay.reference}):`); d.howToPay.steps.forEach((x) => console.log(`  • ${x}`)); console.log(`  Questions: ${d.howToPay.contact}`); }
    });
    if (sub === "attest") return out(await call("PATCH", `/personas/${id}`, { attested: { synthetic: true, adult21: true, labelsOn: true } }), (d) => console.log(`✓ recorded: synthetic persona, adult (21+), labelled as AI on every network${d.persona.canActivate ? `. next: transformer persona activate ${id}` : ""}`));
    if (sub === "activate") return out(await call("POST", `/personas/${id}/activate`), (d) => console.log(`✓ ${line(d.persona)}`));
    if (sub === "offers") return out(await call("GET", `/personas/${id}/offers`), (d) => (d.offers.length ? d.offers.forEach((o) => console.log(`${offerLine(o)}${o.allowAi ? "" : "  (not open to AI)"}`)) : console.log("No offers.")));
    if (sub === "accept" && args[2]) return out(await call("POST", `/personas/${id}/offers/${args[2]}/accept`), offerCard);
    if (sub === "submit" && args[2] && args[3]) return out(await call("POST", `/personas/${id}/offers/${args[2]}/submissions`, { url: args[3] }), offerCard);
    if (sub === "stats") return out(await call("GET", `/personas/${id}/stats?range=${flags.range ?? "30d"}${flags.network ? `&network=${flags.network}` : ""}`), (d) => {
      const t = d.totals;
      console.log(`${d.range}: ${t.followers} followers · ${t.views} views · ${t.clicks} clicks · ${t.conversions} sales (${usd(t.revenueUsd)}) · earned ${usd(t.earnedUsd)} · generation ${usd(t.genCostUsd)}${t.roi != null ? ` · ROI ${t.roi}x` : ""}`);
      d.series.forEach((p) => console.log(`  ${p.day}  ${p.followers ?? "-"} followers`));
    });
    die("usage: transformer persona list | create | get|looks|select|voice|attest|activate|offers|accept|submit|stats <id> …");
  },
  // House accounts (admin keys): NBV's own X accounts and their post queue. A signed-in admin approves every post.
  async social() {
    const sub = args[0] || "accounts";
    const line = (p) => `${p.id}  ${p.status.padEnd(9)} ${String(p.scheduledAt ?? p.suggestedAt ?? "").slice(0, 16).padEnd(16)} ${String(p.length).padStart(3)}${p.thread.length ? ` +${p.thread.length}` : "   "}  ${p.text.replace(/\s+/g, " ").slice(0, 70)}${p.tweetUrl ? `  ${p.tweetUrl}` : ""}`;
    const draftBody = async () => {
      const b = { text: flags.text, thread: flags.thread ? String(flags.thread).split("|").map((x) => x.trim()).filter(Boolean) : undefined, sourceUrl: flags.source, suggestedAt: flags.at, externalKey: flags.key, note: flags.note, imageAlt: flags.alt };
      if (flags.image) {
        if (/^https:\/\//.test(flags.image)) b.imageUrl = flags.image;
        else { b.imageBase64 = readFileSync(flags.image).toString("base64"); b.imageMime = flags.image.endsWith(".png") ? "image/png" : flags.image.endsWith(".webp") ? "image/webp" : flags.image.endsWith(".gif") ? "image/gif" : "image/jpeg"; }
      }
      return b;
    };
    if (sub === "accounts") return out(await call("GET", "/admin/house-accounts"), (d) => {
      d.accounts.forEach((a) => console.log(`${a.id}  @${a.username.padEnd(16)} ${a.status.padEnd(15)} drafts ${a.counts.draft} · scheduled ${a.counts.scheduled} · posted ${a.counts.posted}${a.nextPostAt ? ` · next ${String(a.nextPostAt).slice(0, 16)}` : ""}`));
      if (!d.accounts.length) console.log(`No house accounts. An admin connects one at ${d.connectUrl}`);
      console.log(`Post budget today: $${d.budget.spentTodayUsd} of $${d.budget.dailyUsd} · a post costs $${d.prices.postUsd}, with a link $${d.prices.postWithLinkUsd}`);
    });
    const acct = args[1];
    if (sub === "queue" && acct) return out(await call("GET", `/admin/house-accounts/${encodeURIComponent(acct)}/posts${flags.status ? `?status=${flags.status}` : ""}`), (d) => (d.posts.length ? d.posts.forEach((p) => console.log(line(p))) : console.log("The queue is empty.")));
    if (sub === "draft" && acct) {
      if (!flags.text) die('--text is required');
      return out(await call("POST", `/admin/house-accounts/${encodeURIComponent(acct)}/posts`, await draftBody()), (d) => console.log(`${d.created ? "✓ drafted" : "= already queued"}  ${line(d.post)}\n  approve: ${d.post.adminUrl}`));
    }
    if (sub === "import" && acct && args[2]) {
      const drafts = JSON.parse(readFileSync(args[2], "utf8"));
      return out(await call("POST", `/admin/house-accounts/${encodeURIComponent(acct)}/posts/bulk`, { drafts: Array.isArray(drafts) ? drafts : drafts.drafts }), (d) => {
        console.log(`✓ ${d.created} drafted, ${d.existing} already queued, ${d.failed} failed`);
        d.results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ #${r.i}: ${r.error}`));
      });
    }
    if (sub === "edit" && acct) return out(await call("PATCH", `/admin/house-posts/${acct}`, await draftBody()), (d) => console.log(`✓ ${line(d.post)}`));
    if (sub === "show" && acct) return out(await call("GET", `/admin/house-posts/${acct}`), ({ post: p }) => {
      console.log(`${line(p)}\n\n${p.text}`); p.thread.forEach((t, i) => console.log(`\n${i + 1}/ ${t.text}`));
      console.log(`\n${p.image ? `image: ${p.image.url}\n` : ""}${p.sourceUrl ? `source: ${p.sourceUrl}\n` : ""}est. cost $${p.estCostUsd}${p.error ? `\n⚠ ${p.error}` : ""}\nadmin: ${p.adminUrl}`);
    });
    die('usage: transformer social accounts | queue <@account> [--status draft,scheduled] | draft <@account> --text "…" [--thread "a|b"] [--image file|url] [--alt …] [--source url] [--at 2026-10-29T15:00:00Z] [--key id] | import <@account> drafts.json | edit <postId> [--text …] | show <postId>   (admin keys; approving happens in Admin › House accounts)');
  },
  personas() { return commands.persona(); },
  async wallet() {
    return out(await call("GET", "/gen-wallet"), (d) => { console.log(`Generation wallet: ${usd(d.balanceUsd)} (charges above each persona's included generation at cost + ${d.markupPercent}%)`); d.entries.slice(0, 10).forEach((e) => console.log(`  ${String(e.createdAt).slice(0, 10)}  ${e.kind.padEnd(7)} ${usd(e.amountUsd)}${e.credits ? ` (${e.credits} credits)` : ""}  ${e.note ?? e.reference ?? ""}`)); });
  },
  async gen() {
    const [personaId, kind] = args;
    if (!personaId || !["image", "video", "talking"].includes(kind)) die('usage: transformer gen <personaId> image|video|talking [--offer <id>] [--prompt "…"] [--count 2] [--seconds 5] [--script "…"]');
    const d = await call("POST", "/generations", { personaId, kind, offerId: flags.offer, prompt: flags.prompt, count: flags.count ? Number(flags.count) : undefined, seconds: flags.seconds ? Number(flags.seconds) : undefined, script: flags.script });
    let g = d.generation;
    process.stderr.write(`… ${kind} (est ${g.estCredits} credits, ${usd(g.estCostUsd)})`);
    while (["queued", "running"].includes(g.status)) { await new Promise((r) => setTimeout(r, 3000)); g = (await call("GET", `/generations/${g.id}`)).generation; process.stderr.write("."); }
    process.stderr.write("\n");
    const post = (await call("GET", `/persona-posts/${d.post.id}`)).post;
    return out({ generation: g, post }, () => {
      if (g.status !== "succeeded") return console.log(`✗ ${g.status}: ${g.error ?? ""}`);
      console.log(`✓ post ${post.id}  [${post.status}]  ${g.credits ?? g.estCredits} credits (${usd(g.costUsd)})\n  ${post.caption}`);
      post.assets.forEach((a) => console.log(`  ${a.mime}${a.badge ? " (AI badge)" : ""}${a.c2pa ? " (C2PA)" : ""}  ${a.url}`));
      if (post.flags.length) console.log(`  ⚠ ${post.flags.join(" ")}`);
      console.log(`  next: transformer posts submit ${post.id}`);
    });
  },
  async posts() {
    const sub = args[0] || "list";
    const line = (p) => `${p.id}  ${p.status.padEnd(10)} ${p.kind.padEnd(7)} ${p.offerId ? "deal " : "     "}${p.caption.slice(0, 70)}`;
    if (sub === "list") return out(await call("GET", `/persona-posts?${new URLSearchParams({ ...(flags.persona && { personaId: flags.persona }), ...(flags.status && { status: flags.status }) })}`), (d) => (d.posts.length ? d.posts.forEach((p) => console.log(line(p))) : console.log("No posts.")));
    if (sub === "submit" && args[1]) return out(await call("POST", `/persona-posts/${args[1]}/submit`), (d) => console.log(`✓ in review. A person approves it at ${d.post.reviewUrl}`));
    if (sub === "caption" && args[1] && args[2]) return out(await call("PATCH", `/persona-posts/${args[1]}`, { caption: args[2] }), (d) => console.log(`✓ ${d.post.caption}`));
    if (sub === "pack" && args[1]) {
      const d = await call("GET", `/persona-posts/${args[1]}/pack`);
      if (flags.out) {
        const { mkdirSync: mk, writeFileSync: wr } = await import("node:fs");
        mk(flags.out, { recursive: true });
        for (const a of d.assets) wr(join(flags.out, a.filename), Buffer.from(await (await fetch(a.url)).arrayBuffer()));
        wr(join(flags.out, "caption.txt"), d.caption + "\n");
      }
      return out(d, () => {
        console.log(`caption (paste exactly):\n${d.caption}\n`);
        d.assets.forEach((a) => console.log(`${flags.out ? `saved ${join(flags.out, a.filename)}` : a.url}`));
        Object.values(d.instructions).forEach((t) => console.log(`\n${t}`));
      });
    }
    die('usage: transformer posts list [--persona <id>] [--status in_review] | submit <id> | caption <id> "<text>" | pack <id> [--out ./out]');
  },
  async prices() {
    return out(await call("GET", "/generation-prices"), (d) => { if (d.subscription) console.log(`AI persona subscription: $${d.subscription.usdPerMonth}/month per persona, ${d.subscription.credits} credits a month (1 credit = ${usd(d.subscription.creditUsd)}; resets monthly)`); d.items.forEach((i) => console.log(`${String(i.credits).padStart(4)} credits  ${usd(i.usd).padStart(6)}  ${i.item}  · ${i.provider}`)); });
  },
  async spend() {
    return out(await call("GET", "/generation-spend"), (d) => console.log(`AI generation this month: ${usd(d.month.usedUsd)} of ${usd(d.month.capUsd)} (resets ${d.month.resetsAt.slice(0, 10)})${d.paused ? " · paused by an admin" : ""}`));
  },
  async questions() {
    const sub = args[0] || "list";
    if (sub === "list") {
      const qs = new URLSearchParams(Object.fromEntries(["status", "source", "side", "since", "q", "sort", "limit"].filter((k) => flags[k]).map((k) => [k, flags[k]])));
      return out(await call("GET", `/admin/questions?${qs}`), (d) => {
        for (const c of d.clusters) console.log(`${String(c.id).padStart(5)}  ${c.status.padEnd(9)} ${String(c.mentions).padStart(4)}× ${c.side.padEnd(7)} [${Object.keys(c.sources).join(",")}]  ${c.question}${c.pageUrl ? `  → ${c.pageUrl}` : ""}`);
        if (!d.clusters.length) console.log("No question clusters.");
      });
    }
    if (sub === "show" && args[1]) return out(await call("GET", `/admin/questions/${args[1]}`), (d) => {
      console.log(`${d.cluster.question}  [${d.cluster.status}]`);
      for (const m of d.mentions) console.log(`  ${m.source.padEnd(13)} ${m.url ?? ""}\n      ${m.text}`);
    });
    if (["plan", "publish", "skip", "reopen"].includes(sub) && args[1]) {
      const status = { plan: "planned", publish: "published", skip: "skipped", reopen: "new" }[sub];
      if (sub === "publish" && !flags.url) die("--url https://… (the page that answers it) is required");
      return out(await call("PATCH", `/admin/questions/${args[1]}`, { status, pageUrl: flags.url, note: flags.note }), (d) => console.log(`✓ ${d.cluster.id} ${d.cluster.status}${d.cluster.pageUrl ? ` → ${d.cluster.pageUrl}` : ""}`));
    }
    if (sub === "status") return out(await call("GET", "/admin/questions/status"), (d) => {
      console.log(`${d.paused ? "PAUSED" : "on"} · every ${d.tickHours} h · ${d.totals.clusters} clusters · ${d.totals.questions} questions · ${d.totals.pending} to classify`);
      for (const s of d.today) console.log(`  ${s.source.padEnd(13)} ${String(s.used).padStart(8)} / ${s.budget} ${s.unit.padEnd(12)} ${String(s.questions).padStart(4)} questions${s.configured ? "" : "  (not configured)"}`);
      console.log(`  llm           $${d.llm.spentUsd} / $${d.llm.budgetUsd}`);
    });
    die("usage: transformer questions list [--status new] [--source x] [--since 2026-10-27] | show <id> | plan|publish|skip|reopen <id> [--url …] | status   (admin keys)");
  },
  async "admin-payouts"() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", `/admin/payout-requests?status=${flags.status || "requested"}`), (d) => {
      for (const r of d.requests) console.log(`${r.id}  ${r.status.padEnd(9)} ${usd(r.amountUsd).padStart(8)}  ${r.method.type.padEnd(6)} ${r.method.masked}  ${r.creator.name ?? ""} ${r.creator.x ?? ""}${r.flagged ? `  FLAG: ${r.flagReason}` : ""}`);
      console.log(`owed ${usd(d.totals.owedUsd)} · paid this month ${usd(d.totals.paidThisMonthUsd)} · fees this month ${usd(d.totals.feesThisMonthUsd)}`);
    });
    if (sub === "paid" && args[1]) {
      if (!flags.reference) die("--reference is required (Wise transfer id, trace number or tx hash)");
      return out(await call("POST", `/admin/payout-requests/${args[1]}/mark-paid`, { reference: flags.reference, feeUsd: Number(flags.fee || 0), paidAt: flags["paid-at"], note: flags.note }), (d) =>
        console.log(`✓ marked paid: ${usd(d.request.amountUsd)} ref ${d.request.reference}`));
    }
    if (sub === "wise" && args[1]) {
      if (flagOn("preview")) return out(await call("GET", `/admin/payout-requests/${args[1]}/wise-preview`), (d) =>
        console.log(`${usd(d.sourceAmountUsd)} from USD balance (${d.usdBalance ?? "?"} available) → ${d.targetAmount} ${d.currency} at ${d.rate}, Wise fee ${usd(d.feeUsd)} (${d.recipientType} recipient, ${d.env})`));
      return out(await call("POST", `/admin/payout-requests/${args[1]}/pay-wise`), (d) =>
        console.log(`✓ Wise transfer ${d.transferId}: funding ${d.fund.status}${d.wise.error ? ` (${d.wise.error})` : ""}; status ${d.wise.status}. Marked paid automatically when Wise sends it.`));
    }
    die("usage: transformer admin-payouts list [--status requested|flagged|paid|rejected] | paid <id> --reference … [--fee 0] [--paid-at 2026-10-26] | wise <id> [--preview]   (admin keys)");
  },
  async drafts() {
    const sub = args[0] || "list";
    const draftLine = (d) => `${d.offerId}  ${(d.handle ?? "").padEnd(18)} ${String(d.followers ?? "?").padStart(9)} ${String(d.tier ?? "").padEnd(10)} ${usd(d.payoutUsd).padStart(6)} → creator ${usd(d.creatorEarnsUsd)}${d.needsPayout ? "  (set payout)" : ""}`;
    if (sub === "list") return out(await call("GET", `/drafts${flags.batch ? `?batchId=${flags.batch}` : ""}`), (d) => {
      if (!d.drafts.length) return console.log("No drafts.");
      for (const x of d.drafts) { console.log(draftLine(x)); if (x.reason) console.log(`    why: ${x.reason}`); console.log(`    pitch: ${x.pitchText}`); }
      console.log(`${d.count} drafts · ${usd(d.totalPayoutUsd)} total`);
    });
    if (sub === "create") {
      if (!flags.creators) die("usage: transformer drafts create --creators @a,@b [--template <id>] [--url …] [--title …] [--payout 100] [--label …]");
      return out(await call("POST", "/drafts", {
        creators: String(flags.creators).split(/[\s,;]+/).filter(Boolean), label: flags.label, templateId: flags.template, url: flags.url, title: flags.title,
        brief: flags.brief, payoutUsd: flags.payout && Number(flags.payout),
      }), (d) => {
        console.log(`✓ batch "${d.batch.label}" (${d.batch.id}): ${d.drafted} drafted, ${d.failed} skipped`);
        for (const r of d.results.filter((r) => !r.ok)) console.log(`  ${r.creator.padEnd(20)} ✗ ${r.error}`);
        for (const x of d.drafts) console.log(`  ${draftLine(x)}`);
        console.log("  → review, then: transformer drafts approve --batch " + d.batch.id);
      });
    }
    if (sub === "edit" && args[1]) return out(await call("PATCH", `/drafts/${args[1]}`, { payoutUsd: flags.payout && Number(flags.payout), pitchText: flags.pitch, title: flags.title, brief: flags.brief }), (d) => console.log(draftLine(d.draft ?? { ...d.offer, offerId: d.offer?.id })));
    if (sub === "approve" || sub === "discard") {
      const body = flags.batch ? { batchId: flags.batch } : { offerIds: args.slice(1) };
      if (!flags.batch && !args[1]) die(`usage: transformer drafts ${sub} <offer-id…> | --batch <id>`);
      return out(await call("POST", `/drafts/${sub}`, body), (d) => {
        if (sub === "discard") return console.log(`✓ discarded ${d.discarded}`);
        console.log(`✓ approved ${d.approved}${d.failed ? `, ${d.failed} failed` : ""}. Paste into each creator's X DMs:`);
        for (const r of d.results) console.log(r.ok ? `\n── ${r.handle}  (${usd(r.payoutUsd)}, creator earns ${usd(r.creatorEarnsUsd)})\n${r.pitchText}` : `  ${r.handle} ✗ ${r.error}`);
      });
    }
    die("usage: transformer drafts list | create | edit <id> | approve | discard");
  },
  async pricing() {
    out(await call("GET", "/pricing"), (d) => {
      for (const t of d.tiers) console.log(`${t.label.padEnd(12)} ${String(t.minFollowers).padStart(8)}+ followers  ${t.payoutUsd == null ? "custom" : `${usd(t.payoutUsd)} → creator ${usd(t.creatorEarnsUsd)}`}`);
      console.log(`\npitch template: ${d.pitchTemplate ?? "(none: Transformer's standard invite DM)"}`);
    });
  },
  async templates() {
    const sub = args[0] || "list";
    if (sub === "list") return out(await call("GET", "/templates"), (d) => (d.templates.length ? d.templates.forEach((t) => console.log(`${t.id}  ${t.name.padEnd(24)} ${(t.payoutUsd == null ? "tiers" : usd(t.payoutUsd)).padStart(7)} ${t.deliverable.padEnd(6)} ${t.title}`)) : console.log("No templates.")));
    if (sub === "save") {
      for (const k of ["name", "title", "url"]) if (!flags[k]) die(`--${k} is required`);
      return out(await call("POST", "/templates", {
        name: flags.name, title: flags.title, brief: flags.brief || "", url: flags.url, deliverable: flags.deliverable || "post",
        quantity: Number(flags.quantity || 1), payoutUsd: flags.payout ? Number(flags.payout) : undefined, commissionPercent: Number(flags.commission || 0),
      }), (d) => console.log(`✓ template "${d.template.name}" saved: ${d.template.id}`));
    }
    if (sub === "delete" && args[1]) return out(await call("DELETE", `/templates/${args[1]}`), () => console.log("✓ deleted"));
    die("usage: transformer templates list | save --name … --title … --url … --payout … | delete <id>");
  },
  // Pay on accept: every accepted offer waiting for payment, or the ones named.
  async pay() {
    out(await call("POST", "/pay-due", args.length ? { offerIds: args } : {}), (d) => {
      console.log(`✓ ${d.offers} offer${d.offers === 1 ? "" : "s"} · $${d.totalUsd}${d.balanceAppliedUsd ? ` · $${d.balanceAppliedUsd} from your balance` : ""} · due $${d.dueUsd}`);
      if (d.checkoutUrl) console.log(`Pay: ${d.checkoutUrl}`);
      else if (d.instructions) console.log(d.instructions.howToPay, `(reference ${d.instructions.reference})`);
      else console.log(d.message);
    });
  },
  async fund() {
    if (!args.length) die("usage: transformer fund <offer-id…>   (brand: payment for specific offers; normally use transformer pay)");
    out(await call("POST", "/funding-request", { offerIds: args }), (d) => console.log(`✓ funding requested for ${d.offers} offer${d.offers === 1 ? "" : "s"} (${usd(d.amountUsd)}), reference ${d.reference}. ${d.message}`));
  },
  async funnel() {
    out(await call("GET", `/funnel${flags.batch ? `?batchId=${flags.batch}` : ""}`), ({ funnel: f }) => {
      const row = (label, r) => console.log(`${label.slice(0, 28).padEnd(28)} ${["sent", "viewed", "signedIn", "accepted", "posted", "verified", "paid"].map((k) => String(r[k]).padStart(8)).join("")}`);
      console.log(`${"".padEnd(28)} ${["sent", "viewed", "signed in", "accepted", "posted", "verified", "paid"].map((k) => k.padStart(8)).join("")}`);
      row("all offers", f.total);
      for (const b of f.batches) row(`${b.label}`, b);
    });
  },
  async publish() {
    die("publishing from the CLI was removed: post on X yourself (with your tracked link and #ad), then run: transformer submit <offer-id> <x-post-url>");
  },
  async submit() {
    if (!args[0] || !args[1]) die("usage: transformer submit <offer-id> <x-post-url>");
    out(await call("POST", `/offers/${args[0]}/submissions`, { url: args[1] }), offerCard);
  },
  async conversions() {
    if (args[0] !== "report") die("usage: transformer conversions report --click <tf_click> --amount 49 --order A-1001");
    if (!flags.amount || !flags.order || !(flags.click || flags.offer)) die("--amount, --order and --click (or --offer) are required");
    out(await call("POST", "/conversions", { clickId: flags.click, offerId: flags.offer, amountUsd: Number(flags.amount), orderId: flags.order }), (d) =>
      console.log(d.duplicate ? `= order ${flags.order} was already recorded` : `✓ sale recorded: ${usd(d.amountUsd)} (commission ${usd(d.commissionUsd)}) · offer now ${d.stats.conversions} sales, ${usd(d.stats.revenueUsd)}`));
  },
  async stats() {
    if (!args[0]) die("usage: transformer stats <offer-id>");
    out(await call("GET", `/offers/${args[0]}/stats`), ({ stats: s }) =>
      console.log(`${s.clicks} clicks · ${s.conversions} sales · ${usd(s.revenueUsd)} revenue · ${usd(s.commissionUsd)} commission · ${s.verifiedPosts} verified posts`));
  },
  help() {
    console.log(`transformer: Transformer from the command line (${BASE})

  login                         save a workspace API key
  me                            this workspace and its totals
  creators search [query] [--min-followers 10000] [--max-followers …]
                [--niche ai] [--min-engagement 2] [--max-price 300] [--metro sf_bay] [--country us] [--language en]
                [--active-days 30] [--sponsors paid|open|any] [--worked-with-us] [--sort relevance|followers|engagement|price|recent|rating|match] [--min-rating 4] [--page 2]
                [--topics ai_agents,mcp] [--brand-fit devtools] [--tone technical]   (sort match: best fit on audience profiles)
                                find creators on Transformer by their verified X account (brand)
  creator <workspace-id>        one creator's X account, engagement and recent posts
  social [show]                 this creator's connected X account and stats (creator)
  social sync                   re-import profile, stats and recent posts from X now (creator)
  accounts [list]               connected X accounts, primary, earned (creator)
  accounts add x <handle>       get a TX-XXXXXX code to put in your X bio (or connect with Sign in with X)
  accounts verify x <id>        check the code and connect the account
  accounts primary|remove <account-id>
  profile [show]                your directory profile (creator; connecting X lists it)
  profile audience [show|set <field> <value>|remove <field>|reset <field>|hide|unhide|reviewed|rebuild]
                                your audience profile, built from your X posts; your edits always win (creator)
  flags list | get <key> | set <key> <off|admins|targets|percent|on> [--percent N] | target <key> --users … | kill <key>
                                feature flags: ship to prd behind a flag, roll out admins → targets → percent → on (admin keys)
  brand-profile show | analyze <website> | set|confirm [--name …] [--category …] [--topics …]   your brand profile (brand)
  briefs matches <id>           creators ranked for a brief by audience profile (brand)
  briefs starter [--count 3]    draft 2-3 starter briefs from your brand profile; nothing is sent (brand)
  profile list | hide | remove  show in / hide from / delete from the directory (creator)
  profile set [--headline …] [--niches ai,devtools] [--post 250] [--thread none] [--video 900] [--open false]
  offers list [--status sent]   offers sent (brand) or received (creator)
  offers create --creator @jane --url https://… --payout 250 [--network x|linkedin] [--deliverable post|thread|video]
                [--quantity 1] [--title …] [--brief …] [--commission 10] [--template <id>] [--acknowledge-binding] [--accept-usual-price] [--allow-ai]
  launch list | show <briefId>  your coordinated launch packages (brand)
  launch create --title "…" --url https://… --launch-date YYYY-MM-DD --creators @a,https://linkedin.com/in/b
                [--window-hours 24] [--price 200] [--open] [--brief <id>] [--acknowledge-binding] [--accept-usual-price]
                                coordinate X and LinkedIn creators for one launch window (brand)
  pay [offer-id…]               pay for accepted offers (all waiting when no ids): balance first, then a checkout link (brand)
  posts --creator <id|@h>       suggested X post per creator, in their voice ({link} + #ad) (brand)
  add @handle [x.com/handle…]   add creators by X handle (we look them up and index them; contacts nobody) (brand)
  added [--status ready]        creators you added and their status (brand)
  fund <offer-id…>              payment for specific offers (brand; normally use pay)
  offers create --creators @a,@b,@c | --csv creators.csv  [--template <id>] [--label "X DMs"]
                                one offer + invite link per creator (brand)
  drafts create --creators @a,@b [--template <id>] [--payout 100] [--label …]
                                draft offers priced by follower tier (brand); nothing is sent
  drafts list [--batch <id>]    review queue with pitch texts
  drafts edit <id> [--payout 150] [--pitch "…"]
  drafts approve <id…> | --batch <id>   go live; prints invite link + pitch to paste in X DMs
  drafts discard <id…> | --batch <id>
  pricing                       follower tiers and pitch template (brand)
  briefs list | create --title … --url … [--open] [--type single_post|launch_package] [--launch-date YYYY-MM-DD] [--window-hours 24] [--budget 1500] [--target-creators 5] [--receives 200]
  briefs show|edit|close <id> | send <id> --creators @a,@b [--approve]   (brand)
  briefs applications <briefId> [--status pending] | accept <briefId> <applicationId> [--acknowledge-binding] | decline <briefId> <applicationId>   (brand)
  deals list | show <id> | submit <id> <x-post-url>   (creator: offers you accepted)
  templates list | save --name … --title … --url … [--payout …] | delete <id>   (no --payout: follower tiers)
  funnel [--batch <id>]         invite funnel: sent → viewed → signed in → accepted → posted → paid
  offers show|accept|decline|cancel <id>   (cancel: before the creator accepts; after, open a dispute)
  offers approve-early <id>     brand: approve the submitted post early (the Transformer team still reviews it)
  offers dispute <id> --reason not_posted|post_issue|cancel_request|other --details "…"   freezes the held payment until an admin decides
  reviews pending | show <offerId> | leave <offerId> --stars 5 [--text "…"] [--ratings communication=5,on_time=4]
  reviews reply <reviewId> --text "…" | report <reviewId> --reason "…" | list <workspaceId> [--stars 5]
                                1-5 stars both ways once a deal ends; public as soon as posted
  disputes list | resolve <id> --outcome release|refund --note "…" | refunds | refund-paid <offerId> --reference …   (admin keys)
  submit <id> <x-post-url>      verify a post you made on X with your tracked link (creator)
  earnings | balance            what you've earned and can request (creator)
  methods list | add --type wise --name … --email … --country GB --currency GBP | default <id> | remove <id>
  payout list | request [--amount 40] [--method <id>] | cancel <id>
  tax-form show | submit --file form.json      W-9 or W-8BEN (needed above the yearly threshold)
  questions list [--status new] [--source …] [--since date] | show <id> | plan|publish|skip <id> [--url …] | status   (admin keys)
  admin-payouts list [--status …] | paid <id> --reference … [--fee 0]   (admin keys)
  persona list | create --name Nova [--niches "dev tools,ai"] [--look "…"] [--tone …]   AI personas you run
  persona looks <id> [--look …] | select <id> <assetId> | voice <id> "<description>" [--gender female] | voice <id> select <previewId>
  persona attest <id> | activate <id> | get <id> | stats <id> [--range 30d]
  persona subscribe <id>        paid add-on per persona per month (posts, deals, being found); prints how to pay
  wallet                        prepaid generation wallet (beyond a persona's included generation)
  persona offers <id> | accept <id> <offerId> | submit <id> <offerId> <x-post-url>   (allowAi offers only)
  gen <personaId> image|video|talking [--offer <id>] [--prompt "…"] [--seconds 5]   generate a post (async; waits)
  posts list [--persona <id>] [--status in_review] | submit <id> | caption <id> "…" | pack <id> [--out ./out]
                                a person approves in the dashboard (agents can't); then post natively and submit the URL
  social accounts | queue <@acct> | draft <@acct> --text "…" [--thread "a|b"] [--image f] [--source url] [--at iso] [--key id] | import <@acct> file.json
                                house accounts' post queue (admin keys); a signed-in admin approves each post
  spend | prices                AI generation spend vs this month's allowance | what each item costs
  conversions report --click <tf_click> --amount 49 --order A-1001   (brand)
  stats <id>                    clicks, sales, revenue, commission

Add --json to any command for raw output. Docs: ${BASE}/docs`);
  },
};

Promise.resolve().then(() => (commands[cmd] || commands.help)()).catch((e) => die(e.message));
