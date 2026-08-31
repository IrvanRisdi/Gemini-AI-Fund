# SMC Trader — Metodologi Terukur

## Tujuan

Membeli reclaim setelah liquidity sweep 15 menit, tetapi hanya pada demand zone yang teridentifikasi. Agen memakai limit entry di zona, bukan buy-stop yang mengejar harga.

## Struktur dan demand zone

Filter tren 4H:

```text
EMA9_4H > EMA21_4H
Close_4H >= EMA9_4H
ADX14_4H >= 14
```

Liquidity sweep dan change of character:

```text
Sweep: Low candle sebelumnya < min(Low 7 candle sebelumnya)
CHoCH: Close sekarang > High candle sweep
       dan Close sekarang > Open sekarang
```

Demand zone berasal dari 32 candle terakhir:

```text
RecentLow = min(Low)
RecentHigh = max(High)
ZoneHigh = RecentLow + 0.30×(RecentHigh-RecentLow)
```

Harga harus berada di sekitar zona demand. Selain itu volume relatif >=0,9 dan skor konteks minimal 3/4 (demand zone, Fibonacci/engulfing, body >=0,4 ATR, close strength >=55%).

## Trading plan

```text
EntryRef = min(ZoneHigh, Close)
Entry zone = [max(ZoneLow, EntryRef-0.30×ATR), EntryRef]
Stop = min(ZoneLow - 0.15×ATR, ZoneLowEntry - 0.50×ATR)
Target = Entry + max(1.8R, 1%×Entry)
```

Order limit berlaku 8 jam. Setup yang tidak memiliki demand zone tidak dieksekusi.

## Risiko dan evaluasi

- Risiko maksimum 5% ekuitas.
- Target 1,8R dipilih agar payoff setelah fee 0,6% lebih memadai.
- Evaluasi wajib membandingkan kedalaman sweep, jarak entry ke ZoneLow, volume relatif, skor konteks, dan hasil target/stop.
