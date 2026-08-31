# Mean Reversion Trader — Metodologi Terukur

## Tujuan

Membeli pullback yang sudah kembali menunjukkan penerimaan harga dalam tren naik 4H. Agen tidak lagi memakai buy-stop di atas high; entry memakai buy-limit dekat EMA agar tidak mengejar harga.

## Filter tren dan kualitas

```text
EMA9_4H > EMA21_4H
Close_4H >= EMA9_4H
ADX14_4H >= 14
Volume_15m >= rata-rata volume 20 candle
RSI14_15m >= 48
```

Skor pullback minimal 4 dari 5:

1. Low menyentuh/berada dekat EMA21: Low <= 1.003×EMA21.
2. Close candle sebelumnya <= EMA9 sebelumnya.
3. Close sekarang > EMA9.
4. Candle sekarang bullish.
5. RSI berada pada 42–65.

## Trading plan

```text
EntryRef = max(EMA21, min(EMA9, Close))
Entry zone = [EntryRef - 0.30×ATR, EntryRef]
SwingLow = min(Low 6 candle terakhir)
Stop = min(SwingLow - 0.15×ATR, ZoneLow - 0.50×ATR)
Target = Entry + max(1.8R, 1%×Entry)
R = Entry - Stop
```

Order limit berlaku 8 jam. Stop tidak diperlebar setelah entry: bila struktur pullback gagal, thesis dianggap salah. Target 1,8R dipakai agar payoff bersih lebih layak terhadap total fee 0,6%.

## Risiko dan evaluasi

- Risiko maksimum 5% ekuitas.
- Posisi hanya dibuka pada zona limit yang tersentuh.
- Setelah +1,25R, stop dinaikkan untuk menutup biaya.
- Auditor perlu mencatat skor pullback, RSI, volume relatif, jarak stop (%), serta outcome per pair.
