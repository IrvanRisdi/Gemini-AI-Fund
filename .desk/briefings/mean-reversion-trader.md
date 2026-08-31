# Mean Reversion Trader — Metodologi Terukur

## Tujuan

Membeli pantulan dari batas bawah range menuju rata-rata harga. Agen ini **tidak aktif pada tren kuat** dan tidak memakai pullback EMA sebagai syarat entry.

## Regime pasar

Signal hanya boleh muncul ketika 4H dan 15 menit sama-sama menunjukkan kondisi ranging:

```text
ADX14_4H <= 24
|EMA9_4H - EMA21_4H| / EMA21_4H <= 1.8%
CHOP14_4H >= 52
CHOP14_15m >= 50
(RangeHigh20 - RangeLow20) / Close15m <= 12%
ATR14_15m / Close15m <= 8%
```

CHOP (Choppiness Index) mengukur apakah pergerakan lebih bolak-balik daripada directional. Nilai tinggi bersama ADX rendah dan EMA rapat berarti mean reversion lebih layak daripada breakout.

## Setup entry

Harga harus menguji Bollinger Band bawah lalu menunjukkan pantulan yang masih berada di bawah middle band:

```text
Low15m <= 1.006 × LowerBB20,2
Close15m <= MiddleBB20,2
RSI14_15m <= 48
RSI sekarang naik atau RSI candle sebelumnya <= 42
0.4 <= RelativeVolume15m <= 2.2
Close15m > Open15m
```

Volume yang terlalu besar justru ditolak karena dapat menandakan breakdown/breakout, bukan pantulan range.

## Trading plan

```text
EntryRef = min(Close, LowerBB + 0.15×ATR)
Entry zone = [max(LowerBB - 0.20×ATR, EntryRef - 0.30×ATR), EntryRef]
Stop = min(RangeLow20 - 0.25×ATR, ZoneLow - 0.35×ATR)
Target = MiddleBB20,2
R = Entry - Stop
```

Order buy-limit berlaku 8 jam dan hanya dibuat bila target middle band masih memberi reward/risk minimal 1,5:1. Jika harga menembus stop sebelum menyentuh zona entry, order dibatalkan.

## Risiko dan audit

- Risiko maksimum 5% ekuitas per campaign.
- Catat ADX, CHOP, lebar range, posisi terhadap Bollinger, RSI, volume relatif, serta hasil target/stop per pair.
- Hasil strategi harus dievaluasi terpisah dari strategi tren; jangan gabungkan metriknya.

## Alokasi portofolio

- Maksimum **25% ekuitas agen per koin** dan maksimal **empat campaign** aktif (posisi atau pending order).
- Minimal 10% ekuitas tetap menjadi kas cadangan.
- Risiko gabungan posisi terbuka dan pending order dibatasi 10% ekuitas; setiap campaign tetap maksimum 5%.

```text
Size = min(25%×Equity/Entry, 5%×Equity/R, SisaRisk/R, SisaKas/(Entry×1.003))
```
