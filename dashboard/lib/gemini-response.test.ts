import assert from 'node:assert/strict';
import test from 'node:test';
import { readGeminiCandidate } from './gemini-response.ts';

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
