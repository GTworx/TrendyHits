// Loads .env locally (CI passes real env vars). Existing env vars win.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch (e) {
    console.warn('Could not load .env:', e.message);
  }
}

export const args = new Set(process.argv.slice(2));
export const argValue = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

export const log = (agent, ...msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${agent.padEnd(12)}│`, ...msg);
