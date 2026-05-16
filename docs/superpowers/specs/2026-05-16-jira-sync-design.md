# Jira Sync — Design Spec
Date: 2026-05-16

## Summary

Replace static SEED data with live Jira data from one Sales project (BDM) and three Project pipelines (EP, GOR, RP). Sync every 30 minutes with manual refresh button. Fall back to SEED on API failure. Replace hardcoded pipeline stage lists with status lists fetched dynamically per project.

---

## Data Sources

| Pipeline | Jira Project Key | Issue Type |
|----------|-----------------|------------|
| Sales (`sales`) | `BDM` | `Customer` |
| Projects (`project`) | `EP`, `GOR`, `RP` | `Epic` |
| Partnership (`partnership`) | _(hidden — removed from UI for this iteration)_ | — |

Note: BDM has no Epic issuetype. Customer is the deal entity.

---

## Field Mapping (Jira → Deal)

| Deal field | Jira source | Notes |
|-----------|-------------|-------|
| `id` | `issue.key` (e.g. `BDM-45`) | Stable key |
| `pid` | derived from project | BDM→`sales`, RP/PPOBNEW/GOR→`project` |
| `name` | `fields.summary` | |
| `stage` | `fields.status.name` | Verbatim Jira status |
| `owner` | `fields.assignee.displayName` | `""` if unassigned |
| `pri` | `fields.priority.name` mapped | See priority map |
| `val` | `0` | No monetary custom field in BDM. Hardcode `0`. |
| `notes` | _(empty)_ | Skipped — `notes:""` for all Jira deals |
| `at` | `fields.customfield_10015` (Start date) || `fields.created` (date portion) | |
| `dueDate` | `fields.duedate` | `null`→omit |
| `hist` | `[]` empty | Skipped per scope |

**Priority map:** `Highest`→`Critical`, `High`→`High`, `Medium`→`Medium`, `Low`/`Lowest`→`Low`, _else_→`Medium`.

**ADF→text:** walk `description.content[].content[].text`, join with space, slice 300.

---

## Stage Lists

Replace hardcoded `PIPES[i].stages` with statuses fetched from Jira `/rest/api/3/project/{key}/statuses`.

- **Sales stages:** `BDM` statuses for `Customer` issuetype, in API order
  - Expected: `New`, `Follow-up`, `Proposal`, `Negotiation`, `Contract Sent`, `Closed Won`, `Closed Lost`
- **Project stages:** union of statuses across `EP`, `GOR`, `RP` for `Epic` issuetype, deduplicated, in first-seen order
  - Expected: `To Do`, `In Progress`, `Review`, `Ready To Deploy`, `STG / READY TO DEPLOY`, `Testing QA`, `Ready For Deployment`, `Delay`, `delay`, `On Hold`, `Done`, `Dropped`
- **Partnership stages:** N/A — pipeline hidden

---

## API Route — `app/api/jira/deals/route.ts`

GET only. Query params: `?refresh=1` bypasses cache.

**Response shape:**
```ts
{
  ok: true,
  syncedAt: string,           // ISO timestamp
  source: "jira" | "cache",
  deals: Deal[],
  salesStages: string[],
  projectStages: string[],
}
// or on error:
{ ok: false, error: string, syncedAt: null }
```

**Auth:** `Authorization: Basic base64(JIRA_EMAIL:JIRA_API_TOKEN)`. Reads from `process.env`.

**Cache:** module-level `let cache: { data, expiresAt }` — TTL 30 min. Server restart clears.

**Endpoints called (per request, parallel):**
1. `GET /rest/api/3/project/BDM/statuses` → Customer statuses
2. `GET /rest/api/3/project/RP/statuses`, `PPOBNEW/statuses`, `GOR/statuses` → Epic statuses union
3. `GET /rest/api/3/search/jql?jql=project=BDM AND issuetype=Customer&fields=summary,status,assignee,priority,duedate,created,customfield_10015&maxResults=100` (paginate via `nextPageToken`)
4. `GET /rest/api/3/search/jql?jql=project IN (RP,PPOBNEW,GOR) AND issuetype=Epic&fields=...` (paginate)

**Failure:** if any call throws, return `{ok:false, error}`. Client handles fallback.

---

## Client Integration — `app/page.tsx`

### State

```ts
const [deals, setDeals]   = useState<Deal[]>(SEED);
const [stages, setStages] = useState<{sales:string[]|null, project:string[]|null}>({sales:null, project:null});
const [sync, setSync]     = useState<{at:string|null, ok:boolean, loading:boolean}>({at:null, ok:false, loading:true});
```

### Fetch logic

- `fetchJira(force?:boolean)` calls `/api/jira/deals${force?'?refresh=1':''}`
  - On `ok:true` → `deals = jira.deals`, set stages, sync OK
  - On `ok:false` → keep current deals (SEED-without-partnership on first load), sync error
- `useEffect(() => { fetchJira(); const i = setInterval(()=>fetchJira(), 30*60*1000); return ()=>clearInterval(i); }, [])`

### Pipeline visibility + stages override

Filter `PIPES` at render time: `const VISIBLE_PIPES = PIPES.filter(p => p.id !== "partnership")`.

SEED filtered too: `SEED.filter(d => d.pid !== "partnership")` for fallback.

`PIPES` stages become dynamic when Jira stages loaded:
```ts
const pipelineStages = (pid: string): string[] => {
  if (pid === "sales"   && stages.sales)   return stages.sales;
  if (pid === "project" && stages.project) return stages.project;
  return PIPES.find(p=>p.id===pid)!.stages;
};
```

All callsites that read `pipeline.stages` switch to `pipelineStages(pipeline.id)`.

### UI additions

In the header bar (near Clock or above pipeline tabs):

```
🔄 Refresh   ⏱ Synced 12:34 (Jira)        [or]   ⚠ Offline — using local data
```

- Refresh button: calls `fetchJira(true)`, shows spinner while loading
- Status pill: green when `sync.ok`, red when error
- Time format: `HH:MM` 24h, local

---

## Local Edit Behavior

Local `addDeal` / `updateDeal` continue to work on client state. **They are not pushed back to Jira** (out of scope). Next sync from Jira will overwrite Jira-sourced deals — that is acceptable for this iteration (read-only sync).

---

## Environment

`.env.local`:
```
JIRA_BASE_URL=linkit360.atlassian.net
JIRA_EMAIL=aldo.bangsawan@linkit360.com
JIRA_API_TOKEN=<token>
```

All three required by API route. Server returns `ok:false, error:"missing env"` if any absent.

---

## Out of Scope

- Writing back to Jira (status changes stay local)
- Pulling Jira changelog into `hist`
- Caching across server restarts (in-memory only)
- Sprint or board integration
- Pulling subtasks / stories under epics
- Multi-tenancy / multiple Jira workspaces
