import { NextResponse } from "next/server";
import { JiraApiError, JiraConfigError, fetchTree, type TreeBundle } from "../_lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache";
  sales: TreeBundle;
  project: TreeBundle;
  product: TreeBundle;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { payload: Omit<Payload, "source">; expiresAt: number } | null = null;

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

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) {
    return NextResponse.json({ ...cache.payload, source: "cache" } satisfies Payload);
  }
  try {
    const payload = await buildFresh();
    cache = { payload, expiresAt: now + CACHE_TTL_MS };
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
