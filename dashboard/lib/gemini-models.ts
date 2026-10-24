export const GEMINI_MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const;

export const SMARTEST_GEMINI_MODEL_PRIORITY = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
] as const;

/**
 * Keep the requested quality-first order stable. Extra environment models are
 * appended as final fallbacks and duplicates are removed.
 */
export function getGeminiModelCandidates(configuredModels = ''): string[] {
  const configured = configuredModels
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([...GEMINI_MODEL_PRIORITY, ...configured])];
}

/**
 * Prioritizes Gemini 2.5 Pro (deep reasoning & cross-asset synthesis) first,
 * falling back to Gemini 2.5 Flash if Pro quota is exhausted.
 */
export function getSmartestGeminiModelCandidates(configuredModels = ''): string[] {
  const configured = configuredModels
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([...SMARTEST_GEMINI_MODEL_PRIORITY, ...configured])];
}
