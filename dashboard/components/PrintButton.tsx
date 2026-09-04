'use client';

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20">Cetak / Simpan PDF</button>;
}
