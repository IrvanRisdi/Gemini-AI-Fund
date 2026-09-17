import assert from 'node:assert/strict';
import test from 'node:test';
import { GEMINI_MODEL_PRIORITY, getGeminiModelCandidates } from './gemini-models.ts';

test('Gemini Flash models are tried before Lite fallbacks', () => {
  assert.deepEqual(GEMINI_MODEL_PRIORITY.slice(0, 4), [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ]);
  assert.ok(GEMINI_MODEL_PRIORITY.slice(4).every((model) => model.includes('lite')));
});

test('configured models are appended once without replacing priority order', () => {
  const models = getGeminiModelCandidates('custom-model, gemini-3.8-flash, custom-model');
  assert.equal(models[0], 'gemini-3.8-flash');
  assert.equal(models.at(-1), 'custom-model');
  assert.equal(models.filter((model) => model === 'custom-model').length, 1);
});
