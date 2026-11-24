# Gemini AI Fund — Futures Engine (v1)

Engine riset & paper trading kripto **Long + Short** terpisah dari desk spot-only lama. Dibangun dengan prinsip **Single Source of Truth**: file strategi di `src/strategies.ts` dipanggil secara identik oleh `backtest.ts` dan `paper-runner.ts`.

## Arsitektur Utama

1. **Agen Core (`wyckoff-4h`, 70% alokasi):** Breakout/Breakdown konsolidasi 45 bar 4H + limit retest, aktif di semua kondisi pasar (Bull, Mixed, Bear).
2. **Agen Booster (`smc-1h-bear`, 30% alokasi):** Sapuan likuiditas 24 jam 1H + reclaim kuat, **hanya aktif saat `BTC < 4H EMA200`**.
3. **Trading Plan Hybrid:** SL adaptif $\max(\text{struktur}, 1{,}5 \times \text{ATR})$ dengan guardrail 1,2%–6,0%; **Partial TP1 50% @ +1,2R** → geser Breakeven → **Chandelier Trailing 3,0×ATR**.
4. **Solusi Precision & `minNotional` (Blind-Spot #4):** `planOrderExecution()` otomatis mengecek `stepSize`, `minQty`, dan `minNotional`. Jika pecahan 50% untuk Partial TP1 berada di bawah minimum bursa (misal pada modal kecil), sistem otomatis mengubah exit menjadi **100% di TP1** agar order tidak pernah ditolak.
5. **Kalender Makro Resmi 2026–2027 (Blind-Spot #6):** `data/macro-calendar-2026-2027.json` memuat jadwal resmi FOMC (Federal Reserve), CPI, dan NFP (BLS) dengan blackout otomatis 2 jam sebelum rilis dan status waspada 12 jam sebelumnya.
6. **Gemini 4 Hybrid Gate + 3-Layer Memory:**
   - **Pre-Trade:** `Gemini 4 Neon` (fallback `Argon → Hydrogen → Flash`) dengan wewenang asimetris (`APPROVE`, `DOWNGRADE -1x`, `VETO 0x`, hard cap 3x).
   - **Weekly Forensic Review:** `Gemini 4 Carbon` membedah log MFE/MAE & akurasi *Shadow A/B* lalu memperbarui `.futures-desk/memory/lessons.json`.

## Perintah Lokal

```bash
cd futures-engine
npm install
npm run typecheck
npm test
npm run run:backtest
npm run run:cycle
npm run run:weekly
```

## Environment Variables (GitHub Secrets)

- `GEMINI_API_KEY`: API key Google AI Studio (memanfaatkan kredit Developer \$10/bulan Google AI Pro).
- `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` *(opsional)*: Notifikasi fill, close, veto, kill-switch, dan heartbeat error.
- `FUTURES_STARTING_CAPITAL_USD` *(opsional, default `10000`)*: Modal simulasi awal USD.
