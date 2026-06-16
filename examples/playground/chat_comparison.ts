/**
 * LLM Chat Comparison — with and without Dakera memory
 *
 * Demonstrates the pattern used by the Dakera playground: run the same user
 * query through two paths and compare responses.
 *
 *   Path A (memory-augmented) — recall relevant context, prepend to prompt
 *   Path B (baseline)         — send the raw prompt with no memory context
 *
 * Run:
 *   DAKERA_URL=https://5-75-177-31.sslip.io DAKERA_API_KEY=<key> npx ts-node examples/playground/chat_comparison.ts
 */

import { DakeraClient, ChatMemorySession } from '../../src';
import type { RecalledMemory } from '../../src';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const DAKERA_URL = process.env.DAKERA_URL ?? 'http://localhost:3000';
const DAKERA_API_KEY = process.env.DAKERA_API_KEY;
const AGENT_ID = 'playground-demo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContextPrompt(memories: RecalledMemory[], userMessage: string): string {
  if (!memories.length) return userMessage;
  const contextLines = memories.map((m) => `- ${m.content}`).join('\n');
  return `[Relevant context from memory]\n${contextLines}\n\n[User message]\n${userMessage}`;
}

function callLlm(prompt: string): string {
  /**
   * Placeholder for any LLM call. Replace with your preferred provider.
   *
   * Example with OpenAI:
   *
   * ```typescript
   * import OpenAI from 'openai';
   * const openai = new OpenAI();
   * const resp = await openai.chat.completions.create({
   *   model: 'gpt-4o-mini',
   *   messages: [{ role: 'user', content: prompt }],
   * });
   * return resp.choices[0].message.content ?? '';
   * ```
   */
  if (prompt.includes('[Relevant context from memory]')) {
    return 'I recall you mentioned this before. Here is a context-aware answer.';
  }
  return 'I have no prior context. Here is a generic answer.';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const client = new DakeraClient({ baseUrl: DAKERA_URL, apiKey: DAKERA_API_KEY });

  console.log('=== Dakera Playground — LLM Chat Comparison Demo ===\n');

  // ------------------------------------------------------------------
  // Step 1: Seed some prior conversation turns
  // ------------------------------------------------------------------
  console.log('Seeding prior conversation turns into Dakera memory...');
  const seedSession = await ChatMemorySession.create(client, AGENT_ID, {
    source: 'playground-seed',
  });
  try {
    await seedSession.store('user', "I'm building a chatbot in TypeScript using LangChain.");
    await seedSession.store('assistant', 'Great choice — LangChain has excellent memory integrations.');
    await seedSession.store('user', 'My team prefers async code so we use Fastify on the backend.');
    console.log(`  Session ${seedSession.sessionId}: stored 3 turns\n`);
  } finally {
    await seedSession.close();
  }

  // ------------------------------------------------------------------
  // Step 2: Start a new session and compare responses
  // ------------------------------------------------------------------
  const followUp = 'What framework should I use for the async background tasks?';
  const compareSession = await ChatMemorySession.create(client, AGENT_ID, {
    source: 'playground-compare',
  });

  try {
    console.log(`Comparison session: ${compareSession.sessionId}`);
    console.log(`User: ${followUp}\n`);

    // Path A — memory-augmented
    const memories = await compareSession.recall(followUp, { topK: 5 });
    const augmentedPrompt = buildContextPrompt(memories, followUp);
    const responseWithMemory = callLlm(augmentedPrompt);

    // Path B — baseline (no memory)
    const responseWithoutMemory = callLlm(followUp);

    // Store the actual exchange
    await compareSession.store('user', followUp);
    await compareSession.store('assistant', responseWithMemory);

    // ------------------------------------------------------------------
    // Step 3: Print side-by-side comparison
    // ------------------------------------------------------------------
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  WITHOUT Dakera memory                                      │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  ${responseWithoutMemory}`);
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  WITH Dakera memory                                         │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  ${responseWithMemory}`);
    console.log('└─────────────────────────────────────────────────────────────┘');

    if (memories.length) {
      console.log(`\n  Memory used: ${memories.length} relevant context item(s)`);
      for (const m of memories) {
        console.log(`    • [${(m.score ?? 0).toFixed(2)}] ${m.content.slice(0, 80)}`);
      }
    }
  } finally {
    await compareSession.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
