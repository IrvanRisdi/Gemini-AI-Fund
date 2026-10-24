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

      {/* Panduan Pengiriman Otomatis ke WhatsApp / Telegram */}
      <details className="mb-8 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 font-sans text-sm font-semibold text-ink">
          📲 Pengaturan Pengiriman Harian Otomatis ke WhatsApp / Telegram (GitHub Actions)
          <span className="ml-2 font-mono text-[10px] font-normal text-ink-faint">klik untuk panduan</span>
        </summary>
        <div className="border-t border-border p-5 font-sans text-xs leading-relaxed text-ink-muted space-y-3">
          <p>
            Workflow otomatis (<code className="text-ink">market-evaluation.yml</code>) berjalan setiap hari pukul <strong>07:00 WIB</strong> dan <strong>20:30 WIB</strong> menggunakan model <strong>Gemini 2.5 Pro</strong>. Untuk menerima laporan ini otomatis di HP Anda, tambahkan salah satu konfigurasi berikut pada <strong>GitHub Repository → Settings → Secrets and variables → Actions</strong>:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg p-3.5">
              <p className="font-semibold text-emerald-300">Opsi 1: WhatsApp Otomatis (Fonnte / CallMeBot)</p>
              <ul className="mt-1.5 space-y-1">
                <li>• <strong>Fonnte (Rekomendasi WA Indonesia):</strong> Isi secret <code className="text-ink">FONNTE_TOKEN</code> dan <code className="text-ink">WHATSAPP_TARGET</code> (contoh: <code className="text-ink">08123456789</code>).</li>
                <li>• <strong>CallMeBot (WA Pribadi Gratis):</strong> Isi secret <code className="text-ink">CALLMEBOT_API_KEY</code> dan <code className="text-ink">WHATSAPP_TARGET</code> (contoh: <code className="text-ink">628123456789</code>).</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-bg p-3.5">
              <p className="font-semibold text-blue-300">Opsi 2: Telegram Bot (100% Gratis &amp; Paling Stabil)</p>
              <ul className="mt-1.5 space-y-1">
                <li>• Buat bot gratis di <code className="text-ink">@BotFather</code>, lalu isi secret <code className="text-ink">TELEGRAM_BOT_TOKEN</code>.</li>
                <li>• Isi <code className="text-ink">TELEGRAM_CHAT_ID</code> dengan ID akun/grup Telegram Anda.</li>
              </ul>
            </div>
          </div>
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
