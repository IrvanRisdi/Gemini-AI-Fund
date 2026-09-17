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
  usage: GeminiUsage;
};

export type GeminiUsage = {
  inputTokens: number;
  answerTokens: number;
  thinkingTokens: number;
  totalTokens: number;
};

export const EMPTY_GEMINI_USAGE: GeminiUsage = {
  inputTokens: 0,
  answerTokens: 0,
  thinkingTokens: 0,
  totalTokens: 0,
};

export function mergeGeminiUsage(left: GeminiUsage, right: GeminiUsage): GeminiUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    answerTokens: left.answerTokens + right.answerTokens,
    thinkingTokens: left.thinkingTokens + right.thinkingTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

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
    usage: {
      inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      answerTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      thinkingTokens: payload.usageMetadata?.thoughtsTokenCount ?? 0,
      totalTokens: payload.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
