import { NextResponse, after } from "next/server";
import {
  type Deal, JiraApiError, JiraConfigError,
  fetchProjectStatuses, fetchProjectStatusesUnion, searchIssues, issueToDeal,
  unionOrdered, PRODUCT_KEYS, PROJECT_KEYS,
} from "../_lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache" | "stale";
  deals: Deal[];
  salesStages: string[];
  projectStages: string[];
  productStages: string[];
};

const FRESH_TTL_MS = 5 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

let cache: { payload: Omit<Payload, "source">; freshUntil: number; staleUntil: number } | null = null;
let refreshInFlight: Promise<void> | null = null;

async function buildFresh(): Promise<Omit<Payload, "source">> {
  const [
    salesStages, projectStages,
    salesIssues, projectIssues, leadIssues,
    productEpicStages, productStoryStages,
    productEpics, productStories,
  ] = await Promise.all([
    fetchProjectStatuses("BDM", "Customer"),
    fetchProjectStatusesUnion([...PROJECT_KEYS], "Epic"),
    searchIssues('project = BDM AND issuetype = Customer'),
    searchIssues(`project IN (${PROJECT_KEYS.join(", ")}) AND issuetype = Epic`),
    searchIssues('project = BDM AND issuetype = Lead'),
    fetchProjectStatusesUnion([...PRODUCT_KEYS], "Epic"),
    fetchProjectStatusesUnion([...PRODUCT_KEYS], "Story"),
    searchIssues(`project IN (${PRODUCT_KEYS.join(", ")}) AND issuetype = Epic`),
    searchIssues(`project IN (${PRODUCT_KEYS.join(", ")}) AND issuetype = Story`),
  ]);

  const leadName = new Map<string, string>();
  for (const l of leadIssues) leadName.set(l.key, l.fields.summary || l.key);

  const salesDeals: Deal[] = salesIssues.map(i => {
    const d = issueToDeal(i, "sales");
    const parentKey = i.fields.parent?.key;
    if (parentKey && leadName.has(parentKey)) d.lead = leadName.get(parentKey)!;
    return d;
  });
  const projectDeals: Deal[] = projectIssues.map(i => issueToDeal(i, "project"));

  const productDeals: Deal[] = [
    ...productEpics.map(i => issueToDeal(i, "product", undefined, "epic")),
    ...productStories.map(i => issueToDeal(i, "product", i.fields.parent?.key, "story")),
  ];

  const productStages = unionOrdered(productEpicStages, productStoryStages);

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    deals: [...salesDeals, ...projectDeals, ...productDeals],
    salesStages,
    projectStages,
    productStages,
  };
}

function revalidate(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const payload = await buildFresh();
      const now = Date.now();
      cache = { payload, freshUntil: now + FRESH_TTL_MS, staleUntil: now + STALE_MAX_MS };
    } catch (err) {
      console.error("[/api/jira/deals bg revalidate]", err);
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const now = Date.now();

  if (!force && cache && cache.freshUntil > now) {
    return NextResponse.json({ ...cache.payload, source: "cache" } satisfies Payload);
  }

  if (!force && cache && cache.staleUntil > now) {
    after(revalidate);
    return NextResponse.json({ ...cache.payload, source: "stale" } satisfies Payload);
  }

  try {
    const payload = await buildFresh();
    cache = { payload, freshUntil: now + FRESH_TTL_MS, staleUntil: now + STALE_MAX_MS };
    return NextResponse.json({ ...payload, source: "jira" } satisfies Payload);
  } catch (err) {
    console.error("[/api/jira/deals]", err);
    const message =
      err instanceof JiraConfigError ? "config error" :
      err instanceof JiraApiError    ? `Jira API error (${err.status})` :
      "unknown error";
    return NextResponse.json({ ok: false as const, error: message, syncedAt: null }, { status: 502 });
  }
}
