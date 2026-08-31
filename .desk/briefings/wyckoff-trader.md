# Wyckoff Trader — Metodologi Terukur

## Tujuan

Menangkap retest setelah Sign of Strength (SoS) / Phase D pada range 15 menit. Agen ini menunggu retest range high, bukan mengejar candle breakout.

## Definisi range dan regime

Range memakai 40 candle 15 menit sebelumnya:

```text
RangeLow  = min(Low[t-40 ... t-1])
RangeHigh = max(High[t-40 ... t-1])
```

Kondisi range 4H:

```text
12 <= ADX14_4H < 30
EMA9_4H >= EMA21_4H
|EMA9_4H - EMA21_4H| / EMA21_4H < 3%
```

BTC bukan filter global.

## Sign of Strength

Skor SoS minimal 3 dari 5:

1. Close 15 menit > RangeHigh.
2. Volume relatif >=1,5.
3. Close strength >=70%.
4. Body candle >=0,5 ATR.
5. Lebar range <=7 ATR.

## Trading plan

Zona entry dibuat nyata, bukan lagi satu harga:

```text
Entry zone = [RangeHigh - 0.30×ATR, RangeHigh]
Stop = min(RangeHigh - 1.10×ATR, ZoneLow - 0.70×ATR)
Target = Entry + max(1.5R, 1%×Entry)
```

Order limit berlaku 8 jam. Jika harga menembus stop sebelum retest zone, order dibatalkan. Cooldown 2 jam mencegah order pair yang sama dibuat ulang setelah percobaan gagal.

## Risiko

Risk per campaign maksimum 5% ekuitas; ukuran posisi dihitung dari jarak entry–stop dan dibatasi oleh kas spot yang tersedia.
