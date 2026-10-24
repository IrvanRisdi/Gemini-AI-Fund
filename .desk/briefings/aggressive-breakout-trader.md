# Aggressive Momentum Trader (v6.0)

**Status**: Active · **Modal Awal**: Rp50.000.000 · **Backtest PF**: 1,46 (WR 44,8%)

## Metodologi & Trading Plan v6
- **Timeframe**: 15m Trigger + 1H/4H Trend Context
- **Kriteria Entry**:
  - Breakout impulsif di atas 20-bar High dengan lonjakan volume ekstrem (`RVOL >= 3,5x`).
  - Penutupan di kuartil atas candle (`Close Strength >= 0,75`) dan ekspansi range `>= 1,3x ATR`.
  - Wajib mengungguli (outperform) BTC minimal `+2,0%` dalam 24 jam terakhir.
- **Manajemen Risiko & Exit**:
  - Stop loss struktural 3,0% – 5,0% di bawah swing low / EMA20.
  - Target asimetris `+3,0R` net setelah fee; breakeven stop net-positif aktif saat harga mencapai `+1,25R`.
