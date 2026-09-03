# Gemini AI Fund Dashboard

Dashboard riset dan paper-trading aset kripto untuk penggunaan pribadi. Aplikasi ini memadukan data pasar Indodax, analisis teknikal multi-timeframe, catatan strategi agen, fundamental koin, berita, dan Gemini Console dalam satu antarmuka berbahasa Indonesia.

> Status: untuk riset dan paper trading. Bukan aplikasi eksekusi order live dan bukan nasihat keuangan.

## Yang tersedia saat ini

- **Dashboard desk** — ringkasan saldo paper, posisi terbuka, performa, dan aktivitas agen dalam waktu **WIB**.
- **Sembilan strategi aktif** — momentum, mean reversion, Jesse Livermore, SMC, breakout, Wyckoff, supply & demand, Fibonacci, dan candlestick.
- **Scanner dan paper executor** — sinyal serta eksekusi simulasi yang deterministik melalui skrip TypeScript; bukan panggilan LLM otomatis.
- **Detail koin** — chart dan analisis terpadu pada **1H, 4H, dan Daily**. Daily digunakan untuk konteks arah pasar, 4H untuk rencana utama, dan 1H untuk timing.
- **Rencana trading berbasis risiko** — setup hanya dapat aktif bila rasio risiko/imbal hasil minimum **1:1,5**. Jika belum layak, dashboard memberi status menunggu konfirmasi atau belum ada setup.
- **Market Explorer & watchlist** — pencarian pair Indodax, metrik harga/volume, filter pasar, dan watchlist tersimpan di browser.
- **Fundamental dan berita** — data CoinGecko serta berita GDELT dengan cache agar ringan untuk penggunaan pribadi.
- **Gemini Console** — tanya jawab berbasis snapshot desk melalui Gemini API. Pemanggilan Gemini tidak dilakukan otomatis saat halaman detail koin dibuka.

## Arsitektur ringkas

```text
Indodax candles ──> indikator / struktur harga ──> dashboard Next.js
CoinGecko       ──> fundamental                ──> detail koin
GDELT           ──> berita (cache)             ──> detail koin

Scanner TypeScript ──> sinyal ──> paper executor ──> .desk/state.json
Gemini Console     ──> Gemini API (sesuai permintaan pengguna)
```

## Sumber data dan penggunaan API

| Data | Sumber | Perilaku |
|---|---|---|
| Harga dan candle IDR | Indodax | Diambil saat halaman dibuka |
| Fundamental | CoinGecko | Di-cache server |
| Berita | GDELT | Di-cache hingga satu jam |
| Tanya jawab AI | Gemini API | Hanya saat Gemini Console digunakan |

Data eksternal dapat terlambat, tidak lengkap, atau berubah. Berita dan fundamental adalah konteks riset, bukan pemicu transaksi otomatis.

## Menjalankan dashboard lokal

Prasyarat: Node.js 20 atau lebih baru dan npm.

```bash
git clone https://github.com/IrvanRisdi/Gemini-AI-Fund.git
cd Gemini-AI-Fund/dashboard
npm install
npm run dev
```

Buka `http://localhost:3000`.

Untuk Gemini Console, buat `dashboard/.env.local`:

```bash
GEMINI_API_KEY=isi_api_key_anda
# Opsional; urutan fallback dipisahkan koma
GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.1-flash-lite
```

Jangan pernah menyimpan API key di Git atau membagikannya melalui screenshot/log.

## Pemeriksaan sebelum deploy

```bash
cd dashboard
npm run typecheck
npm run build
```

Vercel diatur dengan root directory `dashboard`. Deploy dari root repository agar konfigurasi tersebut diterapkan:

```bash
npx vercel --prod
```

## Navigasi terpadu Coin dan saham IDX

Dashboard Coin memiliki pemilih kelas aset pada navigation bar. Tombol `Coin`
tetap membuka desk ini, sedangkan tombol `Saham` membuka dashboard NusaQuant IDX.
Kedua desk memakai ledger terpisah karena pasar kripto berjalan 24/7 sementara
engine saham mengikuti sesi dan kalender libur IDX. Keduanya sekarang tampil
pada website Next.js yang sama: Coin di `/` dan saham di `/saham`.

Engine saham dijalankan oleh `.github/workflows/stock-trading-loop.yml` setiap
lima menit selama jendela sesi. Hasilnya disimpan sebagai snapshot ringkas di
`stocks-engine/.stock-desk/`, sehingga Vercel hanya membaca hasil dan tidak
menjalankan daemon Python. Tambahkan `ARJUM_API_KEY` pada GitHub Actions Secrets;
jangan menaruh API key pada file repository atau environment browser.

Setelah penutupan IDX, `stock-daily-maintenance.yml` menjalankan breadth scan
seluruh universe, memperbarui Arjum analysis/broker flow serta fundamental, dan
menerbitkan Daily Report. Raw candle dan payload laporan keuangan tidak dipush;
hanya read-model dan state trading yang ringkas yang disimpan.

## Batasan penting

- Tidak ada eksekusi order live dalam alur dashboard ini.
- Analisis teknikal dan trading plan bersifat mekanis; hasil masa lalu tidak menjamin hasil mendatang.
- Strategi dapat berbeda pandangan. Multi-factor dipakai untuk menjelaskan faktor pendukung dan risiko, bukan memaksa semua strategi menghasilkan sinyal yang sama.
- Gunakan ukuran posisi, stop-loss, dan penilaian pribadi Anda sendiri.

## Kredit proyek asli

Repositori ini merupakan modifikasi dari [AI Fund](https://github.com/cubexch/ai-fund), proyek open-source AI trading desk untuk Claude Code. Terima kasih kepada para kontributor AI Fund asli atas struktur awal, materi strategi, dan lisensi MIT yang menjadi dasar pengembangan ini.

Versi ini mengalihkan fokus produk ke dashboard riset/paper-trading pribadi berbasis Indodax dan Gemini. Nama, fungsi, serta klaim fitur pada README ini merujuk pada implementasi dashboard saat ini, bukan seluruh kemampuan proyek AI Fund asli.

## Lisensi

Kode mengikuti lisensi [MIT](LICENSE). Lihat pula atribusi proyek sumber di atas.
