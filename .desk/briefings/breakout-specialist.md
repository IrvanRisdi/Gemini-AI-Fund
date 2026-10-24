# Breakout Specialist (v6.0)

**Status**: Active · **Modal Awal**: Rp50.000.000 · **Backtest PF**: 1,94 (WR 51,9%)

## Metodologi & Trading Plan v6
- **Timeframe**: 4H (Struktur & Trigger) + Daily Macro Regime Filter
- **Kriteria Entry**:
  - Penutupan candle 4H menembus 20-bar High sebelumnya dalam struktur tren naik (`EMA20 > EMA50`).
  - Konfirmasi volume relatif `RVOL >= 1,3x` dan `Close Strength >= 0,68`.
  - Relative Strength (RS) 24 jam mengungguli BTC serta regime Daily tidak bearish.
- **Manajemen Risiko & Exit**:
  - Alokasi tunggal 30% ekuitas (inverted pyramiding dihapus).
  - Stop loss struktural di bawah 4H EMA20 / breakout base (3,5% – 5,0%).
  - Target profit bersih `+2,5R` setelah fee; breakeven stop net-positif aktif saat harga mencapai `+1,25R`.
