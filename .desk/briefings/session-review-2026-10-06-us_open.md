---
date: "2026-10-06"
time: "2026-10-06T18:59:40.054Z"
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
| Pair dipindai | 47 |
| Kandidat scan | 4 |
| Posisi terbuka | 14 |
| Pending order | 3 |

**Keputusan sesi:** Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | 2026-10-06T18:45:43.787Z |
| Siklus ledger terakhir | 2026-10-06T18:45:45.708Z |
| Error data | 0 |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| Rp 119.464.643 | Rp 154.049.109 | Rp 273.513.751 | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
| breakout-specialist | Rp 4.414.324 | Rp 40.713.532 | 3 | 0 |
| mean-reversion-trader | Rp 21.263.993 | Rp 25.577.498 | 3 | 0 |
| smc-trader | Rp 20.541.283 | Rp 20.632.492 | 2 | 0 |
| wyckoff-trader | Rp 11.998.262 | Rp 34.767.278 | 3 | 0 |
| aggressive-breakout-trader | Rp 24.234.983 | Rp 19.938.499 | 2 | 0 |
| asymmetry-journal-trader | Rp 37.011.799 | Rp 12.419.809 | 1 | 3 |

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
| asymmetry-journal-trader | CAKE/USDT | limit | 1.995 USDT–2.1998 USDT | 1.9395 USDT | 2.797 USDT |
| asymmetry-journal-trader | SKY/USDT | limit | 0.08164682 USDT–0.08277125 USDT | 0.07636705 USDT | 0.10208 USDT |
| asymmetry-journal-trader | PUMP/USDT | limit | 0.0047645 USDT–0.00518053 USDT | 0.00369375 USDT | 0.007532 USDT |
| asymmetry-journal-trader | CRV/USDT | limit | 0.36304822 USDT–0.37058333 USDT | 0.352433 USDT | 0.4061 USDT |

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

1. Scan 47 pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.

## 8. Catatan CIO (interpretasi AI)

Catatan CIO. Sikap risiko kita saat ini adalah selektif dengan fokus utama pada pengelolaan order dan posisi aktif yang sudah berjalan. Portofolio mencatat empat belas posisi terbuka dan tiga order pending, sementara pipeline kandidat menyisakan empat potensi masuk. Kondisi ini menuntut kedisiplinan eksekusi agar eksposur tetap terkontrol di tengah dinamika pasar spot yang berjalan.

Kesehatan data terpantau normal dan mendukung keandalan analisis harian tanpa hambatan teknis. Stabilitas infrastruktur ini memastikan setiap keputusan operasional didasarkan pada informasi yang akurat dan tepat waktu.

Untuk scan berikutnya, konfirmasi yang diperlukan mencakup validasi kekuatan tren pada kandidat yang ada serta evaluasi ulang rasio risiko terhadap imbal hasil sebelum menambah posisi baru. Kita tetap mengutamakan kualitas manajemen risiko daripada kuantitas transaksi.
