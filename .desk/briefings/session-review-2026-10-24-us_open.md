---
date: "2026-10-24"
time: "2026-10-24T16:49:07.465Z"
session: "US_OPEN"
report_version: "spot-paper-v2"
---

# Evaluasi Sesi Pasar — US Open

> Laporan keputusan paper trading. Semua angka berasal dari ledger dan hasil scan; bukan ajakan beli atau jual.

## 1. Ringkasan keputusan

| Status | Nilai |
| --- | --- |
| Sikap desk | WAIT — belum ada setup tervalidasi |
| Mode | spot-only-paper-v2 |
| Kesehatan data | NORMAL |
| Pair dipindai | 39 |
| Kandidat scan | 0 |
| Posisi terbuka | 0 |
| Pending order | 0 |

**Keputusan sesi:** Tidak ada eksekusi. Tetap scan dan buat pending order hanya bila seluruh aturan strategi terpenuhi.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-10-24T16:45:40.358Z |
| Siklus ledger terakhir | 2026-10-24T16:45:41.500Z |
| Error data | 0 |
| Rezim pasar | BTC 4H netral/korektif; strategi selektif tetap berjalan sesuai filter masing-masing (BTC 79,803.75 USDT, ADX 22.3) |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 300.000.000 | Rp 0 | Rp 300.000.000 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 50.000.000 | Rp 0 | 0 | 0 |
| mean-reversion-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| smc-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| wyckoff-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| aggressive-breakout-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| asymmetry-journal-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| - | - | - | - | - | - |

Kandidat scan belum otomatis menjadi transaksi. Executor menolak order non-long/spot, melebihi equity, melampaui risk budget adaptif, atau R:R di bawah batas strategi. Seluruh 6 agen kini menjalankan strategi v6 yang telah tervalidasi memiliki Profit Factor (PF) > 1,0 setelah biaya 0,30% per sisi.

## 5. Prioritas strategi sesi berikutnya

| Strategi | Peran | Syarat tindakan |
| --- | --- | --- |
| Breakout (4H RS) | Momentum relative strength | Close 4H menembus high 24-bar, RVOL ≥2,5x, close strength ≥75%, RS 24j ≥+2% vs BTC; alokasi 30%, target bersih 3R (PF 1,94). |
| Aggressive breakout (1H RS) | Momentum kecepatan tinggi | Close 1H menembus high 24j, RVOL ≥3,5x, close strength ≥75%, RS 24j ≥+2% vs BTC; target bersih 3R (PF 1,46). |
| Mean reversion (4H Capitulation) | Rebound kapitulasi ekstrem | RSI 4H ≤30 di bawah Bollinger bawah + bullish engulfing close strength ≥60%; alokasi 25%, target bersih 2R (PF 2,42). |
| Wyckoff (4H Phase-D SoS) | Akumulasi & retest LPS | Konsolidasi 45 bar 4H ≤6,5 ATR, breakout RVOL ≥1,6x, close strength ≥70%; entry limit retest range high, target bersih 2,5R (PF 1,84). |
| SMC (15m 24-Bar Sweep) | Likuiditas & struktur tren | Sweep low 24 candle (6 jam) lalu reclaim close strength ≥65% searah tren 15m/4H; limit di tengah candle reclaim, target 3R (PF 1,21). |
| Asymmetry Journal (1D Cash-Flow) | Fundamental & struktur harian | Finalis MC/HR ≤150x tanpa penurunan revenue MoM >10%, tren harian tidak turun, filter BTC di atas EMA50 harian, R:R bersih ≥1,75R (PF 1,99). |

## 6. Guardrail risiko

- Spot dan long-only; tidak ada short atau leverage.
- Satu kampanye aktif per agen/pair; inverted pyramiding telah dihapus agar harga rata-rata entry tidak pernah melampaui stop loss protektif.
- Stop dirancang pada rentang 3–5% harga. Risk budget equity adaptif: 3% normal, 2% pada drawdown ≥5%, dan 1% pada drawdown ≥10%; fee simulasi 0,3% per sisi.
- Jumlah kampanye turun otomatis dari 4 menjadi 3/2 ketika agen masuk recovery mode.
- Proteksi breakeven menggunakan formula net-positif (`entry * ((1 + fee) / (1 - fee) + 0.001)`) agar menutup biaya beli dan jual.
- Jika data scan error, tidak ada order baru sampai siklus bersih berikutnya.

## 7. Rencana sampai evaluasi berikutnya

1. Scan 39 pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Tidak tersedia pada siklus ini. Laporan operasional tetap lengkap karena dibuat dari data desk.
