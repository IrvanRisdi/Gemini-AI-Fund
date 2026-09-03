# Go-live NusaQuant

Target awal adalah dashboard riset dan **paper trading pribadi**. Sistem belum boleh mengirim order broker. `NQ_PAPER_ONLY=true` adalah guard yang wajib; endpoint readiness gagal bila guard ini dimatikan.

## Prasyarat eksternal

- Host dengan volume persisten, domain, dan TLS.
- Access control di depan aplikasi (misalnya Cloudflare Access, VPN, atau reverse proxy berautentikasi). Server bawaan bukan lapisan autentikasi publik.
- Untuk deployment sederhana tersedia HTTP Basic Auth melalui `NQ_ACCESS_USER` dan `NQ_ACCESS_PASSWORD`; TLS tetap harus diterminasi oleh reverse proxy.
- `ARJUM_API_KEY` bila enrichment Arjum dipakai. Kunci hanya berada di environment backend.
- Konfirmasi syarat penggunaan market data sebelum mengubah `NQ_DATA_LICENSE_ACKNOWLEDGED=true`. Yahoo IDX diperlakukan sebagai delayed-paper dan bukan feed realtime/resmi untuk eksekusi.
- Snapshot evaluasi nyata untuk seluruh emiten IDX aktif, bukan seed demo.
- Scheduler eksternal untuk koleksi, evaluasi agen, impor snapshot, dan backup.

## Peluncuran dengan Docker

1. Salin `.env.example` menjadi `.env`, pertahankan `NQ_ENV=production`, `NQ_DEMO_MODE=false`, dan `NQ_PAPER_ONLY=true`.
2. Isi `ARJUM_API_KEY` hanya bila diperlukan.
3. Jalankan `docker compose up -d --build`.
4. Impor hasil evaluasi yang sudah ada:

   `docker compose exec dashboard python jobs.py import-snapshot /data/evaluation_snapshot_YYYY-MM-DD.json`

5. Jalankan `docker compose exec dashboard python scripts/readiness.py`. Jangan buka trafik bila exit code bukan nol.

Folder `runtime-data` harus dipasang sebagai persistent volume dan ikut backup. Jangan menyimpan `.env` atau database ke Git.

## Pipeline harian

```text
market close -> collector/cache -> feature engine -> 5 agent evaluators
             -> risk gate -> paper executor -> immutable evaluation snapshot
             -> jobs.py import-snapshot -> dashboard/read-only report
```

Halaman dashboard tidak menarik provider. Koleksi eksplisit dapat diuji dengan `python jobs.py collect-symbol BRIS --arjum`; produksi sebaiknya melakukan batch terjadwal dan mencatat pemakaian kuota. Dengan limit 1.000 request/hari, prioritaskan kandidat hasil filter murah, cache per endpoint, dan jangan meminta lima endpoint untuk seluruh bursa setiap hari.

## Operasi

- Health probe: `/api/health`; deployment gate: `/api/system/status`.
- Backup konsisten: `python scripts/backup_db.py`, lalu salin hasil ke penyimpanan di host berbeda.
- Pantau umur snapshot, error job, kuota provider, disk volume, dan restart container.
- Rollback aplikasi memakai image sebelumnya; pertahankan database dan snapshot. Uji pemulihan backup secara berkala.
- Untuk akses publik, terminate TLS dan autentikasi di reverse proxy. Batasi CORS (saat ini tidak diaktifkan) dan jangan expose SQLite/raw cache.

## Kriteria siap

- Readiness `ready=true`, snapshot terbaru tidak stale, dan paper-only aktif.
- Universe master serta corporate action tervalidasi.
- Seluruh agen memiliki backtest/walk-forward, asumsi fee, pajak, lot, tick, slippage, dan liquidity gate.
- Rekonsiliasi equity, posisi, keputusan, dan jurnal lulus setiap hari.
- Alert serta prosedur backup/restore sudah diuji.

Live trading membutuhkan fase terpisah: adapter broker resmi, idempotency, approval/kill switch, rekonsiliasi order/fill, audit log immutable, dan pemeriksaan legal serta ketentuan penyedia data.
