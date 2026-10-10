---
date: "2026-10-04"
time: "2026-10-04T17:46:09.982Z"
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
| Pair dipindai | 37 |
| Kandidat scan | 4 |
| Posisi terbuka | 13 |
| Pending order | 1 |

**Keputusan sesi:** Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-10-04T17:45:41.356Z |
| Siklus ledger terakhir | 2026-10-04T17:45:43.240Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 116.497.163 | Rp 155.323.135 | Rp 271.820.298 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 2.277.752 | Rp 42.381.824 | 2 | 0 |
| mean-reversion-trader | Rp 19.982.384 | Rp 25.103.042 | 3 | 0 |
| smc-trader | Rp 20.541.283 | Rp 20.632.492 | 2 | 0 |
| wyckoff-trader | Rp 11.998.262 | Rp 34.767.278 | 3 | 0 |
| aggressive-breakout-trader | Rp 24.234.983 | Rp 19.938.499 | 2 | 0 |
| asymmetry-journal-trader | Rp 37.462.500 | Rp 12.500.000 | 1 | 1 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| mean-reversion-trader | TRX/USDT | limit | 0.3352238 USDT–0.33528808 USDT | 0.32522944 USDT | 0.36145871 USDT |
| breakout-specialist | SKY/USDT | stop | 0.09452724 USDT–0.09452724 USDT | 0.09169142 USDT | 0.10360783 USDT |
| aggressive-breakout-trader | SKY/USDT | stop | 0.09450834 USDT–0.09450834 USDT | 0.09167309 USDT | 0.10018311 USDT |
| asymmetry-journal-trader | PUMP/USDT | limit | 0.004778 USDT–0.00488988 USDT | 0.00369375 USDT | 0.007532 USDT |

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

1. Scan 37 pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Kondisi data saat ini berstatus normal dengan tiga belas posisi aktif dan satu
