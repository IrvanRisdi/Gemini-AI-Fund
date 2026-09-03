# NusaQuant

MVP dashboard multi-agent paper trading untuk saham Indonesia. Tampilan menggabungkan screener IDX, agent fund, trading plan, posisi, dan audit trail.

## Menjalankan

Tidak ada dependency yang perlu di-install. Dari folder proyek:

```powershell
python server.py
```

Lalu buka `http://localhost:4173`.

Untuk operasi online tanpa PC lokal, workflow `IDX Paper Trading Loop` menjalankan
satu siklus engine setiap lima menit pada jendela sesi IDX. Setiap runner bersifat
sementara, sehingga ledger, posisi, order, journal, ranking screener, dan laporan
dipersistenkan sebagai JSON ringkas di `.stock-desk/`. Database SQLite, candle
mentah, dan payload provider tidak dimasukkan ke Git.

Secret repository yang wajib disiapkan:

```text
ARJUM_API_KEY
```

Jadwal GitHub menggunakan UTC, sementara engine tetap menjadi sumber kebenaran
untuk jam sesi WIB dan kalender libur IDX. `workflow_dispatch` tersedia untuk
pengujian manual, tetapi tidak memaksa engine berdagang ketika pasar tutup.

## Struktur

- `index.html` — shell dan komponen dashboard.
- `styles.css` — tema responsif.
- `app.js` — dashboard dan interaksi.
- `server.py` — API lokal, SQLite, static server, dan route detail.
- `agent.html` / `stock.html` / `reports.html` — halaman detail berbasis API.
- `data/nusaquant.db` — database runtime, dibuat otomatis dan tidak dimasukkan Git.

Dashboard utama dan halaman detail membaca API SQLite lokal. Seed simulasi hanya aktif saat `NQ_DEMO_MODE=true`; produksi dimulai kosong dan menunggu hasil evaluasi nyata. Backend meng-cache data Arjum/Yahoo sehingga lima agen tidak memanggil provider secara langsung.

Mode produksi, deployment Docker, readiness gate, backup, dan checklist operasional dijelaskan di [`docs/GO_LIVE.md`](docs/GO_LIVE.md). Adapter provider dijalankan eksplisit melalui `jobs.py`; request halaman tidak pernah memicu pengambilan data eksternal.

Sumber data resmi, governance kalender, dan importer file unduhan IDX dijelaskan di [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Delayed-paper engine

Yahoo IDX diberi label `DELAYED` (default 10 menit). Engine dapat dijalankan manual dengan `python engine.py run --force`, diperiksa dengan `python engine.py status`, atau dijalankan sebagai worker dengan `python engine.py daemon`. Worker mengoleksi kandidat intraday setiap lima menit, menghitung feature bersama, menjalankan lima evaluator, melewatkan proposal ke portfolio/risk gate, dan hanya mensimulasikan fill pada candle berikutnya.

Sebelum produksi, impor master emiten aktif dari file unduhan resmi IDX dan kalender libur resmi:

```powershell
python jobs.py import-idx-universe path\to\idx-stock-list.xlsx
python engine.py import-holidays idx_holidays.json
```

Format kalender adalah `{"status":"VALIDATED","year":2026,"holidays":["2026-01-01"]}`. Dashboard tetap read-only terhadap provider; status worker tersedia di `/api/engine/status`.

## Prinsip arsitektur

- Lima agen menggunakan paper ledger dan equity yang terisolasi.
- Scanner dan paper executor harus deterministik; AI tidak menentukan fill.
- Semua proposal melewati hard risk guardrails dan reward gate minimal 1:1,5.
- AI Console hanya membaca snapshot fund saat diminta dan tidak memiliki izin order.
- Arjum digunakan sebagai enrichment/screener yang di-cache; Yahoo digunakan untuk prototipe candle intraday.
- Daily Scan Report membaca artefak hasil proses yang tersimpan dan tidak menarik API baru saat halaman dibuka.
- Universe produksi mencakup seluruh emiten IDX berstatus aktif. Indeks seperti Kompas100/LQ45 hanya menjadi filter tampilan opsional, bukan batas scanner.

## Alur laporan tanpa scan ulang

```text
Scheduled scanner / evaluasi agen
  -> evaluation_snapshot_YYYY-MM-DD.json
  -> penyimpanan historis
  -> Daily Report API
  -> dashboard
```

Dashboard tidak memanggil Arjum atau Yahoo ketika laporan dibuka. Ia hanya membaca snapshot evaluasi terbaru atau snapshot historis berdasarkan tanggal. Jika snapshot belum tersedia, status laporan harus `NOT_READY`; sistem tidak boleh diam-diam menjalankan scanner.

Kontrak contoh tersedia pada `data/evaluation_snapshot_2026-08-26.json`.

Pola ini mengadaptasi pemisahan desk state, scanner, executor, risk policy, dan on-demand AI console dari proyek MIT [Gemini AI Fund](https://github.com/IrvanRisdi/Gemini-AI-Fund), lalu mengganti domain kripto dengan kebutuhan saham IDX.
