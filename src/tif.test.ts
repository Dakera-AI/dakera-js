/**
 * Tests for T-I-F reliability scoring (T-I-F RFC Phase 3).
 */

import { describe, it, expect } from 'vitest';
import { computeTifScore, tifScoreFromMetadata } from './types';
import type { FeedbackHistoryResponse } from './types';

function makeHistory(...signals: string[]): FeedbackHistoryResponse {
  return {
    memory_id: 'test-mem',
    entries: signals.map((signal) => ({
      signal: signal as any,
      timestamp: 0,
      old_importance: 0.5,
      new_importance: 0.5,
    })),
  };
}

describe('computeTifScore', () => {
  it('returns max indeterminacy when there is no feedback', () => {
    const score = computeTifScore(makeHistory());
    expect(score.truth).toBe(0);
    expect(score.indeterminacy).toBe(1);
    expect(score.falsity).toBe(0);
    expect(score.feedbackCount).toBe(0);
    expect(score.classification).toBe('ask_clarification');
  });

  it('returns truth=1 for all upvotes', () => {
    const score = computeTifScore(makeHistory('upvote', 'upvote', 'upvote'));
    expect(score.truth).toBe(1);
    expect(score.falsity).toBe(0);
    expect(score.indeterminacy).toBe(0);
    expect(score.feedbackCount).toBe(3);
  });

  it('returns falsity=0.8 for two downvotes (thin evidence)', () => {
    const score = computeTifScore(makeHistory('downvote', 'downvote'));
    expect(score.truth).toBe(0);
    expect(score.falsity).toBeCloseTo(0.8);
    expect(score.indeterminacy).toBeCloseTo(0.2);
    expect(score.feedbackCount).toBe(2);
  });

  it('returns indeterminacy=1 for all flags', () => {
    const score = computeTifScore(makeHistory('flag', 'flag'));
    expect(score.truth).toBe(0);
    expect(score.indeterminacy).toBe(1);
    expect(score.falsity).toBe(0);
    expect(score.feedbackCount).toBe(2);
  });

  it('correctly splits mixed signals', () => {
    // 4 upvotes, 2 downvotes, 4 flags → total 10
    const score = computeTifScore(makeHistory('upvote', 'upvote', 'upvote', 'upvote', 'downvote', 'downvote', 'flag', 'flag', 'flag', 'flag'));
    expect(score.truth).toBeCloseTo(0.4);
    expect(score.falsity).toBeCloseTo(0.2);
    expect(score.indeterminacy).toBeCloseTo(0.4);
    expect(score.feedbackCount).toBe(10);
  });

  it('treats positive as upvote', () => {
    const score = computeTifScore(makeHistory('positive', 'positive', 'downvote'));
    expect(score.truth).toBeCloseTo(2 / 3);
    expect(score.falsity).toBeCloseTo(1 / 3);
  });

  it('treats negative as downvote', () => {
    const score = computeTifScore(makeHistory('upvote', 'negative', 'negative'));
    expect(score.falsity).toBeCloseTo(2 / 3);
    expect(score.truth).toBeCloseTo(1 / 3);
  });

  it('proportions sum to 1.0', () => {
    const score = computeTifScore(makeHistory('upvote', 'downvote', 'flag'));
    expect(score.truth + score.indeterminacy + score.falsity).toBeCloseTo(1.0);
  });
});

describe('TifScore.classification', () => {
  it('returns confident_reuse when truth >= 0.70', () => {
    const score = computeTifScore(makeHistory('upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'downvote', 'downvote', 'flag'));
    expect(score.truth).toBeGreaterThanOrEqual(0.7);
    expect(score.classification).toBe('confident_reuse');
  });

  it('returns surface_contradiction when falsity >= 0.50', () => {
    const score = computeTifScore(makeHistory('downvote', 'downvote', 'downvote', 'upvote', 'upvote'));
    expect(score.falsity).toBeGreaterThanOrEqual(0.5);
    expect(score.classification).toBe('surface_contradiction');
  });

  it('returns ask_clarification when indeterminacy >= 0.50', () => {
    const score = computeTifScore(makeHistory('flag', 'flag', 'flag', 'upvote', 'upvote'));
    expect(score.indeterminacy).toBeGreaterThanOrEqual(0.5);
    expect(score.classification).toBe('ask_clarification');
  });

  it('returns verify_before_use when no dominant signal', () => {
    // 4 upvotes, 3 downvotes, 3 flags → truth=0.4, falsity=0.3, indeterminacy=0.3 — none hit threshold
    const score = computeTifScore(makeHistory('upvote', 'upvote', 'upvote', 'upvote', 'downvote', 'downvote', 'downvote', 'flag', 'flag', 'flag'));
    expect(score.classification).toBe('verify_before_use');
  });

  it('falsity >= 0.5 takes priority over indeterminacy >= 0.5', () => {
    // 1 upvote, 2 downvotes, 3 flags → total 6: falsity=0.33, indeterminacy=0.5, truth=0.17
    // Actually 3 downvotes + 3 flags → falsity=0.5, indeterminacy=0.5
    const score = computeTifScore(makeHistory('downvote', 'downvote', 'downvote', 'flag', 'flag', 'flag'));
    expect(score.classification).toBe('surface_contradiction');
  });
});

describe('thin evidence', () => {
  it('single upvote is not confident_reuse', () => {
    const s = computeTifScore(makeHistory('upvote'));
    expect(s.truth + s.indeterminacy + s.falsity).toBeCloseTo(1.0);
    expect(s.indeterminacy).toBeGreaterThan(0);
    expect(s.truth).toBeLessThan(0.70);
    expect(s.classification).toBe('verify_before_use');
  });

  it('two upvotes reach confident_reuse', () => {
    const s = computeTifScore(makeHistory('upvote', 'upvote'));
    expect(s.truth).toBeCloseTo(0.8);
    expect(s.indeterminacy).toBeCloseTo(0.2);
    expect(s.classification).toBe('confident_reuse');
  });

  it('three upvotes have no base indeterminacy', () => {
    const s = computeTifScore(makeHistory('upvote', 'upvote', 'upvote'));
    expect(s.truth).toBeCloseTo(1.0);
    expect(s.indeterminacy).toBeCloseTo(0.0);
    expect(s.classification).toBe('confident_reuse');
  });
});

describe('golden vectors (canonical T-I-F v1 contract)', () => {
  it('no feedback', () => {
    const s = computeTifScore(makeHistory());
    expect(s.truth).toBeCloseTo(0.0);
    expect(s.indeterminacy).toBeCloseTo(1.0);
    expect(s.falsity).toBeCloseTo(0.0);
    expect(s.classification).toBe('ask_clarification');
  });

  it('one upvote', () => {
    const s = computeTifScore(makeHistory('upvote'));
    expect(s.truth).toBeCloseTo(2 / 3, 4);
    expect(s.indeterminacy).toBeCloseTo(1 / 3, 4);
    expect(s.falsity).toBeCloseTo(0.0);
    expect(s.classification).toBe('verify_before_use');
  });

  it('two upvotes', () => {
    const s = computeTifScore(makeHistory('upvote', 'upvote'));
    expect(s.truth).toBeCloseTo(0.8);
    expect(s.indeterminacy).toBeCloseTo(0.2);
    expect(s.falsity).toBeCloseTo(0.0);
    expect(s.classification).toBe('confident_reuse');
  });

  it('three upvotes', () => {
    const s = computeTifScore(makeHistory('upvote', 'upvote', 'upvote'));
    expect(s.truth).toBeCloseTo(1.0);
    expect(s.indeterminacy).toBeCloseTo(0.0);
    expect(s.falsity).toBeCloseTo(0.0);
    expect(s.classification).toBe('confident_reuse');
  });

  it('two downvotes', () => {
    const s = computeTifScore(makeHistory('downvote', 'downvote'));
    expect(s.truth).toBeCloseTo(0.0);
    expect(s.indeterminacy).toBeCloseTo(0.2);
    expect(s.falsity).toBeCloseTo(0.8);
    expect(s.classification).toBe('surface_contradiction');
  });

  it('two flags', () => {
    const s = computeTifScore(makeHistory('flag', 'flag'));
    expect(s.truth).toBeCloseTo(0.0);
    expect(s.indeterminacy).toBeCloseTo(1.0);
    expect(s.falsity).toBeCloseTo(0.0);
    expect(s.classification).toBe('ask_clarification');
  });

  it('8 upvotes, 1 downvote, 1 flag', () => {
    const s = computeTifScore(makeHistory('upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'upvote', 'downvote', 'flag'));
    expect(s.truth).toBeCloseTo(0.8);
    expect(s.indeterminacy).toBeCloseTo(0.1);
    expect(s.falsity).toBeCloseTo(0.1);
    expect(s.classification).toBe('confident_reuse');
  });

  it('3 downvotes, 3 flags', () => {
    const s = computeTifScore(makeHistory('downvote', 'downvote', 'downvote', 'flag', 'flag', 'flag'));
    expect(s.truth).toBeCloseTo(0.0);
    expect(s.indeterminacy).toBeCloseTo(0.5);
    expect(s.falsity).toBeCloseTo(0.5);
    expect(s.classification).toBe('surface_contradiction');
  });
});

describe('tifScoreFromMetadata', () => {
  it('parses a metadata reliability dict', () => {
    const score = tifScoreFromMetadata({ truth: 0.75, indeterminacy: 0.15, falsity: 0.10, feedback_count: 20 });
    expect(score.truth).toBeCloseTo(0.75);
    expect(score.indeterminacy).toBeCloseTo(0.15);
    expect(score.falsity).toBeCloseTo(0.10);
    expect(score.feedbackCount).toBe(20);
    expect(score.classification).toBe('confident_reuse');
  });

  it('defaults feedback_count to 0 when missing', () => {
    const score = tifScoreFromMetadata({ truth: 0.8, indeterminacy: 0.1, falsity: 0.1 });
    expect(score.feedbackCount).toBe(0);
  });
});
