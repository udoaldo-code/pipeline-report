import { NextResponse, after } from "next/server";
import { JiraApiError, JiraConfigError, fetchTree, type TreeBundle } from "../_lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache" | "stale";
  sales: TreeBundle;
  project: TreeBundle;
  product: TreeBundle;
};

const FRESH_TTL_MS = 5 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

let cache: { payload: Omit<Payload, "source">; freshUntil: number; staleUntil: number } | null = null;
let refreshInFlight: Promise<void> | null = null;

async function buildFresh(): Promise<Omit<Payload, "source">> {
  const data = await fetchTree();
  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    sales: data.sales,
    project: data.project,
    product: data.product,
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
      console.error("[/api/jira/tree bg revalidate]", err);
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
    console.error("[/api/jira/tree]", err);
    const message =
      err instanceof JiraConfigError ? "config error" :
      err instanceof JiraApiError    ? `Jira API error (${err.status})` :
      "unknown error";
    return NextResponse.json({ ok: false as const, error: message, syncedAt: null }, { status: 502 });
  }
}
