# Momentum - Personal Productivity OS

React/Vite personal productivity app. Root-level static HTML files are legacy design exports; `src/` is production app.

## Features
- **Dashboard**: High-level daily brief, metrics, active streak, focus dials, goals pacing.
  - Light mode: `dashboard.html` / `index.html`
  - Pro Dark mode: `dashboard-dark.html`
- **Today**: Deep work tracking, energy windows, context filters (@Laptop, @Calls, @Home), daily backlog.
  - Light mode: `today.html`
  - Pro Dark mode: `today-dark.html`
- **Goals & Horizons**: Horizon segmentation (Quarter, Year, 5-Year Vision) and active milestone tracking (`goals.html`).
- **Habits & Streaks**: Micro-habits, frequency heatmaps, streak tracking (`habits.html`).
- **Analytics**: Cognitive flow metrics, deep work hours, velocity analysis (`analytics.html`).

## MCP Server Integration
Stitch AI MCP server config lives in `mcp_config.json`.

Set `STITCH_API_KEY` outside repository before use. Never commit credential values.

Endpoint template:
```json
{
  "mcpServers": {
    "stitch": {
      "serverUrl": "https://stitch.googleapis.com/mcp",
      "headers": { "X-Goog-Api-Key": "${STITCH_API_KEY}" }
    }
  }
}
```

## Running the Application
Run the local web server:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

## Secure AI deployment

Do not add a Groq key to `.env`, `VITE_*` variables, browser storage, or workspace snapshots.
Each user supplies their own Groq key through an authenticated BYOK flow. The browser sends it once over TLS. The server validates it, encrypts it, and stores ciphertext only.

1. Apply Supabase migrations, including `202609290001_secure_ai_proxy.sql`.
2. Deploy `supabase/functions/groq-proxy` and `supabase/functions/byok-credentials` with JWT verification enabled.
3. Set Edge Function secrets: `ALLOWED_ORIGIN`, `ACTIVE_BYOK_KEY_VERSION=1`, `BYOK_ENCRYPTION_KEY_V1`, and optionally `GROQ_MODEL`.
4. Set `ALLOWED_ORIGIN` to one exact production origin, for example `https://app.example.com`.
5. Generate `BYOK_ENCRYPTION_KEY_V1` as 32 random bytes encoded in base64. Store it only in Edge Function secrets.
6. Do not set `GROQ_API_KEY` in any Vite or server environment.

The functions reject unauthenticated users, wrong origins, oversized prompts, unsupported methods, and excessive AI/key-change requests. Configure platform-level WAF, rate limiting, TLS, security headers, logs, and alerting before public launch.
