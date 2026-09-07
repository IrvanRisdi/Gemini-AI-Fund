---
date: "2026-09-07"
time: "2026-09-07T03:03:33.225Z"
session: "ASIA_OPEN"
report_version: "spot-paper-v2"
---

# Evaluasi Sesi Pasar — Asia Open

> Laporan keputusan paper trading. Semua angka berasal dari ledger dan hasil scan; bukan ajakan beli atau jual.

## 1. Ringkasan keputusan

| Status | Nilai |
| --- | --- |
| Sikap desk | SELECTIVE — kelola order/posisi aktif |
| Mode | spot-only-paper-v2 |
| Kesehatan data | NORMAL |
| Pair dipindai | 50 |
| Kandidat scan | 6 |
| Posisi terbuka | 12 |
| Pending order | 247 |

**Keputusan sesi:** Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-09-07T03:00:55.283Z |
| Siklus ledger terakhir | 2026-09-07T03:00:57.414Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 71.643.902 | Rp 0 | Rp 71.643.902 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 9.714.592 | Rp 0 | 3 | 81 |
| mean-reversion-trader | Rp 23.774.067 | Rp 0 | 1 | 13 |
| smc-trader | Rp 28.507.383 | Rp 0 | 1 | 15 |
| wyckoff-trader | Rp 4.737.032 | Rp 0 | 4 | 61 |
| aggressive-breakout-trader | Rp 4.910.828 | Rp 0 | 3 | 77 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| breakout-specialist | shibidr | pending | - | - | - |
| aggressive-breakout-trader | shibidr | pending | - | - | - |
| breakout-specialist | uaiidr | pending | - | - | - |
| aggressive-breakout-trader | uaiidr | pending | - | - | - |
| breakout-specialist | asteridr | pending | - | - | - |
| aggressive-breakout-trader | asteridr | pending | - | - | - |

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
