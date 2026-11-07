---
date: "2026-09-15"
time: "2026-09-15T17:44:04.003Z"
session: "US_OPEN"
report_version: "spot-paper-v2"
---

# Evaluasi Sesi Pasar — US Open

> Laporan keputusan paper trading. Semua angka berasal dari ledger dan hasil scan; bukan ajakan beli atau jual.

## 1. Ringkasan keputusan

| Status | Nilai |
| --- | --- |
| Sikap desk | SELECTIVE — kelola order/posisi aktif |
| Mode | spot-only-paper-v2 |
| Kesehatan data | NORMAL |
| Pair dipindai | 50 |
| Kandidat scan | 3 |
| Posisi terbuka | 8 |
| Pending order | 352 |

**Keputusan sesi:** Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-09-15T17:30:54.739Z |
| Siklus ledger terakhir | 2026-09-15T17:30:56.666Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 79.508.413 | Rp 0 | Rp 79.508.413 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 11.545.507 | Rp 0 | 2 | 121 |
| mean-reversion-trader | Rp 21.807.520 | Rp 0 | 1 | 26 |
| smc-trader | Rp 25.457.876 | Rp 0 | 1 | 23 |
| wyckoff-trader | Rp 4.539.725 | Rp 0 | 2 | 76 |
| aggressive-breakout-trader | Rp 16.157.785 | Rp 0 | 2 | 106 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| breakout-specialist | skyaiidr | pending | - | - | - |
| aggressive-breakout-trader | skyaiidr | pending | - | - | - |
| wyckoff-trader | skyaiidr | pending | - | - | - |

Kandidat scan belum otomatis menjadi transaksi. Executor menolak order non-long/spot, melebihi equity, melampaui risiko kampanye 5%, atau R:R di bawah 1:1.5.

## 5. Prioritas strategi sesi berikutnya

| Strategi | Peran | Syarat tindakan |
| --- | --- | --- |
| Breakout | Trend-following bertahap | Trigger 15m searah tren 4H; mulai 25%, tambah pada +0,5R/+1R/+1,5R, target bersih 2,5R. |
| Mean reversion | Pasar ranging | Hanya saat ADX 4H rendah dan reversal terkonfirmasi. |
| SMC | Struktur tren | Sweep dan CHoCH di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Wyckoff | Akumulasi | Spring dan test valid di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Aggressive breakout | Momentum terkonsentrasi | Entry langsung 60%/85%/hampir 100% sesuai skor dan relative volume; risiko bersih tetap maksimum 5%. |

## 6. Guardrail risiko

- Spot dan long-only; tidak ada short atau leverage.
- Satu kampanye aktif per agen/pair; breakout dapat pyramid pada +0,5R, +1R, dan +1,5R.
- Stop dirancang pada rentang 3–5% harga; risiko bersih maksimum kampanye 5% equity agen dan fee simulasi 0,3% per sisi.
- Target minimum dihitung setelah fee: 1,5R bersih untuk strategi umum dan 2,5R untuk kampanye breakout bertahap.
- Jika data scan error, tidak ada order baru sampai siklus bersih berikutnya.

## 7. Rencana sampai evaluasi berikutnya

1. Scan 50 pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Tidak tersedia pada siklus ini. Laporan operasional tetap lengkap karena dibuat dari data desk.
