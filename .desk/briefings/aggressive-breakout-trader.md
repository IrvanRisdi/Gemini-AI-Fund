# Aggressive Breakout Trader — Metodologi Terukur

## Tujuan

Agen momentum cepat untuk breakout 15 menit. Berbeda dari Breakout Specialist, agen ini tidak melakukan pyramid: satu entry berkualitas tinggi, satu campaign.

## Data dan filter

- Signal: 15 menit; konteks: 4H; fill: 1 menit.
- BTC tidak menjadi syarat.
- Pair wajib memenuhi:

```text
EMA9_4H > EMA21_4H
Close_4H >= EMA9_4H
ADX14_4H >= 14
ATR_15m / Close_15m <= 8%
```

## Kondisi momentum

```text
Close_15m >= 0.998 × Resistance_20bar
```

dan skor minimal 3/5 dari volume relatif >=1,5, close strength >=70%, body 0,5–1,8 ATR, EMA9_15m > EMA21_15m, serta ekstensi breakout <=0,75 ATR.

## Trading plan

```text
Entry  = High_15m × 1.0003
Stop   = max(Resistance - 0.25×ATR, Entry - 1.15×ATR)
Target = Entry + max(1.5R, 1%×Entry)
R      = Entry - Stop
```

Order buy-stop berlaku 4 jam. Jika tidak ada kelanjutan harga, tidak ada posisi. Ini sengaja: strategi agresif mengejar continuation, bukan memprediksi pembalikan.

## Risiko

Risiko nominal maksimum 5% ekuitas, notional maksimum 100% ekuitas termasuk fee 0,3%. Tidak ada averaging down atau pyramid.


## Alokasi portofolio

- Maksimum **25% ekuitas agen per koin** dan maksimal **empat campaign** aktif (posisi atau pending order).
- Minimal 10% ekuitas tetap menjadi kas cadangan.
- Risiko gabungan posisi terbuka dan pending order dibatasi 10% ekuitas; setiap campaign tetap maksimum 5%.
- Dengan demikian ukuran akhir menggunakan batas terkecil berikut:

```text
Size = min(25%×Equity/Entry, 5%×Equity/R, SisaRisk/R, SisaKas/(Entry×1.003))
```
