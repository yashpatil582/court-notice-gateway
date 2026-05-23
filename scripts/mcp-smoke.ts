/**
 * Smoke-test the MCP server end-to-end.
 *
 * Spawns the server as a subprocess (the same way Claude Desktop would),
 * lists its tools, then calls each one with sensible defaults.
 *
 * Run: `pnpm tsx scripts/mcp-smoke.ts`
 */
import './_loadenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';

async function main() {
  const transport = new StdioClientTransport({
    command: 'pnpm',
    args: ['tsx', join(__dirname, '..', 'mcp', 'server.ts')],
  });

  const client = new Client({ name: 'court-notice-gateway-smoke', version: '0.1.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(`tools available: ${tools.tools.map((t) => t.name).join(', ')}\n`);

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: 'list_upcoming_hearings', args: { withinDays: 365 } },
    { name: 'get_case_notice_timeline', args: { caseNumber: '25-12345' } },
    { name: 'find_unreviewed_notices', args: { olderThanHours: 0 } },
    { name: 'summarise_recent_discharge_orders', args: { sinceDate: '2020-01-01' } },
  ];

  for (const c of calls) {
    process.stdout.write(`→ ${c.name}(${JSON.stringify(c.args)}) ... `);
    const result = await client.callTool({ name: c.name, arguments: c.args });
    const first = Array.isArray(result.content) ? result.content[0] : null;
    const text = first && 'text' in first ? (first.text as string) : '';
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const count =
      parsed && typeof parsed === 'object' && 'count' in parsed && typeof parsed.count === 'number'
        ? parsed.count
        : null;
    console.log(count != null ? `OK (count=${count})` : `OK`);
  }

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
