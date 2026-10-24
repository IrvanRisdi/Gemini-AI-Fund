import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GEMINI_MODEL_PRIORITY,
  SMARTEST_GEMINI_MODEL_PRIORITY,
  getGeminiModelCandidates,
  getSmartestGeminiModelCandidates,
} from './gemini-models.js';

test('Gemini Flash models are tried before Lite fallbacks', () => {
  assert.deepEqual(GEMINI_MODEL_PRIORITY, [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ]);
  assert.ok(GEMINI_MODEL_PRIORITY[1].includes('lite'));
});

test('Smartest Gemini models prioritize gemini-2.5-pro first for daily reports', () => {
  const models = getSmartestGeminiModelCandidates();
  assert.equal(models[0], 'gemini-2.5-pro');
  assert.equal(SMARTEST_GEMINI_MODEL_PRIORITY[0], 'gemini-2.5-pro');
});

test('configured models are appended once without replacing priority order', () => {
  const models = getGeminiModelCandidates('custom-model, gemini-2.5-flash, custom-model');
  assert.equal(models[0], 'gemini-2.5-flash');
  assert.equal(models.at(-1), 'custom-model');
  assert.equal(models.filter((model) => model === 'custom-model').length, 1);
});
