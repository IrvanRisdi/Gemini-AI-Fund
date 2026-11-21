---
date: "2026-10-22"
time: "2026-10-22T03:26:06.561Z"
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
| Pair dipindai | 41 |
| Kandidat scan | 5 |
| Posisi terbuka | 10 |
| Pending order | 0 |

**Keputusan sesi:** Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-10-22T03:20:51.890Z |
| Siklus ledger terakhir | 2026-10-22T03:20:53.460Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 162.611.653 | Rp 100.465.021 | Rp 263.076.675 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 43.243.953 | Rp 0 | 0 | 0 |
| mean-reversion-trader | Rp 11.399.034 | Rp 34.474.335 | 3 | 0 |
| smc-trader | Rp 19.834.469 | Rp 19.886.474 | 2 | 0 |
| wyckoff-trader | Rp 34.336.195 | Rp 11.675.979 | 1 | 0 |
| aggressive-breakout-trader | Rp 30.215.354 | Rp 11.852.706 | 1 | 0 |
| asymmetry-journal-trader | Rp 23.582.648 | Rp 22.575.527 | 3 | 0 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| asymmetry-journal-trader | PUMP/USDT | limit | 0.00495453 USDT–0.00512367 USDT | 0.00476839 USDT | 0.006806 USDT |
| asymmetry-journal-trader | SKY/USDT | limit | 0.075335 USDT–0.07535839 USDT | 0.0724566 USDT | 0.0848 USDT |
| asymmetry-journal-trader | CAKE/USDT | limit | 2.1998 USDT–2.2338 USDT | 2.0498 USDT | 2.797 USDT |
| asymmetry-journal-trader | RAY/USDT | limit | 1.704 USDT–1.7937 USDT | 1.5908 USDT | 2.3561 USDT |
| asymmetry-journal-trader | ORCA/USDT | limit | 1.4189 USDT–1.4936 USDT | 1.2858 USDT | 1.985 USDT |

Kandidat scan belum otomatis menjadi transaksi. Executor menolak order non-long/spot, melebihi equity, melampaui risk budget adaptif, atau R:R di bawah 1:1.5. Pada fase paper trading saat ini, strategi berstatus research boleh membuat order eksperimen; status research tetap ditampilkan agar hasilnya tidak disamakan dengan strategi yang sudah tervalidasi.

## 5. Prioritas strategi sesi berikutnya

| Strategi | Peran | Syarat tindakan |
| --- | --- | --- |
| Breakout | Trend-following bertahap | Regime BTC positif, ADX pair ≥22, close 15m di atas resistance; mulai 20%, target bersih 2,5R. |
| Mean reversion | Pasar ranging | Seluruh enam konfirmasi range/reversal wajib lolos; alokasi 25%, target bersih 2R. |
| SMC | Struktur tren | Sweep dan CHoCH lengkap; entry buy-stop setelah konfirmasi, bukan limit saat harga turun. |
| Wyckoff | Akumulasi | SoS 5/5 dan retest range high, dengan regime BTC positif; target bersih 2R. |
| Aggressive breakout | Momentum terkonsentrasi | Entry 50%/75%/100% hanya setelah breakout, ADX ≥22, dan volume kuat. |

## 6. Guardrail risiko

- Spot dan long-only; tidak ada short atau leverage.
- Satu kampanye aktif per agen/pair; breakout dapat pyramid pada +0,5R, +1R, dan +1,5R.
- Stop dirancang pada rentang 3–5% harga. Risk budget equity adaptif: 3% normal, 2% pada drawdown ≥5%, dan 1% pada drawdown ≥10%; fee simulasi 0,3% per sisi.
- Jumlah kampanye turun otomatis dari 4 menjadi 3/2 ketika agen masuk recovery mode.
- Pada fase paper trading, strategi `research` juga boleh membuat order eksperimen; labelnya tetap dipisahkan dari strategi `validated`.
- Target minimum dihitung setelah fee: 1,5R bersih untuk strategi umum dan 2,5R untuk kampanye breakout bertahap.
- Jika data scan error, tidak ada order baru sampai siklus bersih berikutnya.

## 7. Rencana sampai evaluasi berikutnya

1. Scan 41 pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Kesehatan data terpantau normal dengan sepuluh posisi aktif berjalan dan tanpa antrean
