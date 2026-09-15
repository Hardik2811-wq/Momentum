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
