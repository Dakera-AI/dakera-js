/**
 * Playground scenario integration tests for the Dakera JS SDK.
 *
 * Validates the core store→recall→search→KG-link workflow that the playground
 * quickstart demonstrates. Tests are skipped unless DAKERA_TEST_URL is set.
 *
 * Run:
 *   DAKERA_TEST_URL=http://localhost:3000 DAKERA_API_KEY=test-key \
 *     npx vitest run src/playground_integration.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DakeraClient } from "./client";

const DAKERA_URL = process.env.DAKERA_TEST_URL ?? "http://localhost:3000";
const AGENT_ID = `playground-integ-${crypto.randomUUID().slice(0, 8)}`;

const skip = !process.env.DAKERA_TEST_URL;

function describeIntegration(name: string, fn: () => void) {
  if (skip) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

let client: DakeraClient;
let mem1Id: string;
let mem2Id: string;

beforeAll(async () => {
  if (skip) return;
  client = new DakeraClient({
    baseUrl: DAKERA_URL,
    apiKey: process.env.DAKERA_API_KEY ?? "test-key",
  });
});

describeIntegration("Playground workflow — store → recall → search → KG link", () => {
  it("step 1: stores two memories with tags", async () => {
    const mem1 = await client.storeMemory(AGENT_ID, {
      content: "Dakera provides persistent, decay-weighted memory for AI agents.",
      memory_type: "semantic",
      importance: 0.9,
      tags: ["dakera", "memory", "overview"],
    });
    expect(mem1.memory.id).toBeTruthy();
    mem1Id = mem1.memory.id;

    const mem2 = await client.storeMemory(AGENT_ID, {
      content: "The recall API returns semantically similar memories ranked by relevance.",
      memory_type: "semantic",
      importance: 0.8,
      tags: ["dakera", "recall", "api"],
    });
    expect(mem2.memory.id).toBeTruthy();
    mem2Id = mem2.memory.id;
  });

  it("step 2: recalls memories by semantic query", async () => {
    const recalled = await client.recall(AGENT_ID, "How does Dakera memory work?", {
      top_k: 5,
    });
    expect(recalled.memories.length).toBeGreaterThanOrEqual(1);
    for (const m of recalled.memories) {
      expect(m.content).toBeTruthy();
    }
  });

  it("step 3: searches memories with memory_type filter", async () => {
    const results = await client.searchMemories(AGENT_ID, "memory API", {
      memory_type: "semantic",
      top_k: 5,
    });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const m of results) {
      expect(m.content).toBeTruthy();
    }
  });

  it("step 4: links two memories with a related_to KG edge", async () => {
    expect(mem1Id).toBeTruthy();
    expect(mem2Id).toBeTruthy();

    const link = await client.memoryLink(mem1Id, mem2Id, "related_to");
    expect(link.edge).toBeDefined();
    expect(link.edge?.edge_type).toBe("related_to");
  });
});
