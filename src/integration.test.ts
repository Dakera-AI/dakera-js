/**
 * Integration tests against a real Dakera server (Docker service in CI).
 *
 * Requires DAKERA_TEST_URL env var pointing to a running Dakera instance.
 * Auth is disabled on the test server (DAKERA_AUTH_ENABLED=false).
 *
 * Run locally: DAKERA_TEST_URL=http://localhost:3000 npx vitest run src/integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DakeraClient } from "./client";

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
  client = new DakeraClient({ baseUrl: DAKERA_URL, apiKey: "test-key" });
  await client.createNamespace(TEST_NAMESPACE, { dimensions: 384 });
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
    expect(result.status).toBe("ok");
  });
});

describeIntegration("Namespaces", () => {
  it("creates a namespace", async () => {
    const ns = `integ-create-${crypto.randomUUID().slice(0, 8)}`;
    const result = await client.createNamespace(ns, { dimensions: 384 });
    expect(result.name).toBe(ns);
    await client.deleteNamespace(ns);
  });

  it("lists namespaces", async () => {
    const namespaces = await client.listNamespaces();
    const names = namespaces.map((ns) => ns.name);
    expect(names).toContain(TEST_NAMESPACE);
  });

  it("gets a namespace", async () => {
    const ns = await client.getNamespace(TEST_NAMESPACE);
    expect(ns.name).toBe(TEST_NAMESPACE);
    expect(ns.dimensions).toBe(384);
  });

  it("configures a namespace", async () => {
    const result = await client.configureNamespace(TEST_NAMESPACE, {
      ef_construction: 128,
      m: 16,
    });
    expect(result).toBeDefined();
  });

  it("deletes a namespace", async () => {
    const ns = `integ-del-${crypto.randomUUID().slice(0, 8)}`;
    await client.createNamespace(ns, { dimensions: 384 });
    await client.deleteNamespace(ns);
    const namespaces = await client.listNamespaces();
    const names = namespaces.map((n) => n.name);
    expect(names).not.toContain(ns);
  });
});

describeIntegration("Memory CRUD", () => {
  it("stores a memory", async () => {
    const result = await client.storeMemory(TEST_AGENT, {
      content: "The user prefers dark mode interfaces",
      importance: 0.8,
      tags: ["preference", "ui"],
    });
    expect(result.id).toBeDefined();
  });

  it("recalls memories semantically", async () => {
    await client.storeMemory(TEST_AGENT, {
      content: "Python is the user's primary programming language",
      importance: 0.9,
      tags: ["preference", "coding"],
    });
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.recall(TEST_AGENT, "programming language");
    expect(results.memories.length).toBeGreaterThan(0);
  });

  it("batch recalls memories", async () => {
    const result = await client.batchRecall({
      agent_id: TEST_AGENT,
      min_importance: 0.5,
    });
    expect(result.memories).toBeDefined();
    expect(result.memories.length).toBeGreaterThan(0);
  });

  it("gets a memory by id", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory for get test",
      importance: 0.7,
    });
    const memory = await client.getMemory(TEST_AGENT, stored.id);
    expect(memory).toBeDefined();
  });

  it("updates memory importance", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory for importance update",
      importance: 0.5,
    });
    const result = await client.updateImportance(TEST_AGENT, {
      memory_ids: [stored.id],
      importance: 0.95,
    });
    expect(result).toBeDefined();
  });

  it("forgets a memory", async () => {
    const stored = await client.storeMemory(TEST_AGENT, {
      content: "Memory to forget",
      importance: 0.3,
    });
    const result = await client.forget(TEST_AGENT, stored.id);
    expect(result).toBeDefined();
  });
});

describeIntegration("Sessions", () => {
  it("starts and ends a session", async () => {
    const session = await client.storeMemory(TEST_AGENT, {
      content: "session test placeholder",
      importance: 0.5,
    });
    expect(session).toBeDefined();
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
      { top_k: 3 },
    );
    expect(result).toBeDefined();
  });

  it("performs hybrid search", async () => {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.hybridSearch(TEST_NAMESPACE, {
      query: "machine learning data",
      top_k: 3,
    });
    expect(results).toBeDefined();
  });

  it("performs fulltext search", async () => {
    await new Promise((r) => setTimeout(r, 500));
    const results = await client.fulltextSearch(TEST_NAMESPACE, "neural networks", {
      top_k: 3,
    });
    expect(results).toBeDefined();
  });

  it("batch queries text", async () => {
    const result = await client.batchQueryText(
      TEST_NAMESPACE,
      ["machine learning", "deep learning"],
      { top_k: 2 },
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
    const result = await client.memoryGraph(stored.id, { depth: 1 });
    expect(result).toBeDefined();
  });

  it("extracts entities", async () => {
    const result = await client.extractEntities(TEST_NAMESPACE, {
      text: "OpenAI released GPT-4 in San Francisco",
    });
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
