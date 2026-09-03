# Rencana deployment cloud NusaQuant

## Keputusan arsitektur tahap pertama

Gunakan satu Linux VM persisten untuk menjalankan `dashboard` dan `engine` dari
`compose.yaml`. Keduanya berbagi satu volume `/data` yang berisi SQLite, cache,
snapshot, dan laporan. Ini mempertahankan perilaku lokal saat ini dan menghindari
migrasi database sebelum paper engine terbukti stabil.

```text
Browser
  -> HTTPS + access policy
  -> Cloudflare Tunnel
  -> dashboard container :4173
                         \
                          -> persistent /data/nusaquant.db
                         /
     engine container (satu replika)
       -> Yahoo delayed candles
       -> Arjum enrichment
       -> agent decisions -> risk gate -> paper fills
```

Port 4173 tidak dibuka ke Internet. Hanya `cloudflared` yang membuat koneksi
keluar. Basic Auth aplikasi tetap dipertahankan sebagai lapisan tambahan.

## Pilihan host

1. Pilot biaya nol: Oracle Cloud Always Free Ampere A1 apabila kapasitas tersedia.
   Wajib memiliki backup di luar VM karena instance gratis yang dianggap idle
   dapat direklamasi.
2. Pilot yang lebih dapat diandalkan: VPS kecil berbayar di Singapura/Jakarta,
   minimal 2 vCPU, 4 GB RAM, dan 30-50 GB SSD.
3. Tahap lanjutan: Cloud Run service + Cloud Run jobs + PostgreSQL. Jalur ini baru
   dipilih setelah akses SQLite dipindahkan ke database eksternal dan setiap job
   dibuat idempotent. Database lokal saat ini sekitar 254 MB sehingga database
   gratis 500 MB terlalu sempit untuk pertumbuhan candle dan audit log.

## Jadwal WIB

Semua proses memakai `Asia/Jakarta` dan kalender libur IDX tervalidasi.

| Waktu | Proses |
| --- | --- |
| 07:15 | Self-check, kalender, universe, provider, disk, dan kuota |
| 07:30 | Warmup Arjum universe; cache analysis dan broker summary |
| 08:30 | Susun 100 saham likuid lalu pilih Intraday 50 |
| Sesi 1 dan 2 | Yahoo 5m untuk Intraday 50; evaluasi agen tiap 5 menit |
| Jeda/di luar sesi | Tidak membentuk candle dan tidak menghitung usia sinyal |
| 16:15 | Koleksi daily, mark-to-market, expiry/cancel, dan rekonsiliasi |
| 16:30 | Daily report, snapshot immutable, backup SQLite |
| Mingguan | Fundamental/laporan keuangan yang stale dan housekeeping |

Engine harus menjadi satu-satunya writer utama. Setiap run memiliki lock dan
idempotency key `(trading_date, phase, bucket, strategy_version)` agar restart
tidak menghasilkan keputusan atau fill ganda. Warmup Arjum tidak dijalankan lagi
setiap kali container restart; status penyelesaian disimpan per tanggal.

## Pemakaian provider

- Yahoo: candle delayed untuk paper trading, diambil secara batch untuk Intraday
  50 setiap lima menit dan daily universe setelah penutupan.
- Arjum: analysis dan broker summary universe sekali per hari; endpoint lebih
  mahal hanya untuk kandidat. Fundamental dan laporan keuangan diperbarui ketika
  stale atau ada periode laporan baru, bukan setiap lima menit.
- Halaman dashboard hanya membaca snapshot/database. Membuka halaman tidak boleh
  memanggil provider.
- Sisakan sekurangnya 20% kuota harian untuk retry, inspeksi manual, dan recovery.

## Hardening sebelum trafik dibuka

- Simpan `.env` hanya di VM dengan permission ketat; jangan masukkan API key atau
  password ke image, log, database export, atau Git.
- Pertahankan `NQ_ENV=production`, `NQ_DEMO_MODE=false`, dan
  `NQ_PAPER_ONLY=true`.
- Aktifkan SQLite WAL, busy timeout, integrity check harian, dan satu engine
  replica.
- Tambahkan health check untuk proses web dan heartbeat engine, bukan hanya HTTP.
- Log terstruktur dengan rotasi; jangan log token atau respons sensitif.
- Pin dependency/image version dan gunakan image release bertag, bukan build acak
  langsung dari working tree.
- Batasi login melalui Cloudflare Access ke email yang diizinkan dan tetap
  gunakan password aplikasi yang berbeda.
- Jangan membuka SSH ke seluruh Internet; gunakan bastion/tunnel atau allowlist.

## Backup dan pemulihan

- Buat online SQLite backup setelah close dan snapshot tambahan setiap satu jam
  selama sesi.
- Salin backup terenkripsi ke storage/provider berbeda dari VM.
- Retensi minimum: 7 harian, 4 mingguan, dan 3 bulanan.
- Target awal: RPO maksimal 1 jam dan RTO maksimal 30 menit.
- Uji restore ke folder sementara sebelum menyatakan backup valid.

## Alert wajib

- heartbeat engine lebih lama dari 10 menit saat sesi;
- daily report belum ada pada 16:45;
- run gagal, lock menggantung, atau fill duplikat;
- data Yahoo/Arjum stale atau kuota mencapai 80%;
- disk lebih dari 80%, backup gagal, database integrity check gagal;
- equity, cash, posisi, order, dan ledger tidak rekonsiliasi.

## Urutan pelaksanaan

1. Hardening scheduler/idempotency, heartbeat, WAL, backup, dan alert di lokal.
2. Buat Git repository privat dan pipeline build/test image.
3. Provision VM dan persistent disk, lalu pasang Docker dan `cloudflared`.
4. Restore salinan database lokal, isi secrets di VM, dan jalankan Compose.
5. Pasang domain, TLS, dan Access policy; port 4173 tetap private.
6. Jalankan readiness dan simulasi restart/restore.
7. Shadow-run selama 3-5 hari bursa dan bandingkan semua run dengan lokal.
8. Setelah rekonsiliasi konsisten, jadikan cloud sebagai instance utama dan
   hentikan engine lokal agar tidak ada dua writer.

## Kriteria siap online

- Dashboard dapat diakses melalui HTTPS dan hanya oleh identitas yang diizinkan.
- Satu engine aktif, heartbeat sehat, jadwal mengikuti sesi dan libur IDX.
- Tidak ada keputusan/fill ganda setelah container atau VM restart.
- Intraday 50, keputusan lima agen, risk gate, paper fill, dan daily report
  terselesaikan otomatis.
- Backup di luar VM berhasil direstore.
- Provider quota, data freshness, dan rekonsiliasi terlihat pada dashboard.
- Seluruh pengujian lokal dan smoke test cloud lulus; mode tetap paper-only.

