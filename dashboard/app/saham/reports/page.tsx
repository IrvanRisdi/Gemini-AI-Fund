import Link from 'next/link';
import { getStockReports } from '@/lib/stock-data';
import { getUnifiedDailyReport } from '@/lib/desk-data';
import { UnifiedDailyReportCard } from '@/components/UnifiedDailyReportCard';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [unifiedReport, reports] = await Promise.all([
    getUnifiedDailyReport(),
    getStockReports(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-xs text-blue-400 hover:underline">
            ← Crypto Spot Desk
          </Link>
          <Link href="/saham" className="font-mono text-xs text-emerald-400 hover:underline">
            ← Saham IDX Desk
          </Link>
        </div>
      </div>

      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-wide text-blue-400">
          Unified Daily Intelligence · Kripto Spot &amp; Saham IDX
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink">
          Laporan Harian Terpadu (Saham &amp; Koin)
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">
          Rangkuman analisis pasar, rekomendasi peluang Kripto Spot &amp; Saham BEI, serta evaluasi portofolio harian yang disusun dengan bahasa yang mudah dimengerti dan siap dikirim ke WhatsApp atau Telegram.
        </p>
      </header>

      {unifiedReport ? <UnifiedDailyReportCard report={unifiedReport} /> : null}

      {/* Panduan Pengiriman Otomatis ke Telegram Bot */}
      <details className="mb-8 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 font-sans text-sm font-semibold text-ink">
          ✈️ Cara Mengaktifkan Pengiriman Harian Otomatis ke Telegram Bot (07:00 &amp; 20:30 WIB)
          <span className="ml-2 font-mono text-[10px] font-normal text-ink-faint">klik untuk panduan 1 menit</span>
        </summary>
        <div className="border-t border-border p-5 font-sans text-xs leading-relaxed text-ink-muted space-y-3">
          <p>
            Workflow otomatis (<code className="text-ink">market-evaluation.yml</code>) berjalan setiap hari pukul <strong>07:00 WIB</strong> dan <strong>20:30 WIB</strong> menggunakan prioritas model <strong>Gemini 4.0 Argon → Gemini 3.1 Pro → Gemini 3.8 Flash</strong>. Untuk menerima laporan ini otomatis di Telegram Anda:
          </p>
          <ol className="space-y-1.5 list-decimal list-inside text-ink">
            <li>
              Buka Telegram, cari <code className="text-blue-300">@BotFather</code>, ketik <code className="text-blue-300">/newbot</code>, lalu salin <strong>HTTP API Token</strong> yang diberikan. Kunjungi bot baru Anda dan klik <strong>Start</strong>.
            </li>
            <li>
              Cari <code className="text-blue-300">@userinfobot</code> di Telegram dan klik <strong>Start</strong> untuk melihat angka <strong>Id</strong> akun Telegram Anda.
            </li>
            <li>
              Buka <strong>GitHub Repository → Settings → Secrets and variables → Actions</strong>, lalu tambahkan 2 <em>Repository Secrets</em>:
              <span className="mt-1 block font-mono text-[11px] text-emerald-300">
                TELEGRAM_BOT_TOKEN = (token dari @BotFather) · TELEGRAM_CHAT_ID = (angka ID dari @userinfobot)
              </span>
            </li>
          </ol>
        </div>
      </details>

      {/* Arsip Laporan Harian Saham IDX */}
      <section className="space-y-3">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">Stored Evaluation · BEI / IDX</p>
          <h2 className="text-lg font-semibold text-ink">Arsip Rincian Harian Saham IDX</h2>
        </div>
        {reports.map((report) => {
          const snapshot = report.snapshot;
          const regime = snapshot?.market_regime as Record<string, unknown> | undefined;
          const universe = snapshot?.universe as Record<string, unknown> | undefined;
          return (
            <Link
              key={String(report['report_date'])}
              href={`/saham/reports/${String(report['report_date'])}`}
              className="grid gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-emerald-500/50 md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-semibold text-ink">{String(report['report_date'])}</p>
                <p className="mt-1 font-mono text-xs text-ink-faint">
                  Dibuat {String(report['generated_at'])} · {String(report['source_mode'])}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-ink-faint">Market regime</p>
                <p className="text-sm">
                  {String(regime?.label ?? '—')} · {String(regime?.confidence ?? '—')}%
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-ink-faint">Coverage</p>
                <p className="text-sm">
                  {String(universe?.symbols_ok ?? '—')} / {String(universe?.eligible_count ?? '—')}
                </p>
              </div>
            </Link>
          );
        })}
        {!reports.length ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-ink-faint">
            Belum ada laporan tersimpan.
          </p>
        ) : null}
      </section>
    </main>
  );
}
