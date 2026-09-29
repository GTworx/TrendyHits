// System prompts are read straight from prompt/*.md so the spec stays the single source of truth.
import { readFileSync } from 'node:fs';

function codeBlock(file, fence, index = 0) {
  const md = readFileSync(file, 'utf8');
  const re = new RegExp(`${fence}markdown\\r?\\n([\\s\\S]*?)\\r?\\n${fence}(?!\`)`, 'g');
  const blocks = [...md.matchAll(re)].map((m) => m[1]);
  if (!blocks[index]) throw new Error(`Prompt block #${index} not found in ${file}`);
  return blocks[index];
}

/** "TrendyHits 1.md" – Section 2: Orchestrator system prompt */
export const ORCHESTRATOR_PROMPT = codeBlock('prompt/TrendyHits 1.md', '```', 0);

/** "TrendyHits 2.md" – Section 4: Newsletter agent system prompt */
export const NEWSLETTER_PROMPT = codeBlock('prompt/TrendyHits 2.md', '````', 0);
