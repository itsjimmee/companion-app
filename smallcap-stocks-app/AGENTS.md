# SmallCap Stocks App — Agent Notes

Expo SDK **54** (not 57). Docs: https://docs.expo.dev/versions/v54.0.0/

App lives in `smallcap-stocks-app/`. Reference Python repos clone to `reference/` on Cloud Agent boot.

## Cursor Cloud setup (required once)

### Step 1 — Polygon API key (Secrets)

1. Open **https://cursor.com/dashboard/cloud-agents**
2. Select your environment (or create one for `itsjimmee/companion-app`)
3. Open **Secrets** (or Runtime secrets / Environment variables)
4. Add **both** of these with your Polygon key (same value for each):

| Name | Type | Why |
|------|------|-----|
| `POLYGON_API_KEY` | **Runtime Secret** | Used by Node scripts + `apiKeys.ts` fallback |
| `EXPO_PUBLIC_POLYGON_API_KEY` | **Runtime Secret** | Expo inlines `EXPO_PUBLIC_*` at bundle time |

5. **Save**, then start a **new** Cloud Agent (existing agents do not pick up new secrets)
6. Verify in the agent terminal:

```bash
cd smallcap-stocks-app && node scripts/verify-polygon.mjs
```

Expected: `✅ Polygon API key is valid.`

**Optional:** add `EXPO_PUBLIC_ASKEDGAR_API_KEY` for rich premarket/afterhours tables from AskEdgar.

### Step 2 — Grant access to `ticker-card-gui` (private)

The Cloud Agent token for `companion-app` cannot read `itsjimmee/ticker-card-gui` until you grant access. Pick **one** option:

#### Option A — GitHub App (recommended)

1. Go to **https://github.com/settings/installations**
2. Find **Cursor** → click **Configure**
3. Under **Repository access**, choose **Only select repositories**
4. Add **`ticker-card-gui`** (and keep `companion-app`, `historical-gap-chart-viewer-public`)
5. Save

Then add repos to a **multi-repo environment**:

1. **https://cursor.com/dashboard/cloud-agents** → your environment
2. **Repositories** → add:
   - `itsjimmee/companion-app` (main workspace)
   - `itsjimmee/ticker-card-gui`
   - `itsjimmee/historical-gap-chart-viewer-public`
3. Save and start a new agent

#### Option B — Personal Access Token (fallback)

1. GitHub → **Settings → Developer settings → Fine-grained tokens** (or classic PAT)
2. Scope: **repo** access to `ticker-card-gui`
3. In Cursor Cloud Agents → Secrets, add:

| Name | Type |
|------|------|
| `GITHUB_PAT` | **Runtime Secret** |

4. New agent runs `scripts/setup-reference-repos.sh` and clones to `reference/ticker-card-gui/`

#### Option C — Copy V08 into companion-app (no GitHub changes)

Copy `Ticker Card GUI V08.py` to:

```
reference/ticker-card-gui/Ticker Card GUI V08.py
```

Commit to `companion-app` (or a branch) so the agent can read it without private repo access.

### Reference repos

| Repo | URL | Role |
|------|-----|------|
| Gap viewer | https://github.com/itsjimmee/historical-gap-chart-viewer-public | `polygon_scan.py`, charts |
| Ticker Card V08 | https://github.com/itsjimmee/ticker-card-gui (private) | Scanner UI + card layout |

## Development

```bash
cd smallcap-stocks-app
npm install
npm start          # Expo Go 54 on iPhone
node scripts/verify-polygon.mjs
```

Key services: `polygonScanService.ts`, `gapStatsService.ts`, `tickerOverviewService.ts`, `gapChartService.ts`.
