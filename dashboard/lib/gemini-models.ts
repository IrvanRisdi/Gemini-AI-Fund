export const GEMINI_MODEL_PRIORITY = [
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
] as const;

export const SMARTEST_GEMINI_MODEL_PRIORITY = [
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
 * Prioritizes Gemini 4.0 Argon & Gemini 3.1 Pro first for deep reasoning and
 * cross-asset daily reports, falling back to Gemini 3.8 Flash if needed.
 */
export function getSmartestGeminiModelCandidates(configuredModels = ''): string[] {
  const configured = configuredModels
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([...SMARTEST_GEMINI_MODEL_PRIORITY, ...configured])];
}
