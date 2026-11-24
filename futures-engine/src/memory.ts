import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentBook,
  ClosedTrade,
  FuturesLedger,
  LessonItem,
  VetoCalibration,
} from './types.js';

export interface EpisodicMemory {
  agentRecent10: {
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number;
    avgR: number;
    avgMfeR: number;
    avgMaeR: number;
    currentLossStreak: number;
  };
  coinHistory: {
    symbol: string;
    trades: number;
    wins: number;
    avgR: number;
    avgMaeR: number;
    lastResult: string;
  };
  portfolioExposure: {
    openPositionsCount: number;
    longCount: number;
    shortCount: number;
    openSymbols: string[];
  };
}

export interface StructuredMemoryPack {
  episodic: EpisodicMemory;
  distilledLessons: LessonItem[];
  vetoCalibration: VetoCalibration;
}

export function loadLessons(lessonsPath: string): LessonItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(lessonsPath, 'utf8')) as {
      lessons?: LessonItem[];
    };
    return Array.isArray(raw.lessons) ? raw.lessons.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function saveLessons(lessonsPath: string, lessons: LessonItem[]): void {
  fs.mkdirSync(path.dirname(lessonsPath), { recursive: true });
  const trimmed = lessons.slice(0, 10);
  fs.writeFileSync(
    lessonsPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        maxLessons: 10,
        lessons: trimmed,
      },
      null,
      2,
    ) + '\n',
  );
}

function summarizeTradeSlice(trades: ClosedTrade[]) {
  if (trades.length === 0) {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      avgR: 0,
      avgMfeR: 0,
      avgMaeR: 0,
      currentLossStreak: 0,
    };
  }
  const wins = trades.filter((t) => t.pnlUsd > 0).length;
  const losses = trades.length - wins;
  const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length;
  const avgMfeR = trades.reduce((s, t) => s + t.mfeR, 0) / trades.length;
  const avgMaeR = trades.reduce((s, t) => s + t.maeR, 0) / trades.length;

  let streak = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i]!.pnlUsd < 0) streak++;
    else break;
  }

  return {
    trades: trades.length,
    wins,
    losses,
    winRatePct: Number(((wins / trades.length) * 100).toFixed(1)),
    avgR: Number(avgR.toFixed(2)),
    avgMfeR: Number(avgMfeR.toFixed(2)),
    avgMaeR: Number(avgMaeR.toFixed(2)),
    currentLossStreak: streak,
  };
}

export function computeVetoCalibration(book: AgentBook): VetoCalibration {
  const closedVetoes = book.shadowVetoed.filter((v) => v.status === 'closed' && v.realizedR != null);
  let vetoSavedR = 0;
  let vetoMissedR = 0;
  for (const v of closedVetoes) {
    const r = v.realizedR ?? 0;
    if (r < 0) vetoSavedR += Math.abs(r);
    else vetoMissedR += r;
  }

  const downgrades = book.closedTrades.filter((t) => t.geminiAction === 'DOWNGRADE');
  const downgradeNetDeltaR = downgrades.reduce(
    (s, t) => s + (t.rMultiple - t.quantOnlyRMultiple),
    0,
  );

  const totalEvaluated = book.closedTrades.length + closedVetoes.length;
  const netVetoR = vetoSavedR - vetoMissedR;
  let summary = 'Belum cukup sampel kalibrasi A/B (gunakan penilaian objektif standar).';
  if (closedVetoes.length >= 3) {
    summary =
      netVetoR >= 0
        ? `Kalibrasi Veto POSITIF (+${netVetoR.toFixed(2)}R bersih diselamatkan dari ${closedVetoes.length} veto).`
        : `PERHATIAN: Veto terlalu agresif (${netVetoR.toFixed(2)}R bersih — terlalu banyak membuang trade menang). Naikkan ambang batas sebelum mem-VETO.`;
  }

  return {
    totalEvaluated,
    vetoCount: closedVetoes.length,
    vetoSavedR: Number(vetoSavedR.toFixed(2)),
    vetoMissedR: Number(vetoMissedR.toFixed(2)),
    downgradeCount: downgrades.length,
    downgradeNetDeltaR: Number(downgradeNetDeltaR.toFixed(2)),
    summary,
  };
}

export function buildStructuredMemoryPack(
  ledger: FuturesLedger,
  book: AgentBook,
  symbol: string,
  lessonsPath: string,
): StructuredMemoryPack {
  const recent10 = summarizeTradeSlice(book.closedTrades.slice(-10));
  const coinTrades = book.closedTrades.filter((t) => t.symbol === symbol).slice(-8);
  const coinSummary = summarizeTradeSlice(coinTrades);
  const lastCoinTrade = coinTrades.at(-1);

  const openPositions = Object.values(ledger.books).flatMap((b) => b.positions);

  return {
    episodic: {
      agentRecent10: recent10,
      coinHistory: {
        symbol,
        trades: coinSummary.trades,
        wins: coinSummary.wins,
        avgR: coinSummary.avgR,
        avgMaeR: coinSummary.avgMaeR,
        lastResult: lastCoinTrade
          ? `${lastCoinTrade.side.toUpperCase()} ${lastCoinTrade.rMultiple >= 0 ? '+' : ''}${lastCoinTrade.rMultiple.toFixed(2)}R (${lastCoinTrade.closeReason})`
          : 'Belum ada histori trade untuk koin ini.',
      },
      portfolioExposure: {
        openPositionsCount: openPositions.length,
        longCount: openPositions.filter((p) => p.side === 'long').length,
        shortCount: openPositions.filter((p) => p.side === 'short').length,
        openSymbols: openPositions.map((p) => `${p.symbol}:${p.side}`),
      },
    },
    distilledLessons: loadLessons(lessonsPath),
    vetoCalibration: computeVetoCalibration(book),
  };
}
