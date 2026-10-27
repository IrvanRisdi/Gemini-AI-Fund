/**
 * Pure TypeScript A4 PDF Generator for Gemini AI-Fund Daily Intelligence Report.
 * Zero external binary dependencies — runs anywhere Node.js runs (GitHub Actions, Vercel, local)
 * and produces a multi-page institutional A4 vector PDF ready for Telegram sendDocument.
 */

export interface PdfReportInput {
  dateWib: string;
  sessionLabel: string;
  modelUsed: string;
  generatedAtWib: string;
  portfolio: {
    totalCombinedEquity: string;
    cryptoEquity: string;
    cryptoOpenPositions: number;
    cryptoPendingOrders: number;
    stockEquity: string;
    stockOpenPositions: number;
  };
  cryptoSummary: {
    posture: string;
    btcPrice: string;
    pairsScanned: number;
    uptrendCount: number;
    topSetups: Array<{
      pair: string;
      agent: string;
      entry: string;
      stop: string;
      target: string;
      note: string;
    }>;
  };
  stockSummary: {
    marketPhase: string;
    ihsgTrend: string;
    regimeLabel: string;
    topSetups: Array<{
      symbol: string;
      name: string;
      agent: string;
      entry: string;
      stop: string;
      target: string;
      score: number | null;
      note: string;
    }>;
  };
  aiDigest: {
    headline: string;
    marketWeather: string;
    cryptoRecommendation: string;
    stockRecommendation: string;
    actionableTakeaway: string;
  };
}

/**
 * Official Bursa Efek Indonesia (BEI / IDX) equity tick size (Fraksi Harga Saham):
 * - Harga < Rp 200          -> Fraksi Rp 1
 * - Harga Rp 200 - < 500    -> Fraksi Rp 2
 * - Harga Rp 500 - < 2.000  -> Fraksi Rp 5
 * - Harga Rp 2.000 - < 5.000-> Fraksi Rp 10
 * - Harga >= Rp 5.000       -> Fraksi Rp 25
 */
export function getIdxTickSize(price: number): number {
  const p = Math.max(1, price);
  if (p < 200) return 1;
  if (p < 500) return 2;
  if (p < 2000) return 5;
  if (p < 5000) return 10;
  return 25;
}

/**
 * Rounds a raw Rupiah stock price to a valid IDX tick multiple.
 * - 'nearest': closest valid IDX tick (used for Entry / Reference price)
 * - 'down'   : floor to valid IDX tick (used for Stop Loss so stop is not tighter than intended)
 * - 'up'     : ceil to valid IDX tick (used for Target Profit so R/R is preserved)
 */
export function roundToIdxTick(
  price: number,
  mode: 'nearest' | 'down' | 'up' = 'nearest',
): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const fn = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  const cleanRatio = (val: number, tick: number) => Math.round((val / tick) * 1e6) / 1e6;
  const tick1 = getIdxTickSize(price);
  const pass1 = Math.max(50, fn(cleanRatio(price, tick1)) * tick1);
  const tick2 = getIdxTickSize(pass1);
  return Math.max(50, fn(cleanRatio(pass1, tick2)) * tick2);
}

/**
 * Clean text for PDF WinAnsi / Helvetica rendering (removes markdown asterisks,
 * normalizes non-breaking spaces, dashes, and strips unsupported emoji glyphs).
 */
export function sanitizePdfText(input: string): string {
  return String(input ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u00B7/g, '|')
    // Keep printable ASCII + standard Latin-1 supplement (WinAnsi safe range)
    .replace(/[^\x20-\x7E\xA1-\xFF\n]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function escapePdfLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Estimate string width in points for Helvetica / Helvetica-Bold.
 */
function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('ilI.,:;!| '.includes(ch)) units += 0.28;
    else if ('ftj()[]-\'"/'.includes(ch)) units += 0.35;
    else if ('mwMW@%'.includes(ch)) units += 0.82;
    else if (ch >= 'A' && ch <= 'Z') units += 0.68;
    else units += 0.54;
  }
  return units * fontSize * (bold ? 1.05 : 1.0);
}

/**
 * Word-wrap text into lines that fit within maxWidthPt.
 */
export function wrapPdfText(text: string, maxWidthPt: number, fontSize: number, bold = false): string[] {
  const cleaned = sanitizePdfText(text);
  if (!cleaned) return ['-'];
  const paragraphs = cleaned.split(/\n+/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (estimateTextWidth(candidate, fontSize, bold) <= maxWidthPt) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : ['-'];
}

export function generateDailyReportPdf(data: PdfReportInput): Buffer {
  const PAGE_W = 595.28; // A4 width in pt
  const PAGE_H = 841.89; // A4 height in pt
  const MARGIN_X = 34;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const BOTTOM_LIMIT = 54;

  const pages: string[][] = [[]];
  let currentPageIdx = 0;
  let cursorY = PAGE_H - 34;

  const emit = (cmd: string) => {
    pages[currentPageIdx].push(cmd);
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < BOTTOM_LIMIT) {
      pages.push([]);
      currentPageIdx = pages.length - 1;
      cursorY = PAGE_H - 40;
      // Subtle top continuation header on new page
      drawRect(MARGIN_X, cursorY - 22, CONTENT_W, 22, [0.06, 0.09, 0.16]);
      drawText(
        `GEMINI AI-FUND  |  LAPORAN HARIAN TERPADU (${sanitizePdfText(data.dateWib)}) — Lanjutan`,
        MARGIN_X + 10,
        cursorY - 14,
        8.5,
        'F2',
        [0.9, 0.95, 1.0],
      );
      cursorY -= 34;
    }
  };

  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
    lineWidth = 0.75,
  ) => {
    emit('q');
    if (fillRgb) {
      emit(`${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg`);
    }
    if (strokeRgb) {
      emit(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
      emit(`${lineWidth.toFixed(2)} w`);
    }
    const op = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S';
    emit(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
    emit('Q');
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    size: number,
    font: 'F1' | 'F2' = 'F1',
    rgb: [number, number, number] = [0.1, 0.14, 0.2],
  ) => {
    const safe = escapePdfLiteral(sanitizePdfText(text));
    emit('BT');
    emit(`/${font} ${size.toFixed(2)} Tf`);
    emit(`${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`);
    emit(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    emit(`(${safe}) Tj`);
    emit('ET');
  };

  const drawSectionHeader = (badge: string, title: string, accentRgb: [number, number, number]) => {
    ensureSpace(36);
    cursorY -= 6;
    drawRect(MARGIN_X, cursorY - 22, CONTENT_W, 22, [0.95, 0.97, 0.99], [0.85, 0.89, 0.94], 0.6);
    drawRect(MARGIN_X, cursorY - 22, 4.5, 22, accentRgb);
    drawText(`${badge}  ${title}`, MARGIN_X + 12, cursorY - 14.5, 10, 'F2', [0.06, 0.09, 0.16]);
    cursorY -= 30;
  };

  const drawParagraphBox = (
    title: string | null,
    body: string,
    bgRgb: [number, number, number],
    borderRgb: [number, number, number],
    titleRgb: [number, number, number] = [0.06, 0.09, 0.16],
  ) => {
    const padX = 11;
    const innerW = CONTENT_W - padX * 2;
    const titleLines = title ? wrapPdfText(title, innerW, 10, true) : [];
    const bodyLines = wrapPdfText(body, innerW, 9.2, false);
    const boxH =
      12 +
      (titleLines.length > 0 ? titleLines.length * 13.5 + 4 : 0) +
      bodyLines.length * 13 +
      6;

    ensureSpace(boxH + 8);
    drawRect(MARGIN_X, cursorY - boxH, CONTENT_W, boxH, bgRgb, borderRgb, 0.75);

    let textY = cursorY - 14;
    for (const tLine of titleLines) {
      drawText(tLine, MARGIN_X + padX, textY, 10, 'F2', titleRgb);
      textY -= 13.5;
    }
    if (titleLines.length > 0) textY -= 2;
    for (const bLine of bodyLines) {
      drawText(bLine, MARGIN_X + padX, textY, 9.2, 'F1', [0.16, 0.2, 0.28]);
      textY -= 13;
    }
    cursorY -= boxH + 8;
  };

  // ── 1. TOP BANNER ───────────────────────────────────────────────────────
  const bannerH = 68;
  drawRect(MARGIN_X, cursorY - bannerH, CONTENT_W, bannerH, [0.06, 0.09, 0.16]);
  drawRect(MARGIN_X, cursorY - bannerH, CONTENT_W, 3.5, [0.06, 0.72, 0.51]); // Emerald bottom stripe

  drawText(
    'GEMINI AI-FUND  |  LAPORAN HARIAN TERPADU',
    MARGIN_X + 14,
    cursorY - 22,
    14,
    'F2',
    [1, 1, 1],
  );
  drawText(
    'Desk Kripto Spot (Binance USDT) & Desk Saham Indonesia (BEI / IDX NusaQuant)',
    MARGIN_X + 14,
    cursorY - 37,
    9.2,
    'F1',
    [0.72, 0.8, 0.92],
  );
  drawText(
    `Tanggal: ${sanitizePdfText(data.dateWib)} (${sanitizePdfText(data.sessionLabel)})   |   Model Analis AI: ${sanitizePdfText(data.modelUsed)}   |   Update: ${sanitizePdfText(data.generatedAtWib)}`,
    MARGIN_X + 14,
    cursorY - 53,
    8.5,
    'F2',
    [0.35, 0.92, 0.73],
  );
  cursorY -= bannerH + 10;

  // ── 2. PORTFOLIO KPI STRIP (3 CARDS) ────────────────────────────────────
  const cardGap = 8;
  const cardW = (CONTENT_W - cardGap * 2) / 3;
  const cardH = 48;
  const kpiCards: Array<{
    label: string;
    value: string;
    sub: string;
    accent: [number, number, number];
  }> = [
    {
      label: 'TOTAL EKUITAS GABUNGAN (11 AGEN)',
      value: data.portfolio.totalCombinedEquity,
      sub: `${data.portfolio.cryptoOpenPositions + data.portfolio.stockOpenPositions} posisi aktif berjalan`,
      accent: [0.06, 0.72, 0.51],
    },
    {
      label: 'DESK KRIPTO SPOT (6 AGEN V6)',
      value: data.portfolio.cryptoEquity,
      sub: `BTC: ${data.cryptoSummary.btcPrice} | ${data.cryptoSummary.uptrendCount}/${data.cryptoSummary.pairsScanned} pair uptrend`,
      accent: [0.23, 0.51, 0.96],
    },
    {
      label: 'DESK SAHAM IDX (5 AGEN V3)',
      value: data.portfolio.stockEquity,
      sub: `IHSG: ${data.stockSummary.ihsgTrend} | Fase: ${data.stockSummary.marketPhase}`,
      accent: [0.55, 0.36, 0.96],
    },
  ];

  for (let i = 0; i < kpiCards.length; i++) {
    const cx = MARGIN_X + i * (cardW + cardGap);
    const c = kpiCards[i];
    drawRect(cx, cursorY - cardH, cardW, cardH, [0.97, 0.98, 1.0], [0.84, 0.88, 0.94], 0.7);
    drawRect(cx, cursorY - 3, cardW, 3, c.accent);
    drawText(c.label, cx + 9, cursorY - 15, 7.2, 'F2', [0.38, 0.45, 0.55]);
    drawText(c.value, cx + 9, cursorY - 29, 11.5, 'F2', [0.06, 0.09, 0.16]);
    drawText(c.sub, cx + 9, cursorY - 41, 7.5, 'F1', [0.35, 0.42, 0.52]);
  }
  cursorY -= cardH + 10;

  // ── 3. SECTION 1: INTISARI & CUACA PASAR ────────────────────────────────
  drawSectionHeader('01', 'INTISARI & CUACA PASAR HARI INI (MARKET WEATHER)', [0.06, 0.72, 0.51]);
  drawParagraphBox(
    data.aiDigest.headline,
    data.aiDigest.marketWeather,
    [0.95, 0.99, 0.97],
    [0.68, 0.9, 0.8],
    [0.04, 0.38, 0.28],
  );

  // ── 4. SECTION 2: REKOMENDASI & WATCHLIST KRIPTO SPOT ───────────────────
  drawSectionHeader('02', 'REKOMENDASI & DAFTAR PANTAUAN KRIPTO SPOT (BINANCE USDT)', [0.23, 0.51, 0.96]);
  drawParagraphBox(
    `Postur Desk Kripto: ${data.cryptoSummary.posture}`,
    data.aiDigest.cryptoRecommendation,
    [0.96, 0.98, 1.0],
    [0.76, 0.85, 0.98],
    [0.12, 0.32, 0.68],
  );

  if (data.cryptoSummary.topSetups.length > 0) {
    for (let i = 0; i < data.cryptoSummary.topSetups.length; i++) {
      const s = data.cryptoSummary.topSetups[i];
      const noteLines = wrapPdfText(`Catatan: ${s.note}`, CONTENT_W - 22, 8.5, false);
      const rowH = 38 + noteLines.length * 11.5;
      ensureSpace(rowH + 5);
      drawRect(MARGIN_X, cursorY - rowH, CONTENT_W, rowH, [0.99, 0.995, 1.0], [0.85, 0.89, 0.95], 0.6);
      drawText(
        `${i + 1}. ${s.pair}  —  Strategi: ${s.agent}`,
        MARGIN_X + 10,
        cursorY - 13,
        9.4,
        'F2',
        [0.08, 0.24, 0.55],
      );
      drawText(
        `Area Beli (Entry): ${s.entry}     |     Stop Loss: ${s.stop}     |     Target Profit: ${s.target}`,
        MARGIN_X + 10,
        cursorY - 25,
        8.6,
        'F2',
        [0.05, 0.42, 0.3],
      );
      let ny = cursorY - 37;
      for (const nl of noteLines) {
        drawText(nl, MARGIN_X + 10, ny, 8.4, 'F1', [0.3, 0.36, 0.45]);
        ny -= 11.5;
      }
      cursorY -= rowH + 4;
    }
    cursorY -= 4;
  }

  // ── 5. SECTION 3: REKOMENDASI & WATCHLIST SAHAM IDX (BEI) ───────────────
  drawSectionHeader('03', 'REKOMENDASI & DAFTAR PANTAUAN SAHAM IDX (BURSA EFEK INDONESIA)', [0.55, 0.36, 0.96]);
  drawParagraphBox(
    `Status Pasar BEI: Fase ${data.stockSummary.marketPhase} | Tren IHSG: ${data.stockSummary.ihsgTrend}`,
    data.aiDigest.stockRecommendation,
    [0.98, 0.97, 1.0],
    [0.84, 0.78, 0.98],
    [0.32, 0.18, 0.65],
  );

  if (data.stockSummary.topSetups.length > 0) {
    for (let i = 0; i < data.stockSummary.topSetups.length; i++) {
      const s = data.stockSummary.topSetups[i];
      const noteLines = wrapPdfText(`Alasan & Catatan: ${s.note}`, CONTENT_W - 22, 8.5, false);
      const rowH = 38 + noteLines.length * 11.5;
      ensureSpace(rowH + 5);
      drawRect(MARGIN_X, cursorY - rowH, CONTENT_W, rowH, [0.995, 0.99, 1.0], [0.86, 0.84, 0.95], 0.6);
      drawText(
        `${i + 1}. ${s.symbol} - ${s.name}  (${s.agent})`,
        MARGIN_X + 10,
        cursorY - 13,
        9.4,
        'F2',
        [0.28, 0.15, 0.6],
      );
      drawText(
        `Area Beli (Entry): ${s.entry}     |     Stop Loss: ${s.stop}     |     Target Profit: ${s.target}`,
        MARGIN_X + 10,
        cursorY - 25,
        8.6,
        'F2',
        [0.05, 0.42, 0.3],
      );
      let ny = cursorY - 37;
      for (const nl of noteLines) {
        drawText(nl, MARGIN_X + 10, ny, 8.4, 'F1', [0.3, 0.36, 0.45]);
        ny -= 11.5;
      }
      cursorY -= rowH + 4;
    }
    cursorY -= 4;
  }

  // ── 6. SECTION 4: PANDUAN RISIKO & MANAJEMEN MODAL ──────────────────────
  drawSectionHeader('04', 'PANDUAN MANAJEMEN RISIKO & EKSEKUSI HARIAN', [0.92, 0.55, 0.08]);
  drawParagraphBox(
    'Prinsip Disiplin Portofolio:',
    data.aiDigest.actionableTakeaway,
    [1.0, 0.985, 0.94],
    [0.95, 0.82, 0.55],
    [0.55, 0.32, 0.04],
  );

  // ── 7. PAGE FOOTERS ─────────────────────────────────────────────────────
  const totalPages = pages.length;
  for (let p = 0; p < totalPages; p++) {
    currentPageIdx = p;
    drawRect(MARGIN_X, 34, CONTENT_W, 0.6, [0.82, 0.86, 0.92]);
    drawText(
      `Gemini AI-Fund Daily Intelligence Report  |  Model: ${data.modelUsed}  |  Paper Trading & Research Desk`,
      MARGIN_X,
      22,
      7.8,
      'F1',
      [0.45, 0.52, 0.62],
    );
    drawText(
      `Halaman ${p + 1} dari ${totalPages}`,
      PAGE_W - MARGIN_X - 68,
      22,
      7.8,
      'F2',
      [0.45, 0.52, 0.62],
    );
  }

  // ── 8. ASSEMBLE PDF 1.4 OBJECTS ─────────────────────────────────────────
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Font F1 (Helvetica)
  // Object 4: Font F2 (Helvetica-Bold)
  // Objects 5..: Page + Content stream pairs
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  let nextObjNum = 5;
  for (let p = 0; p < pages.length; p++) {
    const pageObjNum = nextObjNum++;
    const contentObjNum = nextObjNum++;
    pageObjNums.push(pageObjNum);

    const streamBody = pages[p].join('\n');
    const streamByteLen = Buffer.byteLength(streamBody, 'latin1');

    objects[pageObjNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
    objects[contentObjNum] = `<< /Length ${streamByteLen} >>\nstream\n${streamBody}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
  const offsets: number[] = [0];
  let byteOffset = Buffer.byteLength(chunks[0], 'latin1');

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = byteOffset;
    const objStr = `${i} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(objStr);
    byteOffset += Buffer.byteLength(objStr, 'latin1');
  }

  const xrefOffset = byteOffset;
  const xrefLines = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`];
  for (let i = 1; i < objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  const trailer =
    xrefLines.join('') +
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(trailer);

  return Buffer.from(chunks.join(''), 'latin1');
}
