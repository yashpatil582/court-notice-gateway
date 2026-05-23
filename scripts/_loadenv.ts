/**
 * Load .env.local with override — so a stale shell-level env var doesn't
 * shadow the project's local config. Import this FIRST in any CLI script.
 *
 * Next.js itself loads .env.local with override in dev/build, so this brings
 * CLI scripts in line with how the app sees env at runtime.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });
config({ path: '.env' });
