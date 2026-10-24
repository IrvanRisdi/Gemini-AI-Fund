import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GEMINI_MODEL_PRIORITY,
  SMARTEST_GEMINI_MODEL_PRIORITY,
  getGeminiModelCandidates,
  getSmartestGeminiModelCandidates,
} from './gemini-models.js';

test('Gemini 4.0 Argon, 3.1 Pro, and 3.8 Flash models are tried before Lite fallbacks', () => {
  assert.deepEqual(GEMINI_MODEL_PRIORITY, [
    'gemini-4-argon',
    'gemini-4.0-argon',
    'gemini-3.1-pro-preview',
    'gemini-3.1-pro',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
  ]);
  assert.ok(GEMINI_MODEL_PRIORITY.at(-1)?.includes('lite'));
});

test('Smartest Gemini models prioritize gemini-4-argon and gemini-3.1-pro first for daily reports', () => {
  const models = getSmartestGeminiModelCandidates();
  assert.equal(models[0], 'gemini-4-argon');
  assert.ok(models.includes('gemini-3.1-pro-preview'));
  assert.ok(models.includes('gemini-3.8-flash'));
});

test('configured models are appended once without replacing priority order', () => {
  const models = getGeminiModelCandidates('custom-model, gemini-3.8-flash, custom-model');
  assert.equal(models[0], 'gemini-4-argon');
  assert.equal(models.at(-1), 'custom-model');
  assert.equal(models.filter((model) => model === 'custom-model').length, 1);
});
