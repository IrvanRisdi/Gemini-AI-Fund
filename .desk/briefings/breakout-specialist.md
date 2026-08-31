# Breakout Specialist — Metodologi Terukur

## Tujuan

Menangkap kelanjutan breakout pada pair yang sudah memiliki tren naik 4H. Agen ini tidak membeli hanya karena harga mendekati resistance; order hanya terisi bila harga benar-benar menembus high 15 menit.

## Data dan timeframe

- Entry signal: candle **15 menit** yang sudah selesai.
- Filter regime: candle **4H**.
- Eksekusi pending order: candle **1 menit**.
- BTC bukan lagi filter global; pair dinilai berdasarkan struktur pair itu sendiri.

## Filter pasar

Pair harus memenuhi:

```text
EMA9_4H > EMA21_4H
Close_4H >= EMA9_4H
ADX14_4H >= 14
ATR_15m / Close_15m <= 8%
```

Resistance adalah high maksimum dari 20 candle 15 menit sebelumnya:

```text
Resistance = max(High[t-20 ... t-1])
```

## Setup dan entry

Harga harus sudah dekat dengan resistance:

```text
Close_15m >= 0.997 × Resistance
```

Skor breakout minimal 3 dari 5:

1. Volume relatif >= 1,5× rata-rata 20 candle sebelumnya.
2. Posisi close dalam candle >= 70% dari rentang candle.
3. Body candle berada pada 0,5–1,8 ATR.
4. EMA9_15m > EMA21_15m.
5. Ekstensi dari resistance <= 0,75 ATR.

Order adalah buy-stop:

```text
Entry = High_15m × 1.0005
Stop  = max(Resistance - 0.25×ATR, Entry - 1.20×ATR)
Target = Entry + max(1.5×(Entry-Stop), 1%×Entry)
```

Order berlaku 6 jam. Bila harga turun melewati stop sebelum entry, order dibatalkan.

## Risiko dan audit

- Risiko maksimum per campaign: 5% ekuitas agen.
- Notional maksimum: 100% ekuitas; fee masuk 0,3% tetap masuk batas kas.
- Ukuran posisi:

```text
Size = min(NotionalCap / Entry, 0.05×Equity / (Entry-Stop))
```

- Breakout Specialist dapat menambah maksimal empat leg 25% hanya setelah posisi bergerak menguntungkan per 1R.
- Setelah +1,25R, stop dinaikkan minimal ke level biaya.
