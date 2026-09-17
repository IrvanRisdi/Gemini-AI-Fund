import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeGeminiUsage, readGeminiCandidate } from './gemini-response.ts';

test('joins every visible text part instead of returning only the first part', () => {
  const result = readGeminiCandidate({
    candidates: [{
      content: { parts: [{ text: 'Bagian pertama.' }, { text: 'Bagian kedua.' }] },
      finishReason: 'STOP',
    }],
  });

  assert.equal(result.text, 'Bagian pertama.\n\nBagian kedua.');
  assert.equal(result.wasTruncated, false);
});

test('does not expose thought parts and reports a token truncation', () => {
  const result = readGeminiCandidate({
    candidates: [{
      content: {
        parts: [
          { text: 'Penalaran internal', thought: true },
          { text: 'Jawaban aman untuk pengguna.' },
        ],
      },
      finishReason: 'MAX_TOKENS',
    }],
  });

  assert.equal(result.text, 'Jawaban aman untuk pengguna.');
  assert.equal(result.finishReason, 'MAX_TOKENS');
  assert.equal(result.wasTruncated, true);
});

test('returns and aggregates provider token usage', () => {
  const result = readGeminiCandidate({
    candidates: [{ content: { parts: [{ text: 'Selesai.' }] }, finishReason: 'STOP' }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 40,
      thoughtsTokenCount: 20,
      totalTokenCount: 160,
    },
  });
  const total = mergeGeminiUsage(result.usage, {
    inputTokens: 50,
    answerTokens: 25,
    thinkingTokens: 10,
    totalTokens: 85,
  });

  assert.deepEqual(total, {
    inputTokens: 150,
    answerTokens: 65,
    thinkingTokens: 30,
    totalTokens: 245,
  });
});
