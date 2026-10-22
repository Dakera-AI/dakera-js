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
import { AuthenticationError, NotFoundError } from "./errors";
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

describeIntegration("Knowledge graph contract (link, graph, path, export, query, entities)", () => {
  const agent = `integ-kg-${crypto.randomUUID().slice(0, 8)}`;
  let m1 = "";
  let m2 = "";

  beforeAll(async () => {
    if (skip) return;
    m1 = (await client.storeMemory(agent, { content: "Anna lives in Berlin and works at Siemens" })).memory.id;
    m2 = (await client.storeMemory(agent, { content: "Bob met Anna in Paris last spring" })).memory.id;
  });

  it("updates a memory (agent_id in the query string)", async () => {
    const updated = await client.updateMemory(agent, m2, { content: "Bob met Anna in Paris last summer" });
    expect(updated).toBeDefined();
    const got = await client.getMemory(agent, m2);
    expect(JSON.stringify(got)).toContain("last summer");
  });

  it("links two memories with agentId and returns the edge", async () => {
    const link = await client.memoryLink(m1, m2, { agentId: agent, label: "integration" });
    expect(link.from_id).toBe(m1);
    expect(link.to_id).toBe(m2);
    expect(link.edge_type).toBe("linked_by");
    expect(link.edge.source_id).toBe(m1);
    expect(link.edge.target_id).toBe(m2);
  });

  it("traverses the graph from the first memory", async () => {
    const graph = await client.memoryGraph(m1, { depth: 2 });
    expect(graph.root_id).toBe(m1);
    expect(graph.node_count).toBe(graph.nodes.length);
    const ids = graph.nodes.map((n) => n.memory_id);
    expect(ids).toContain(m2);
    const linked = graph.edges.find((e) => e.edge_type === "linked_by" && e.to_id === m2);
    expect(linked).toBeDefined();
    expect(linked?.from_id).toBe(m1);
    expect(linked?.source_id).toBe(m1);
    expect(linked?.weight).toBe(1);
    expect(linked?.created_at).toBeGreaterThan(0);
  });

  it("finds the path between them", async () => {
    const path = await client.memoryPath(m1, m2);
    expect(path.path[0]).toBe(m1);
    expect(path.path[path.path.length - 1]).toBe(m2);
    expect(path.hop_count).toBe(path.path.length - 1);
    expect(path.hops).toBe(path.hop_count);
    expect(path.from_id).toBe(m1);
    expect(path.to_id).toBe(m2);
  });

  it("exports the agent graph", async () => {
    const exp = await client.agentGraphExport(agent);
    expect(exp.agent_id).toBe(agent);
    expect(exp.namespace).toBe(`_dakera_agent_${agent}`);
    expect(exp.edge_count).toBeGreaterThanOrEqual(1);
    expect(exp.edges.some((e) => e.source_id === m1 && e.target_id === m2)).toBe(true);
  });

  it("queries the knowledge graph", async () => {
    const q = await client.knowledgeQuery(agent, { edgeType: "linked_by" });
    expect(q.agent_id).toBe(agent);
    expect(q.edge_count).toBe(q.edges.length);
    expect(q.edges.some((e) => e.from_id === m1 && e.target_id === m2)).toBe(true);
  });

  it("reads a memory's entities", async () => {
    const ents = await client.memoryEntities(m1);
    expect(ents.memory_id).toBe(m1);
    expect(Array.isArray(ents.entities)).toBe(true);
    expect(ents.count).toBe(ents.entities.length);
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

describeIntegration("Sessions / memory listings (every 0.12.x server)", () => {
  it("lists sessions and session memories through the server's wrapped answers", async () => {
    const agentId = `integ-list-${crypto.randomUUID().slice(0, 8)}`;
    const session = await client.startSession(agentId);
    await client.storeMemory(agentId, { content: "A note stored in a listed session.", session_id: session.id });
    const sessions = await client.listSessions({ agent_id: agentId });
    expect(sessions.map((s) => s.id)).toContain(session.id);
    const memories = await client.sessionMemories(session.id);
    expect(memories.length).toBeGreaterThan(0);
    await client.endSession(session.id);
  });
});

// Server v0.12.2 additions. Each test returns early against an older server
// (capabilities_version < 2), so the suite stays green on 0.12.0 / 0.12.1.
describeIntegration("Server v0.12.2 (agents, whoami, session lifecycle, previews)", () => {
  let v0122 = false;

  beforeAll(async () => {
    const caps = await client.capabilities({ refresh: true });
    v0122 = caps.capabilities_version >= 2 && caps.sessions !== undefined;
  });

  it("whoami describes the root key", async () => {
    if (!v0122) return;
    const me = await client.whoami();
    expect(me.auth_enabled).toBe(true);
    expect(me.unrestricted).toBe(true);
    expect(me.grants_version).toBe(1);
  });

  it("createAgent creates once, then answers created: false", async () => {
    if (!v0122) return;
    const agentId = `integ-new-${crypto.randomUUID().slice(0, 8)}`;
    const first = await client.createAgent(agentId);
    expect(first.created).toBe(true);
    expect(first.namespace).toBe(`_dakera_agent_${agentId}`);
    const second = await client.createAgent(agentId);
    expect(second.created).toBe(false);
  });

  it("start with idle_timeout_secs, touch, end, touch again", async () => {
    if (!v0122) return;
    const agentId = `integ-idle-${crypto.randomUUID().slice(0, 8)}`;
    const session = await client.startSession(agentId, undefined, { idle_timeout_secs: 3600 });
    expect(session.idle_timeout_secs).toBe(3600);
    expect(session.last_activity_at).toBe(session.started_at);

    const touched = await client.touchSession(session.id);
    expect(touched.session_state).toBe("active");
    expect(typeof touched.idle_deadline_at).toBe("number");

    const stored = await client.storeMemory(agentId, { content: "Stored with the session.", session_id: session.id });
    expect(stored.session_state).toBe("active");

    const ended = await client.endSession(session.id);
    expect(ended.session.ended_reason).toBe("client");

    const after = await client.touchSession(session.id);
    expect(after.session_state).toBe("ended");
  });

  it("agentMemories honours content_preview_chars", async () => {
    if (!v0122) return;
    const agentId = `integ-preview-${crypto.randomUUID().slice(0, 8)}`;
    await client.storeMemory(agentId, { content: "Preview this fairly long memory content, please." });
    const memories = await client.agentMemories(agentId, { content_preview_chars: 7 });
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].content_truncated).toBe(true);
    expect(memories[0].content.length).toBe(7);
    expect(memories[0].content_len).toBeGreaterThan(7);
  });
});

// Server v0.12.3 additions. Each test returns early against an older server
// (server_version < 0.12.3), so the suite stays green on the CI's 0.12.0 image.
function atLeast(version: string, min: [number, number, number]): boolean {
  const parts = version.split(/[.+-]/).slice(0, 3).map((p) => Number.parseInt(p, 10));
  for (let i = 0; i < 3; i++) {
    const v = Number.isFinite(parts[i]) ? parts[i] : 0;
    if (v !== min[i]) return v > min[i];
  }
  return true;
}

describeIntegration("Server v0.12.3 (event_time, warnings, dedup trash, get without agent)", () => {
  let v0123 = false;

  beforeAll(async () => {
    const caps = await client.capabilities({ refresh: true });
    v0123 = atLeast(caps.server_version, [0, 12, 3]);
  });

  it("recall / search / batch recall of an agent that stored nothing answer 200, empty", async () => {
    if (!v0123) return;
    const agentId = `integ-empty-${crypto.randomUUID().slice(0, 8)}`;
    const recalled = await client.recall(agentId, "anything at all");
    expect(recalled.memories).toEqual([]);
    expect(await client.searchMemories(agentId, "anything at all")).toEqual([]);
    const batch = await client.batchRecall({ agent_id: agentId, filter: { min_importance: 0.1 } });
    expect(batch.memories).toEqual([]);
  });

  it("store with event_time records _dakera_event_time", async () => {
    if (!v0123) return;
    const agentId = `integ-evt-${crypto.randomUUID().slice(0, 8)}`;
    const stored = await client.storeMemory(agentId, {
      content: "The team moved the launch to Friday.",
      event_time: new Date("2023-05-20T02:21:00Z"),
    });
    expect(stored.memory.metadata?._dakera_event_time).toBe(1684549260);

    const batch = await client.storeMemoriesBatch({
      agent_id: agentId,
      memories: [
        { content: "First imported message.", event_time: 1684549200 },
        { content: "Second imported message.", event_time: "2023-05-20T02:22:00Z" },
      ],
    });
    expect(batch.stored_count).toBe(2);
    const second = await client.getMemory(agentId, batch.stored[1].id);
    expect(second.metadata?._dakera_event_time).toBe(1684549320);
  });

  it("store, batch store and recall with every optional field draw no warnings", async () => {
    if (!v0123) return;
    const agentId = `integ-warn-${crypto.randomUUID().slice(0, 8)}`;
    const session = await client.startSession(agentId);
    const stored = await client.storeMemory(agentId, {
      content: "Every optional store field is a server field.",
      memory_type: "semantic",
      importance: 0.7,
      metadata: { source: "integration" },
      ttl_seconds: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      session_id: session.id,
      tags: ["integ"],
      id: `integ-${crypto.randomUUID().slice(0, 8)}`,
      event_time: 1684549260,
      valid_from: 1684549260,
      lang: "en",
    });
    expect(stored.warnings).toBeUndefined();

    const batch = await client.storeMemoriesBatch({
      agent_id: agentId,
      lang: "en",
      memories: [
        {
          content: "Every optional batch item field is a server field.",
          memory_type: "episodic",
          importance: 0.6,
          tags: ["integ"],
          session_id: session.id,
          metadata: { source: "integration" },
          ttl_seconds: 86400,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          id: `integ-${crypto.randomUUID().slice(0, 8)}`,
          event_time: "2023-05-20T02:21:00Z",
        },
      ],
    });
    expect(batch.warnings).toBeUndefined();

    const recalled = await client.recall(agentId, "optional fields", {
      lang: "en",
      top_k: 5,
      memory_type: "semantic",
      session_id: session.id,
      tags: ["integ"],
      min_importance: 0.1,
      importance_weighted: true,
      include_associated: true,
      associated_memories_cap: 5,
      associated_memories_depth: 1,
      associated_memories_min_weight: 0,
      since: "2020-01-01T00:00:00Z",
      until: "2100-01-01T00:00:00Z",
      routing: "hybrid",
      rerank: false,
      rerank_candidates: 20,
      fusion: "minmax",
      vector_weight: 0.5,
      iterations: 1,
      neighborhood: true,
      neighborhood_mode: "separate",
      include_summaries: false,
    });
    expect(recalled.warnings).toBeUndefined();

    const batchRecalled = await client.batchRecall({
      agent_id: agentId,
      limit: 10,
      filter: {
        tags: ["integ"],
        min_importance: 0.1,
        max_importance: 1,
        created_after: 0,
        created_before: Math.floor(Date.now() / 1000) + 3600,
        memory_type: "semantic",
        session_id: session.id,
      },
    });
    expect(batchRecalled.warnings).toBeUndefined();
    expect(batchRecalled.memories.length).toBeGreaterThan(0);
    await client.endSession(session.id);
  });

  it("a session id with ':' is accepted", async () => {
    if (!v0123) return;
    const agentId = `integ-colon-${crypto.randomUUID().slice(0, 8)}`;
    const stored = await client.storeMemory(agentId, { content: "Colon session.", session_id: "eval:run_1:sample:0" });
    expect(stored.memory.id).toBeDefined();
  });

  it("listDeduplicated of a fresh agent is empty; restoring an unknown id is a 404", async () => {
    if (!v0123) return;
    const agentId = `integ-dedup-${crypto.randomUUID().slice(0, 8)}`;
    await client.storeMemory(agentId, { content: "Nothing was deduplicated here." });
    const listed = await client.listDeduplicated(agentId);
    expect(listed.agent_id).toBe(agentId);
    expect(listed.count).toBe(0);
    expect(listed.memories).toEqual([]);
    await expect(client.restoreDeduplicated(agentId, "no-such-memory")).rejects.toThrow(NotFoundError);
  });

  it("getMemory without an agent id finds the memory", async () => {
    if (!v0123) return;
    const agentId = `integ-noagent-${crypto.randomUUID().slice(0, 8)}`;
    const id = `integ-only-${crypto.randomUUID()}`;
    await client.storeMemory(agentId, { content: "Found without naming the agent.", id });
    const found = await client.getMemory(id);
    expect(found.id).toBe(id);
    expect(found.agent_id).toBe(agentId);
    await expect(client.getMemory(`missing-${crypto.randomUUID()}`)).rejects.toThrow(NotFoundError);
  });

  it("autopilot status and capabilities carry the v0.12.3 fields", async () => {
    if (!v0123) return;
    const status = await client.autopilotStatus();
    expect(["off", "report", "merge"]).toContain(status.config.dedup_mode);
    expect(typeof status.config.trash_retention_hours).toBe("number");
    const caps = await client.capabilities({ refresh: true });
    expect(caps.naming?.session_id_max_bytes).toBeGreaterThan(0);
    expect(new RegExp(caps.naming!.session_id_pattern!).test("user:42")).toBe(true);
  });
});
