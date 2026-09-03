# Data sources and import policy

## Source of truth

| Dataset | Source | Refresh | Dashboard behavior |
|---|---|---:|---|
| IDX equity universe | [IDX Stock List](https://www.idx.id/en/market-data/stocks-data/stock-list) download | Daily before pre-open | Dashboard reads the normalized local CSV only. |
| Trading calendar | [KSEI 2026 calendar](https://web.ksei.co.id/files/1767843003_Penyesuaian_Pengumuman_Hari_Libur_dan_Cuti_Bersama_PT_KSEI_Ta....pdf), which cites IDX announcement PENG-00171/BEI.POP/09-2025 | At year start and on IDX amendment | Engine skips collection and evaluation on these dates. |
| Trading session, tick, lot, auto rejection | [IDX trading mechanism](https://www.idx.id/id/produk-layanan/jam-dan-mekanisme-perdagangan/) | On regulation change | Engine applies session and tick rules locally. |
| Daily / intraday OHLCV | Yahoo `.JK` prototype or licensed provider | 5m shortlist / post-close full universe | Cached and labelled `DELAYED`; never fetched by a page request. |
| Financial statement metrics | IDX financial disclosures / licensed normalized source | Quarterly | Snapshot only; missing values remain `DATA_NOT_AVAILABLE`. |
| Broker and foreign flow | Arjum or licensed provider | Per collector policy | Cached enrichment only; never inferred from price candles. |

## Official IDX universe importer

Download the official Stock List as CSV or XLSX, then run:

```powershell
python jobs.py import-idx-universe path\to\idx-stock-list.xlsx
```

The importer maps Indonesian/English column variants, retains active four-letter equity tickers, and excludes records marked ETF, DIRE/REIT, warrant, right/HMETD, bond, sukuk, inactive, or delisted. It writes:

- `data/idx_universe.csv` — canonical engine input.
- `data/idx_universe_import_audit.json` — source filename and excluded records.

Production imports require at least `NQ_MIN_UNIVERSE_SIZE` eligible records (700 by default). `--allow-small` exists only for development fixtures.

## Required universe fields

`symbol,name,sector,subsector,status,instrument_type,board,listing_date,special_notation,source_as_of`

The current engine consumes the first five fields. The others are retained for eligibility, corporate-action, liquidity, and risk-policy work that follows.

## Calendar governance

`data/idx_holidays.json` contains the 2026 calendar and is marked `VALIDATED`. It must be reviewed whenever IDX, KSEI, or Bank Indonesia changes a market-closure announcement; do not derive it solely from national holidays.
