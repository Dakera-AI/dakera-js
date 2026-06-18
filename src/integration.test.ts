/**
 * Integration tests against a real Dakera server (Docker service in CI).
 *
 * Requires DAKERA_TEST_URL env var pointing to a running Dakera instance.
 * Auth is enabled — set DAKERA_API_KEY to a valid key (default: test-key).
 *
 * Run locally: DAKERA_TEST_URL=http://localhost:3000 DAKERA_API_KEY=test-key npx vitest run src/integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DakeraClient } from "./client";
import { AuthenticationError } from "./errors";
import { ChatMemorySession } from "./session";

const DAKERA_URL = process.env.DAKERA_TEST_URL || "http://localhost:3000";
const TEST_NAMESPACE = `integ-${crypto.randomUUID().slice(0, 8)}`;
const TEST_AGENT = `integ-agent-${crypto.randomUUID().slice(0, 8)}`;

const skip = !process.env.DAKERA_TEST_URL;

function describeIntegration(name: string, fn: () => void) {
  if (skip) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

let client: DakeraClient;

beforeAll(async () => {
  if (skip) return;
  client = new DakeraClient({ baseUrl: DAKERA_URL, apiKey: process.env.DAKERA_API_KEY || "test-key" });
  await client.createNamespace(TEST_NAMESPACE, { dimensions: 1024 });
});

afterAll(async () => {
  if (skip) return;
  try {
    await client.deleteNamespace(TEST_NAMESPACE);
  } catch {
    // ignore cleanup errors
  }
});

describeIntegration("Health", () => {
  it("returns ok status", async () => {
    const result = await client.health();
    expect(result.status).toBe("healthy");
  });
});

describeIntegration("Namespaces", () => {
  it("creates a namespace", async () => {
    const ns = `integ-create-${crypto.randomUUID().slice(0, 8)}`;
    const result = await client.createNamespace(ns, { dimensions: 1024 });
    expect(result.namespace).toBe(ns);
    await client.deleteNamespace(ns);
  });

  it("lists namespaces", async () => {
    const namespaces = await client.listNamespaces();
    const names = namespaces.map((ns) => ns.namespace);
    expect(names).toContain(TEST_NAMESPACE);
  });

  it("gets a namespace", async () => {
    const ns = await client.getNamespace(TEST_NAMESPACE);
    expect(ns.namespace).toBe(TEST_NAMESPACE);
    expect(ns.dimension).toBe(1024);
  });

  it("configures a namespace", async () => {
    const result = await client.configureNamespace(TEST_NAMESPACE, {
      dimension: 1024,
    });
    expect(result).toBeDefined();
    expect(result.namespace).toBe(TEST_NAMESPACE);
  });

  it("deletes a namespace", async () => {
    const ns = `integ-del-${crypto.randomUUID().slice(0, 8)}`;
    await client.createNamespace(ns, { dimensions: 1024 });
    await client.deleteNamespace(ns);
    const namespaces = await client.listNamespaces();
    const names = namespaces.map((n) => n.namespace);
    expect(names).not.toContain(ns);
  });
});

describeIntegration("Memory CRUD", () => {
  it("stores a memory", async () => {
    const result = await client.storeMemory(TEST_AGENT, {
      content: "The user prefers dark mode interfaces",
      importance: 0.8,
      metadata: { tags: ["preference", "ui"] },
    });
    expect(result.memory.id).toBeDefined();
  });

  it("recalls memories semantically", async () => {
    await client.storeMemory(TEST_AGENT, {
      content: "Python is the user's primary programming language",
      importance: 0.9,
      metadata: { tags: ["preference", "coding"] },
    });
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.recall(TEST_AGENT, "programming language");
    expect(results.memories.length).toBeGreaterThan(0);
  });

  it("batch recalls memories", async () => {
    const result = await client.batchRecall({
      agent_id: TEST_AGENT,
      filter: { min_importance: 0.5 },
    });
    expect(result.memories).toBeDefined();
    expect(result.memories.length).toBeGreaterThan(0);
  });

  it("gets a memory by id", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory for get test",
      importance: 0.7,
    });
    const memory = await client.getMemory(TEST_AGENT, stored.memory.id);
    expect(memory).toBeDefined();
  });

  it("updates memory importance", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory for importance update",
      importance: 0.5,
    });
    const result = await client.updateImportance(TEST_AGENT, {
      memory_ids: [stored.memory.id],
      importance: 0.95,
    });
    expect(result).toBeDefined();
  });

  it("forgets a memory", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory to forget",
      importance: 0.3,
    });
    const result = await client.forget(TEST_AGENT, stored.memory.id);
    expect(result).toBeDefined();
  });
});

describeIntegration("Sessions / ChatMemorySession", () => {
  it("full round-trip: create → store → recall → close", async () => {
    const agentId = `integ-session-${crypto.randomUUID().slice(0, 8)}`;
    const session = await ChatMemorySession.create(client, agentId);
    expect(session.sessionId).toBeTruthy();
    expect(session.agentId).toBe(agentId);

    // Store two conversation turns
    const r1 = await session.store("user", "My favourite colour is cobalt blue.");
    expect(r1).toBeDefined();

    const r2 = await session.store("assistant", "Noted — cobalt blue is vivid.", { importance: 0.5 });
    expect(r2).toBeDefined();

    // Allow indexing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Recall should surface relevant memories
    const memories = await session.recall("favourite colour");
    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBeGreaterThan(0);

    // Close session cleanly
    await session.close();
  });

  it("async context-manager pattern (try/finally)", async () => {
    const agentId = `integ-ctx-${crypto.randomUUID().slice(0, 8)}`;
    const session = await ChatMemorySession.create(client, agentId);
    try {
      await session.store("user", "Testing the session context pattern.");
      const memories = await session.recall("session context");
      expect(Array.isArray(memories)).toBe(true);
    } finally {
      await session.close();
    }
  });
});

describeIntegration("Vectors / Text", () => {
  it("upserts text documents", async () => {
    const result = await client.upsertText(TEST_NAMESPACE, [
      { id: "doc-1", text: "Machine learning transforms data into insights" },
      { id: "doc-2", text: "Natural language processing understands text" },
      { id: "doc-3", text: "Deep learning uses neural networks" },
    ]);
    expect(result).toBeDefined();
  });

  it("queries text", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const result = await client.queryText(
      TEST_NAMESPACE,
      "AI neural networks",
      { topK: 3 },
    );
    expect(result).toBeDefined();
  });

  it("performs hybrid search", async () => {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.hybridSearch(
      TEST_NAMESPACE,
      "machine learning data",
      { topK: 3 },
    );
    expect(results).toBeDefined();
  });

  it("performs fulltext search", async () => {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.fulltextSearch(TEST_NAMESPACE, "neural networks", {
      topK: 3,
    });
    expect(results).toBeDefined();
  });

  it("batch queries text", async () => {
    const result = await client.batchQueryText(
      TEST_NAMESPACE,
      ["machine learning", "deep learning"],
      { topK: 2 },
    );
    expect(result).toBeDefined();
  });
});

describeIntegration("Knowledge Graph", () => {
  it("gets memory graph", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Knowledge graph integration test",
      importance: 0.8,
    });
    await new Promise((r) => setTimeout(r, 500));
    const result = await client.memoryGraph(stored.memory.id, { depth: 1 });
    expect(result).toBeDefined();
  });

  it("extracts entities", async () => {
    const result = await client.extractEntities(
      "OpenAI released GPT-4 in San Francisco",
    );
    expect(result).toBeDefined();
  });
});

describeIntegration("Consolidate", () => {
  it("consolidates similar memories", async () => {
    for (let i = 0; i < 3; i++) {
      await client.storeMemory(TEST_AGENT, {
        content: `Consolidation test variation ${i}: similar content about testing`,
        importance: 0.6,
      });
    }
    await new Promise((r) => setTimeout(r, 500));
    const result = await client.consolidate(TEST_AGENT);
    expect(result).toBeDefined();
  });
});

describeIntegration("Error Handling", () => {
  it("throws on nonexistent namespace", async () => {
    await expect(
      client.getNamespace("nonexistent-ns-xyz-99999"),
    ).rejects.toThrow();
  });

  it("throws on nonexistent memory", async () => {
    await expect(
      client.getMemory(TEST_AGENT, "nonexistent-memory-id"),
    ).rejects.toThrow();
  });
});

describeIntegration("Authentication", () => {
  it("rejects requests with invalid API key", async () => {
    const badClient = new DakeraClient({ baseUrl: DAKERA_URL, apiKey: "invalid-key-xxx" });
    await expect(badClient.listNamespaces()).rejects.toThrow(AuthenticationError);
  });

  it("accepts requests with valid API key", async () => {
    const namespaces = await client.listNamespaces();
    expect(Array.isArray(namespaces)).toBe(true);
  });
});
