export type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
};

export type GeminiCandidateResult = {
  text: string;
  finishReason: string;
  wasTruncated: boolean;
};

export function readGeminiCandidate(payload: GeminiGenerateResponse): GeminiCandidateResult {
  const candidate = payload.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const finishReason = candidate?.finishReason ?? '';

  return {
    text,
    finishReason,
    wasTruncated: finishReason === 'MAX_TOKENS',
  };
}
