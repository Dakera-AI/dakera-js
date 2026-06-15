/**
 * TealTiger governance integration example.
 *
 * This example demonstrates all three Dakera adapters for TealTiger:
 *  - DakeraCostStorage:    persist LLM cost records
 *  - DakeraDecisionStore:  store / query governance decisions
 *  - DakeraDelegationHelper: track delegation chains in the memory KG
 *
 * Prerequisites:
 *   npm install @dakera-ai/dakera
 *   # TealTiger is optional — adapters work without it
 *   # npm install tealtiger
 *
 * Run (with ts-node or tsx):
 *   DAKERA_API_KEY=dk-... npx tsx examples/tealtiger_governance.ts
 */

import { DakeraClient } from '../src/client';
import {
  DakeraCostStorage,
  DakeraDecisionStore,
  DakeraDelegationHelper,
} from '../src/integrations/tealtiger';

const BASE_URL = process.env['DAKERA_URL'] ?? 'http://localhost:3000';
const API_KEY = process.env['DAKERA_API_KEY'] ?? 'dk-dev';

async function main() {
  const client = new DakeraClient(BASE_URL, { apiKey: API_KEY });

  // -------------------------------------------------------------------------
  // DakeraCostStorage — track LLM spend per agent
  // -------------------------------------------------------------------------
  console.log('\n--- DakeraCostStorage ---');
  const costStorage = new DakeraCostStorage(client, 'governance-demo');

  // Store a synthetic cost record (mirrors CostRecord from tealtiger v1.3.0)
  const costRecord = {
    id: 'cost-example-1',
    request_id: 'req-001',
    agent_id: 'my-llm-agent',
    model: 'gpt-4o',
    provider: { value: 'openai' },
    actual_tokens: { input_tokens: 1200, output_tokens: 300, total_tokens: 1500 },
    actual_cost: 0.045,
    breakdown: { input_cost: 0.036, output_cost: 0.009 },
    timestamp: new Date().toISOString(),
    toJSON() {
      return { ...this, provider: 'openai' };
    },
  };

  await costStorage.store(costRecord);
  console.log('Stored cost record:', costRecord.id);

  // Aggregate spend for a date range
  const summary = await costStorage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');
  console.log('Cost summary:', {
    totalCost: summary.total_cost,
    totalRequests: summary.total_requests,
    byModel: summary.by_model,
  });

  // -------------------------------------------------------------------------
  // DakeraDecisionStore — audit governance decisions
  // -------------------------------------------------------------------------
  console.log('\n--- DakeraDecisionStore ---');
  const decisionStore = new DakeraDecisionStore(client);

  // Store a DENY decision (highest importance → longest retention)
  const denyDecision = {
    action: { value: 'DENY' },
    correlation_id: 'corr-example-001',
    policy_id: 'pii-guard-policy',
    risk_score: 95,
    reason: 'PII detected in prompt',
    toJSON() {
      return { ...this, action: 'DENY' };
    },
  };
  const denyMemId = await decisionStore.storeReceipt('my-llm-agent', denyDecision);
  console.log('Stored DENY decision, memory ID:', denyMemId);

  // Check if this correlation ID is already terminal (it is — DENY is final)
  const terminal = await decisionStore.isTerminal('my-llm-agent', 'corr-example-001');
  console.log('Is terminal?', terminal); // true

  // Store a REQUIRE_APPROVAL decision (pending — not terminal)
  const pendingDecision = {
    action: { value: 'REQUIRE_APPROVAL' },
    correlation_id: 'corr-example-002',
    policy_id: 'human-review-policy',
    risk_score: 60,
    reason: 'Ambiguous content, routing to human review',
    toJSON() {
      return { ...this, action: 'REQUIRE_APPROVAL' };
    },
  };
  await decisionStore.storeReceipt('my-llm-agent', pendingDecision);
  const pendingTerminal = await decisionStore.isTerminal('my-llm-agent', 'corr-example-002');
  console.log('REQUIRE_APPROVAL is terminal?', pendingTerminal); // false — pending state

  // Look up a decision by correlation ID
  const found = await decisionStore.lookupReceipt('my-llm-agent', 'corr-example-001');
  console.log('Found decision:', found);

  // -------------------------------------------------------------------------
  // DakeraDelegationHelper — track multi-agent delegation chains
  // -------------------------------------------------------------------------
  console.log('\n--- DakeraDelegationHelper ---');
  const delegationHelper = new DakeraDelegationHelper(client);

  // In a real scenario, you'd have memory IDs from storeReceipt above.
  // Here we use the stored DENY decision as the root.
  // Link a hypothetical child decision (e.g. a sub-agent that inherited the denial):
  const childDecision = {
    action: { value: 'DENY' },
    correlation_id: 'corr-example-001-sub',
    policy_id: 'pii-guard-policy',
    risk_score: 95,
    reason: 'Inherited denial from parent agent',
    toJSON() {
      return { ...this, action: 'DENY' };
    },
  };
  const childMemId = await decisionStore.storeReceipt('my-llm-agent', childDecision);

  // Create the delegation edge: child was delegated from root
  await delegationHelper.linkDelegation({ childId: childMemId, parentId: denyMemId });
  console.log(`Linked delegation: ${childMemId} → ${denyMemId}`);

  // Traverse the full delegation chain from the root
  const chain = await delegationHelper.getDelegationChain('my-llm-agent', denyMemId, 5);
  console.log('Delegation chain:', chain);

  // -------------------------------------------------------------------------
  // Clean up demo data
  // -------------------------------------------------------------------------
  await costStorage.clear();
  console.log('\nDemo complete. Governance data cleared from demo namespace.');
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});
