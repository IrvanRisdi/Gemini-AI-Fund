---
date: "2026-08-25"
time: "2026-08-25T09:44:21.391Z"
session: "ASIA_OPEN"
report_version: "spot-paper-v2"
---

# Evaluasi Sesi Pasar — Asia Open

> Laporan keputusan paper trading. Semua angka berasal dari ledger dan hasil scan; bukan ajakan beli atau jual.

## 1. Ringkasan keputusan

| Status | Nilai |
| --- | --- |
| Sikap desk | WAIT — belum ada setup tervalidasi |
| Mode | spot-only-paper-v2 |
| Kesehatan data | NORMAL |
| Pair dipindai | 19 |
| Kandidat scan | 0 |
| Posisi terbuka | 0 |
| Pending order | 0 |

**Keputusan sesi:** Tidak ada eksekusi. Tetap scan dan buat pending order hanya bila seluruh aturan strategi terpenuhi.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-08-25T09:36:31.145Z |
| Siklus ledger terakhir | 2026-08-25T09:36:42.945Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 250.000.000 | Rp 0 | Rp 250.000.000 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 50.000.000 | Rp 0 | 0 | 0 |
| mean-reversion-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| smc-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| wyckoff-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |
| aggressive-breakout-trader | Rp 50.000.000 | Rp 0 | 0 | 0 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| - | - | - | - | - | - |

Kandidat scan belum otomatis menjadi transaksi. Executor menolak order non-long/spot, melebihi equity, melampaui risiko kampanye 5%, atau R:R di bawah 1:1.5.

## 5. Prioritas strategi sesi berikutnya

| Strategi | Peran | Syarat tindakan |
| --- | --- | --- |
| Breakout | Momentum tren | Breakout 1H searah tren 4H dan volume valid; gunakan pending retest. |
| Mean reversion | Pasar ranging | Hanya saat ADX 4H rendah dan reversal terkonfirmasi. |
| SMC | Struktur tren | Sweep dan CHoCH di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Wyckoff | Akumulasi | Spring dan test valid di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Aggressive breakout | Peluang volatil | ADX dan volume tinggi; tetap tunduk risiko kampanye 5%. |

## 6. Guardrail risiko

- Spot dan long-only; tidak ada short atau leverage.
- Satu kampanye aktif per agen/pair; breakout dapat pyramid setelah +1R sesuai aturan.
- Risiko maksimum kampanye 5% equity agen, fee simulasi 0,3% per sisi.
- Jika data scan error, tidak ada order baru sampai siklus bersih berikutnya.

## 7. Rencana sampai evaluasi berikutnya

1. Scan 19 pair dan validasi struktur 4H sebelum trigger 1H.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Tidak tersedia pada siklus ini. Laporan operasional tetap lengkap karena dibuat dari data desk.
