# Mean Reversion Trader (v6.0)

**Status**: Active · **Modal Awal**: Rp50.000.000 · **Backtest PF**: 2,42 (WR 65,4%)

## Metodologi & Trading Plan v6
- **Timeframe**: 4H Capitulation Flush + Daily Trend Guard
- **Kriteria Entry**:
  - Kondisi jenuh jual ekstrem pada 4H: `RSI(14) < 30` disertai penembusan `Lower Bollinger Band(20, 2)`.
  - Konfirmasi candle pembalikan (Bullish Reclaim) dengan `Close Strength >= 0,55`.
  - Dilindungi filter makro Daily agar hanya membeli kapitulasi pada aset dengan struktur utama yang sehat.
- **Manajemen Risiko & Exit**:
  - Stop loss di bawah titik terendah ekor kapitulasi (3,0% – 5,0%).
  - Target kembali ke nilai tengah (`4H EMA20 / Bollinger Midline`) dengan minimal `+1,8R` net.
