# SMC Liquidity Sweep Trader (v6.0)

**Status**: Active · **Modal Awal**: Rp50.000.000 · **Backtest PF**: 1,21 (WR 51,9%)

## Metodologi & Trading Plan v6
- **Timeframe**: 15m Execution + 1H/4H Trend Alignment
- **Kriteria Entry**:
  - Tren naik terkonfirmasi pada timeframe 1H & 4H (`EMA20 > EMA50`).
  - Harga menyapu likuiditas di bawah 24-bar (6 jam) swing low lalu ditutup menguat di atas level sweep.
  - Konfirmasi *Bullish Displacement* dengan `Close Strength >= 0,65`.
- **Manajemen Risiko & Exit**:
  - Stop loss di bawah ujung ekor liquidity sweep (minimal jarak struktural 2,5%).
  - Target pada opposing liquidity pool (24-bar high) dengan minimal `+2,0R` net.
