#!/usr/bin/env node
/**
 * Momentum OS — Local Stdio MCP Bridge for Claude Desktop / Cursor / Antigravity
 * Forwards JSON-RPC 2.0 MCP requests over stdio to your Momentum OS Supabase MCP endpoint.
 *
 * Usage in claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "momentum-os": {
 *       "command": "node",
 *       "args": ["d:/Projects/Momentum/mcp-server/index.mjs"],
 *       "env": {
 *         "MOMENTUM_MCP_URL": "https://<project>.supabase.co/functions/v1/momentum-mcp",
 *         "MOMENTUM_BRIDGE_TOKEN": "mom_<userId>_<secret>"
 *       }
 *     }
 *   }
 * }
 */

import readline from 'node:readline';

const MCP_URL = process.env.MOMENTUM_MCP_URL || '';
const BRIDGE_TOKEN = process.env.MOMENTUM_BRIDGE_TOKEN || '';

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let rpc;
  try {
    rpc = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (!MCP_URL || !BRIDGE_TOKEN) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id ?? null,
        error: {
          code: -32000,
          message: 'Set MOMENTUM_MCP_URL and MOMENTUM_BRIDGE_TOKEN environment variables from Momentum OS Settings.'
        }
      }) + '\n'
    );
    return;
  }

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BRIDGE_TOKEN}`
      },
      body: JSON.stringify(rpc)
    });
    const data = await res.json();
    process.stdout.write(JSON.stringify(data) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: rpc.id ?? null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Failed to reach Momentum MCP endpoint'
        }
      }) + '\n'
    );
  }
});
