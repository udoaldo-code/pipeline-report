// Jira REST v3 client — private helpers for /api/jira/* routes
// Spec: docs/superpowers/specs/2026-05-16-jira-sync-design.md

export type Deal = {
  id: string;
  pid: string;
  name: string;
  owner: string;
  val: number;
  stage: string;
  pri: string;
  notes: string;
  hist: { wk: string; stage: string; note: string; by: string; ts: string }[];
  at: string;
  dueDate?: string;
};

type JiraIssue = {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string } | null;
    priority: { name: string } | null;
    duedate: string | null;
    created: string;
    customfield_10015: string | null;
  };
};

type JiraSearchResponse = {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast: boolean;
};

type JiraStatusGroup = {
  name: string; // issuetype name
  statuses: { name: string }[];
};

export class JiraConfigError extends Error {}
export class JiraApiError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

function authHeader(): string {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new JiraConfigError("JIRA_EMAIL or JIRA_API_TOKEN missing");
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

function baseUrl(): string {
  const host = process.env.JIRA_BASE_URL;
  if (!host) throw new JiraConfigError("JIRA_BASE_URL missing");
  return `https://${host}`;
}

async function jiraGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new JiraApiError(res.status, `${path} -> HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
