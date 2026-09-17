export const GEMINI_MODEL_PRIORITY = [
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
