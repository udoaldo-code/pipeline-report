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

const PRIORITY_MAP: Record<string, string> = {
  Highest: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Lowest: "Low",
};
const mapPriority = (p: string | null | undefined): string =>
  (p && PRIORITY_MAP[p]) || "Medium";

const dateOnly = (iso: string): string => iso.slice(0, 10);

export async function fetchProjectStatuses(projectKey: string, issuetypeName: string): Promise<string[]> {
  const groups = await jiraGet<JiraStatusGroup[]>(`/rest/api/3/project/${projectKey}/statuses`);
  const g = groups.find(x => x.name === issuetypeName);
  return g ? g.statuses.map(s => s.name) : [];
}

export async function fetchProjectStatusesUnion(
  projectKeys: string[],
  issuetypeName: string,
): Promise<string[]> {
  const lists = await Promise.all(projectKeys.map(k => fetchProjectStatuses(k, issuetypeName)));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) for (const s of list) {
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export async function searchIssues(jql: string): Promise<JiraIssue[]> {
  const fields = [
    "summary", "status", "assignee", "priority",
    "duedate", "created", "customfield_10015",
  ].join(",");
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const q = new URLSearchParams({ jql, fields, maxResults: "100" });
    if (nextPageToken) q.set("nextPageToken", nextPageToken);
    const page = await jiraGet<JiraSearchResponse>(`/rest/api/3/search/jql?${q.toString()}`);
    all.push(...page.issues);
    nextPageToken = !page.isLast && page.nextPageToken ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return all;
}

export function issueToDeal(issue: JiraIssue, pid: "sales" | "project"): Deal {
  const f = issue.fields;
  const at = f.customfield_10015 ? dateOnly(f.customfield_10015) : dateOnly(f.created);
  const deal: Deal = {
    id: issue.key,
    pid,
    name: f.summary || issue.key,
    owner: f.assignee?.displayName || "",
    val: 0,
    stage: f.status?.name || "Unknown",
    pri: mapPriority(f.priority?.name),
    notes: "",
    hist: [],
    at,
  };
  if (f.duedate) deal.dueDate = f.duedate;
  return deal;
}

/* ──────────────────────────────────────────────
   GANTT TREE — types, project meta, changelog
   ────────────────────────────────────────────── */

export type TreeKind = "project" | "epic" | "task" | "subtask" | "customer";

export type TreeNode = {
  id: string;
  kind: TreeKind;
  name: string;
  projectKey: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  isOverdue: boolean;
  parentId: string | null;
  children: TreeNode[];
};

export type ProjectMeta = {
  key: string;
  name: string;
  color: string;
  totalEpics: number;
  doneEpics: number;
};

export type TreeBundle = {
  projects: ProjectMeta[];
  tree: TreeNode[];
};

const PROJECT_PALETTE = ["#22C55E", "#F59E0B", "#3B82F6", "#A855F7", "#EF4444", "#10B981"];

const DONE_STATUSES = new Set([
  "Done", "Closed Won", "Closed Lost", "Live", "Signed", "Dropped", "Inactive",
]);

export async function fetchProjectMeta(key: string): Promise<{ key: string; name: string }> {
  const data = await jiraGet<{ key: string; name: string }>(`/rest/api/3/project/${key}`);
  return { key: data.key, name: data.name };
}

type ChangelogItem = { field: string; fromString: string | null; toString: string | null };
type ChangelogEntry = { created: string; items: ChangelogItem[] };

export type IssueWithChangelog = {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    duedate: string | null;
    customfield_10015: string | null;
    parent: { key: string } | null;
  };
  changelog: { histories: ChangelogEntry[] };
};

export async function searchIssuesWithChangelog(jql: string): Promise<IssueWithChangelog[]> {
  const fields = ["summary", "status", "issuetype", "duedate", "customfield_10015", "parent"].join(",");
  const all: IssueWithChangelog[] = [];
  let nextPageToken: string | undefined;
  do {
    const q = new URLSearchParams({ jql, fields, expand: "changelog", maxResults: "100" });
    if (nextPageToken) q.set("nextPageToken", nextPageToken);
    const page = await jiraGet<{ issues: IssueWithChangelog[]; nextPageToken?: string; isLast: boolean }>(
      `/rest/api/3/search/jql?${q.toString()}`,
    );
    all.push(...page.issues);
    nextPageToken = !page.isLast && page.nextPageToken ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return all;
}

export function extractOriginalDueDate(
  current: string | null,
  changelog: { histories: ChangelogEntry[] },
): string | null {
  if (!current) return null;
  // Find first history entry where duedate was set (or changed).
  // Earliest non-null `toString` that differs from current means a revision occurred.
  const dueChanges: { created: string; toString: string | null; fromString: string | null }[] = [];
  for (const h of changelog.histories) {
    for (const it of h.items) {
      if (it.field === "duedate") {
        dueChanges.push({ created: h.created, toString: it.toString, fromString: it.fromString });
      }
    }
  }
  if (dueChanges.length === 0) return null;
  // sort ascending by created
  dueChanges.sort((a, b) => a.created.localeCompare(b.created));
  // earliest assigned date is first toString (or fromString of earliest if it started non-null)
  const earliest = dueChanges[0];
  // pick first non-null assignment from the timeline
  const original = earliest.fromString
    ? earliest.fromString.slice(0, 10)
    : earliest.toString
    ? earliest.toString.slice(0, 10)
    : null;
  if (!original || original === current) return null;
  return original;
}

function kindFromIssueType(issuetype: string): TreeKind {
  const t = issuetype.toLowerCase();
  if (t === "customer") return "customer";
  if (t === "epic")     return "epic";
  if (t === "sub-task" || t === "subtask") return "subtask";
  // Task and Story both rendered as task layer
  return "task";
}

function buildNode(i: IssueWithChangelog, today: string): TreeNode {
  const status   = i.fields.status?.name ?? "Unknown";
  const dueDate  = i.fields.duedate;
  const overdue  = !!dueDate && dueDate < today && !DONE_STATUSES.has(status);
  return {
    id: i.key,
    kind: kindFromIssueType(i.fields.issuetype.name),
    name: i.fields.summary || i.key,
    projectKey: i.key.split("-")[0],
    status,
    startDate: i.fields.customfield_10015 ? i.fields.customfield_10015.slice(0, 10) : null,
    dueDate,
    originalDueDate: extractOriginalDueDate(dueDate, i.changelog),
    isOverdue: overdue,
    parentId: i.fields.parent?.key ?? null,
    children: [],
  };
}

function buildProjectTree(
  projectMetas: Map<string, { key: string; name: string }>,
  issues: IssueWithChangelog[],
  paletteOffset: number,
  isCustomerFlat: boolean,
): TreeBundle {
  const today = new Date().toISOString().slice(0, 10);
  const allNodes = issues.map(i => buildNode(i, today));

  // Index by id
  const byId = new Map<string, TreeNode>();
  for (const n of allNodes) byId.set(n.id, n);

  // Link parents
  const orphans: TreeNode[] = [];
  for (const n of allNodes) {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(n);
    } else {
      orphans.push(n);
    }
  }

  // Group orphans by projectKey
  const byProject = new Map<string, TreeNode[]>();
  for (const n of orphans) {
    const list = byProject.get(n.projectKey) ?? [];
    list.push(n);
    byProject.set(n.projectKey, list);
  }

  // Build project headers
  const projects: ProjectMeta[] = [];
  const tree: TreeNode[] = [];
  let pi = 0;
  for (const [pk, meta] of projectMetas) {
    const top = byProject.get(pk) ?? [];
    const epics = top.filter(n => n.kind === "epic");
    const doneEpics = epics.filter(n => DONE_STATUSES.has(n.status)).length;
    const color = PROJECT_PALETTE[(paletteOffset + pi) % PROJECT_PALETTE.length];
    projects.push({
      key: pk,
      name: meta.name,
      color,
      totalEpics: isCustomerFlat ? top.length : epics.length,
      doneEpics: isCustomerFlat ? top.filter(n => DONE_STATUSES.has(n.status)).length : doneEpics,
    });
    const projectNode: TreeNode = {
      id: `proj:${pk}`,
      kind: "project",
      name: meta.name,
      projectKey: pk,
      status: "",
      startDate: null,
      dueDate: null,
      originalDueDate: null,
      isOverdue: false,
      parentId: null,
      children: top,
    };
    tree.push(projectNode);
    pi++;
  }

  return { projects, tree };
}

export async function fetchTree(): Promise<{ sales: TreeBundle; project: TreeBundle }> {
  const [bdmMeta, epMeta, gorMeta, rpMeta, bdmIssues, projectIssues] = await Promise.all([
    fetchProjectMeta("BDM"),
    fetchProjectMeta("EP"),
    fetchProjectMeta("GOR"),
    fetchProjectMeta("RP"),
    searchIssuesWithChangelog('project = BDM AND issuetype = Customer'),
    searchIssuesWithChangelog('project IN (EP, GOR, RP) AND issuetype IN (Epic, Task, Subtask, "Sub-task", Story)'),
  ]);
  const sales = buildProjectTree(new Map([["BDM", bdmMeta]]), bdmIssues, 0, true);
  const project = buildProjectTree(
    new Map([["EP", epMeta], ["GOR", gorMeta], ["RP", rpMeta]]),
    projectIssues,
    1, // offset so project palette starts at a different color than sales
    false,
  );
  return { sales, project };
}
