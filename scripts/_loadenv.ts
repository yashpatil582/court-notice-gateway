/**
 * Load .env.local with override — so a stale shell-level env var doesn't
 * shadow the project's local config. Import this FIRST in any CLI script.
 *
 * Next.js itself loads .env.local with override in dev/build, so this brings
 * CLI scripts in line with how the app sees env at runtime.
 */
import { config } from 'dotenv';
// quiet: true keeps stdout clean — required because the MCP server writes
// JSON-RPC frames to stdout. Any non-JSON line breaks the client.
config({ path: '.env.local', override: true, quiet: true });
config({ path: '.env', quiet: true });
