import { NextResponse } from "next/server";
import {
  type Deal, JiraApiError, JiraConfigError,
  fetchProjectStatuses, fetchProjectStatusesUnion, searchIssues, issueToDeal,
} from "../_lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  ok: true;
  syncedAt: string;
  source: "jira" | "cache";
  deals: Deal[];
  salesStages: string[];
  projectStages: string[];
};

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { payload: Omit<Payload, "source">; expiresAt: number } | null = null;

async function buildFresh(): Promise<Omit<Payload, "source">> {
  const [salesStages, projectStages, salesIssues, projectIssues] = await Promise.all([
    fetchProjectStatuses("BDM", "Customer"),
    fetchProjectStatusesUnion(["RP", "PPOBNEW", "GOR"], "Epic"),
    searchIssues('project = BDM AND issuetype = Customer'),
    searchIssues('project IN (RP, PPOBNEW, GOR) AND issuetype = Epic'),
  ]);
  const deals: Deal[] = [
    ...salesIssues.map(i => issueToDeal(i, "sales")),
    ...projectIssues.map(i => issueToDeal(i, "project")),
  ];
  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    deals,
    salesStages,
    projectStages,
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
    const message =
      err instanceof JiraConfigError ? `config: ${err.message}` :
      err instanceof JiraApiError    ? `api ${err.status}: ${err.message}` :
      `unknown: ${(err as Error).message}`;
    return NextResponse.json({ ok: false as const, error: message, syncedAt: null }, { status: 502 });
  }
}
