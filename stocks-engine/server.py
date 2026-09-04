"""NusaQuant local API and static server (stdlib only)."""
from __future__ import annotations

import json
import mimetypes
import sqlite3
import base64
import hmac
import re
from datetime import datetime, time as clock_time, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from config import settings
from engine_schema import init_engine_schema

ROOT = Path(__file__).resolve().parent
DB_PATH = settings.database_path
HOST = settings.host
PORT = settings.port
JAKARTA = ZoneInfo("Asia/Jakarta")

AGENTS = [
    ("swing", "Swing Momentum", "Daily trend · 2–20 hari", 100_000_000, 104_820_000, 61.0, 3.4, "ACTIVE", "validated"),
    ("scalping", "Scalping Desk", "Momentum 5m · delayed-paper", 100_000_000, 98_740_000, 54.0, 0.8, "ACTIVE", "paper-validation"),
    ("open-low", "Open = Low", "Opening strength 5m · delayed-paper", 100_000_000, 102_160_000, 58.0, 1.2, "ACTIVE", "paper-validation"),
    ("fundamental", "Fundamental Alpha", "Quality value · 1–6 bulan", 100_000_000, 104_700_000, 67.0, 2.1, "ACTIVE", "validated"),
    ("breakout-retest", "Breakout & Retest", "Structure · 1–10 hari", 100_000_000, 102_420_000, 63.0, 3.0, "ACTIVE", "validated"),
]

STOCKS = [
    ("BRIS", "Bank Syariah Indonesia", "Financials", "Banks", 2810, 2.48, 86, "ACTIONABLE", "2026-08-26T16:15:00+07:00"),
    ("PGEO", "Pertamina Geothermal Energy", "Infrastructure", "Alternative Energy", 1485, 3.12, 83, "ACTIONABLE", "2026-08-26T16:15:00+07:00"),
    ("ANTM", "Aneka Tambang", "Basic Materials", "Metals & Mining", 1965, 1.55, 79, "WATCH", "2026-08-26T16:15:00+07:00"),
    ("ERAA", "Erajaya Swasembada", "Consumer Cyclicals", "Retail", 468, 4.00, 77, "ACTIONABLE", "2026-08-26T16:15:00+07:00"),
    ("BMRI", "Bank Mandiri", "Financials", "Banks", 5975, 0.84, 74, "WATCH", "2026-08-26T16:15:00+07:00"),
    ("TINS", "Timah", "Basic Materials", "Metals & Mining", 1120, 2.75, 72, "WATCH", "2026-08-26T16:15:00+07:00"),
    ("BBCA", "Bank Central Asia", "Financials", "Banks", 9025, 0.28, 76, "HOLD", "2026-08-26T16:15:00+07:00"),
]

DECISIONS = [
    ("breakout-retest", "BRIS", "BUY", 86, "Breakout 15m terkonfirmasi, retest bertahan, dan broker flow akumulatif.", 2780, 2810, 2690, 3050, 3.0, 2.7, "ACTIONABLE"),
    ("swing", "PGEO", "BUY", 83, "Trend harian di atas EMA20/50 dengan relative volume kuat.", 1460, 1490, 1380, 1610, 3.0, 2.1, "ACTIONABLE"),
    ("open-low", "ERAA", "BUY", 77, "Open bertahan sebagai low dan harga menjaga VWAP.", 456, 468, 446, 486, 2.0, 1.8, "FILLED"),
    ("fundamental", "BBCA", "HOLD", 77, "Quality dan profitabilitas kuat; valuation belum memberi margin of safety baru.", 8700, 9000, 8450, 9600, 2.0, 2.0, "HOLD"),
    ("scalping", "TINS", "WAIT", 58, "Spread dan slippage estimate membuat expectancy setelah biaya belum positif.", None, None, None, None, 0.0, 0.0, "WAIT"),
]

POSITIONS = [
    ("breakout-retest", "BRIS", 320, 2800, 2810, 2690, 3050, "OPEN"),
    ("swing", "PGEO", 420, 1405, 1485, 1455, 1610, "OPEN"),
    ("fundamental", "BBCA", 120, 8725, 9025, 8450, 9600, "OPEN"),
    ("open-low", "ERAA", 325, 452, 468, 452, 486, "OPEN"),
    ("breakout-retest", "ANTM", 300, 1900, 1965, 1870, 2100, "OPEN"),
]

STRATEGIES = {
    "swing": {"objective":"Menangkap tren menengah pada saham likuid dengan momentum dan konfirmasi volume.","timeframes":"Daily untuk setup · Weekly untuk regime","entry_rules":["Close di atas EMA20 dan EMA50","Relative volume minimum 1,5×","Entry pada pullback sehat atau breakout terkonfirmasi"],"exit_rules":["Stop di bawah swing low atau ATR struktural","Partial profit pada 1,5R–2R","Time stop maksimal 20 hari bursa"],"no_trade":["Data stale atau corporate action belum disesuaikan","Likuiditas di bawah batas","IHSG risk-off ekstrem"]},
    "scalping": {"objective":"Menangkap momentum intraday 5 menit yang masih memiliki edge bersih setelah biaya.","timeframes":"5m untuk setup dan eksekusi delayed-paper","entry_rules":["Likuiditas dan relative volume lolos","Momentum tidak terlalu jauh dari VWAP","Harga menutup di atas VWAP"],"exit_rules":["Stop ATR dengan jarak minimum biaya","Target minimal 1,5R bersih setelah fee","Tidak melakukan averaging down"],"no_trade":["Candle stale atau di luar jam kontinu IDX","Expected edge setelah biaya tidak memadai","Lonjakan harga sudah terlalu jauh dari VWAP"]},
    "open-low": {"objective":"Memilih saham dengan kekuatan pembukaan ketika open bertahan sebagai low hari berjalan.","timeframes":"5m · hanya 60 menit perdagangan aktif pertama","entry_rules":["Low sesi tidak lebih dari satu tick di bawah open sesi","Relative volume dan penutupan di atas VWAP","Konfirmasi hanya pada candle 5 menit valid"],"exit_rules":["Stop satu tick di bawah open sesi","Target minimal 1,5R bersih setelah fee","Tidak melakukan averaging down"],"no_trade":["Di luar 60 menit aktif pertama","Open=low karena belum aktif diperdagangkan","Candle stale atau di luar jam kontinu IDX"]},
    "fundamental": {"objective":"Mengakumulasi emiten berkualitas pada valuasi wajar dengan horizon beberapa bulan.","timeframes":"Quarterly fundamental · Weekly/Daily timing","entry_rules":["Quality dan financial-health gate lolos","Valuation memiliki margin of safety","Tidak ada red flag arus kas material"],"exit_rules":["Thesis fundamental rusak","Valuasi melewati fair range","Trailing protection untuk event risk"],"no_trade":["Laporan keuangan tidak lengkap","Restatement belum diproses","Model sektor tidak sesuai"]},
    "breakout-retest": {"objective":"Membeli breakout valid setelah resistance diuji kembali dan bertahan sebagai support.","timeframes":"Daily/1H setup · 15m confirmation","entry_rules":["Close melewati resistance dengan volume","Retest gap maksimum 5%","Bullish rejection dan flow tidak hard-conflict"],"exit_rules":["Stop di bawah retest low","Target minimum 1,5R","Plan kedaluwarsa bila target lama sudah terlewati"],"no_trade":["Deep retest/hard reject","Personality trap historis","Breakout tanpa volume"]},
}

AGENT_HORIZONS = {
    "swing": "5–15 hari", "scalping": "Intraday", "open-low": "Hari ini",
    "fundamental": "3–6 bulan", "breakout-retest": "2–10 hari",
}

BRIS_SNAPSHOT = {
    "snapshot_version": "stock-v1.0-demo",
    "trade_status": "OPEN",
    "liquidity": {"grade": "GOOD", "average_daily_value": 128_400_000_000, "average_daily_volume": 46_200_000},
    "scores": {"engine": 86, "arjum": 81, "technical": "BULLISH", "broker_flow": "ACCUMULATION", "fundamental": "NEUTRAL_POSITIVE", "liquidity": "GOOD", "data_confidence": 94, "final_status": "ACTIONABLE"},
    "technical": {"status": "AVAILABLE", "trend": {"15m": "Bullish", "1h": "Bullish", "daily": "Bullish", "weekly": "Neutral-bullish"}, "rsi": 64.2, "macd": "Bullish crossover", "adx": 27.8, "atr": 78, "bollinger": "Upper-half, expanding", "relative_volume": 2.4, "relative_strength_ihsg": 1.9, "relative_strength_sector": 1.2, "swing_high": 2830, "swing_low": 2640, "support": [2780,2690], "resistance": [2830,3050], "gap": "None", "candlestick": "Bullish rejection on retest"},
    "flow": {"status": "AVAILABLE", "verdict": "Consistent accumulation", "period": "5D", "net_buy": 18_600_000_000, "foreign_net": 6_200_000_000, "consistency": "4 of 5 sessions", "silent_accumulation": True, "price_flow_conflict": False, "heavy_buyers": ["YP · Rp8,4B","AK · Rp6,1B","CC · Rp3,2B"], "heavy_sellers": ["ZP · Rp4,7B","BK · Rp3,9B"]},
    "arjum": {"status": "CACHED", "as_of": "2026-08-26T16:20:00+07:00", "verdict": "Bullish continuation", "signal_score": 81, "pivot_support": [2780,2690], "pivot_resistance": [2830,3050], "broker_summary": "Accumulation", "accumulation": "Moderate-strong", "seasonality": "Positive 6/10 periods", "personality": "Momentum after shallow retest", "historical_traps": ["Failed breakout when RVOL < 1.3×"], "engine_difference": "Engine +5 points: stronger intraday retest confirmation"},
    "fundamental": {"status": "DATA_NOT_AVAILABLE", "as_of": None},
    "report_history": [
        {"at":"2026-08-26T16:22:00+07:00","score":86,"verdict":"ACTIONABLE","change":"Retest confirmed; plan actionable","report_date":"2026-08-26"},
        {"at":"2026-08-25T16:30:00+07:00","score":78,"verdict":"WATCH","change":"Breakout detected; waiting for retest","report_date":"2026-08-25"},
        {"at":"2026-08-24T16:30:00+07:00","score":69,"verdict":"WATCH","change":"Approaching resistance 2.780","report_date":"2026-08-24"},
    ],
    "decision_history": [
        {"at":"2026-08-26T14:16:00+07:00","agent_id":"breakout-retest","event":"Membuka posisi 320 lot","kind":"FILLED"},
        {"at":"2026-08-26T13:40:00+07:00","agent_id":"swing","event":"Menaikkan confidence menjadi 82","kind":"UPDATED"},
        {"at":"2026-08-26T10:12:00+07:00","agent_id":"scalping","event":"Menolak entry: spread gate","kind":"REJECTED"},
        {"at":"2026-08-25T16:30:00+07:00","agent_id":"fundamental","event":"Memasukkan ke watchlist","kind":"WATCHLIST"},
    ],
}


def build_chart(last_price: float) -> dict:
    """Deterministic demo candles; production collectors replace this cached block."""
    offsets = [-150,-135,-120,-128,-105,-92,-80,-88,-64,-45,-52,-25,-12,-20,8,20,14,42,60,52,78,94,87,110,98,125,142,130,150,160]
    candles = []
    for i, offset in enumerate(offsets):
        close = last_price + offset - offsets[-1]
        open_price = close - (8 if i % 3 else -6)
        candles.append({"t": f"2026-08-{i+1:02d}", "o": open_price, "h": max(open_price, close)+18, "l": min(open_price, close)-17, "c": close, "v": 18_000_000 + (i % 7)*4_200_000})
    return {"status":"DEMO_CACHED","default_timeframe":"Daily","available_timeframes":["Daily"],"candles":candles,"overlays":{"ema20":round(last_price*.965),"sma50":round(last_price*.925),"vwap":None,"support":[round(last_price*.96)],"resistance":[round(last_price*1.007),round(last_price*1.085)]}}


def clean_arjum_line(value: str) -> str:
    """Remove Markdown decoration and pictograms from an Arjum prose line."""
    value = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]", "", value)
    value = value.replace("***", "").replace("**", "").replace("_", "")
    value = re.sub(r"^[\s•*#>-]+", "", value)
    value = value.replace("↑", " Naik").replace("↓", " Turun").replace("→", " Netral")
    return re.sub(r"\s+", " ", value).strip()


def parse_arjum_analysis(value: str) -> list[dict]:
    """Turn the provider's decorated Markdown report into readable sections."""
    sections: list[dict] = []
    current = {"title": "Ringkasan", "lines": []}
    for raw in value.splitlines():
        cleaned = clean_arjum_line(raw)
        if not cleaned:
            continue
        stripped = raw.strip()
        is_heading = stripped.startswith("**") and stripped.endswith("**") and ":" not in cleaned and len(cleaned) <= 48
        if is_heading:
            if current["lines"]:
                sections.append(current)
            current = {"title": cleaned.title(), "lines": []}
        else:
            current["lines"].append(cleaned)
    if current["lines"]:
        sections.append(current)
    return sections


def cached_arjum_snapshot(db: sqlite3.Connection, symbol: str) -> dict:
    """Present stored Arjum data only; stock-page reads must not call providers."""
    row = db.execute("SELECT * FROM arjum_snapshots WHERE symbol=?", (symbol,)).fetchone()
    if not row:
        return {"status": "DATA_NOT_AVAILABLE"}
    try:
        payload = json.loads(row["payload_json"])
    except (TypeError, json.JSONDecodeError):
        payload = {}
    analysis = payload.get("analysis") if isinstance(payload.get("analysis"), dict) else {}
    analysis_text = str(analysis.get("output") or "")
    analysis_sections = parse_arjum_analysis(analysis_text)
    score_match = re.search(r"Score:\s*\*\*(\d+)/(\d+)", analysis_text)
    signal_score = round(int(score_match.group(1)) / int(score_match.group(2)) * 100) if score_match and int(score_match.group(2)) else None
    verdict_match = re.search(r"Score:.*?\*\*([A-Z][A-Z ]+)\*\*", analysis_text)
    pivot_match = re.search(r"Daily:\s*R2 Rp([\d.]+)\s*\|\s*R1 Rp([\d.]+)\s*\|\s*P Rp([\d.]+)\s*\|\s*S1 Rp([\d.]+)\s*\|\s*S2 Rp([\d.]+)", analysis_text)
    number = lambda value: float(value.replace(".", "")) if value else None
    broker = payload.get("broker_summary")
    accumulation = payload.get("broker_accumulation")
    seasonal = payload.get("seasonal")
    return {
        "status": row["status"], "as_of": row["fetched_at"], "expires_at": row["expires_at"],
        "request_count": row["request_count"], "verdict": verdict_match.group(1).strip() if verdict_match else "DATA_NOT_AVAILABLE",
        "signal_score": signal_score,
        "pivot_support": [number(pivot_match.group(4)), number(pivot_match.group(5))] if pivot_match else [],
        "pivot_resistance": [number(pivot_match.group(2)), number(pivot_match.group(1))] if pivot_match else [],
        "broker_summary": broker if broker is not None else "DATA_NOT_AVAILABLE",
        "accumulation": accumulation if accumulation is not None else "DATA_NOT_AVAILABLE",
        "seasonality": seasonal if seasonal is not None else "DATA_NOT_AVAILABLE",
        "analysis_text": analysis_text, "analysis_sections": analysis_sections, "payload": payload, "error": row["error"],
    }


def aggregate_candles(rows: list[dict], mode: str) -> list[dict]:
    buckets: dict[str, list[dict]] = {}
    for row in rows:
        moment = datetime.fromisoformat(row["t"])
        if mode == "15m": key = moment.replace(minute=(moment.minute // 15) * 15, second=0, microsecond=0).isoformat()
        elif mode == "1H": key = moment.replace(minute=0, second=0, microsecond=0).isoformat()
        elif mode == "Weekly": key = (moment.date() - timedelta(days=moment.weekday())).isoformat()
        else: key = row["t"]
        buckets.setdefault(key, []).append(row)
    result = []
    for key, group in buckets.items():
        result.append({"t":key,"o":group[0]["o"],"h":max(x["h"] for x in group),"l":min(x["l"] for x in group),"c":group[-1]["c"],"v":sum(x["v"] for x in group)})
    return result[-120:]


def chart_overlays(rows: list[dict], intraday: bool) -> dict:
    if not rows: return {}
    closes = [float(x["c"]) for x in rows]
    ema20 = closes[0]
    for close in closes[1:]: ema20 = close * (2 / 21) + ema20 * (19 / 21)
    recent = rows[-20:]
    volume = sum(float(x["v"]) for x in recent)
    vwap = sum(((x["h"]+x["l"]+x["c"])/3)*x["v"] for x in recent)/volume if intraday and volume else None
    return {"ema20":round(ema20,2),"vwap":round(vwap,2) if vwap else None,"support":[min(x["l"] for x in recent)],"resistance":[max(x["h"] for x in recent)]}


def cached_chart(db: sqlite3.Connection, symbol: str) -> dict:
    def rows(timeframe: str, limit: int):
        values = dict_rows(db.execute("SELECT candle_at t,open o,high h,low l,close c,volume v FROM market_candles WHERE symbol=? AND timeframe=? ORDER BY candle_at DESC LIMIT ?", (symbol,timeframe,limit)))
        values.reverse(); return values
    minute = rows("1m", 120); five = rows("5m", 1200); daily = rows("1d", 520)
    series = {}
    if minute: series["1m"] = minute[-120:]
    if five:
        series["5m"] = five[-120:]; series["15m"] = aggregate_candles(five,"15m"); series["1H"] = aggregate_candles(five,"1H")
    if daily:
        series["Daily"] = daily[-120:]; series["Weekly"] = aggregate_candles(daily,"Weekly")
    order = ["1m","5m","15m","1H","Daily","Weekly"]
    available = [name for name in order if series.get(name)]
    default = "5m" if "5m" in available else ("Daily" if "Daily" in available else available[0] if available else None)
    return {"status":"DELAYED_CACHED" if available else "DATA_NOT_AVAILABLE","default_timeframe":default,"available_timeframes":available,
      "series":series,"overlays":{name:chart_overlays(values,name in {"1m","5m","15m","1H"}) for name,values in series.items()}}


def liquidity_snapshot(db: sqlite3.Connection, symbol: str) -> dict:
    rows = dict_rows(db.execute("SELECT close,volume FROM market_candles WHERE symbol=? AND timeframe='1d' ORDER BY candle_at DESC LIMIT 20",(symbol,)))
    if not rows: return {"grade":"DATA_NOT_AVAILABLE","average_daily_value":None,"average_daily_volume":None}
    adv = sum(x["close"]*x["volume"] for x in rows)/len(rows); avol = sum(x["volume"] for x in rows)/len(rows)
    grade = "EXCELLENT" if adv >= 10_000_000_000 else "GOOD" if adv >= 1_000_000_000 else "THIN" if adv >= 250_000_000 else "ILLIQUID"
    return {"grade":grade,"average_daily_value":round(adv),"average_daily_volume":round(avol)}


def flow_snapshot(arjum: dict, last_price: float) -> dict:
    payload = arjum.get("payload") or {}; broker = payload.get("broker_summary") or {}; history = (payload.get("history") or {}).get("rows") or []
    brokers = broker.get("brokers") or []
    buyers = sorted((x for x in brokers if (x.get("nval") or 0)>0),key=lambda x:x.get("nval",0),reverse=True)
    sellers = sorted((x for x in brokers if (x.get("nval") or 0)<0),key=lambda x:x.get("nval",0))
    recent = history[:20] if history and str(history[0].get("date", "")) > str(history[-1].get("date", "")) else history[-20:]
    foreign_volume = sum(float(x.get("n_foreign") or 0) for x in recent)
    positive_days = sum(1 for x in recent if (x.get("n_foreign") or 0)>0)
    pressure = sum(x.get("nval",0) for x in buyers[:5]) + sum(x.get("nval",0) for x in sellers[:5])
    if not brokers and not history: return {"status":"DATA_NOT_AVAILABLE"}
    return {"status":"AVAILABLE","verdict":"ACCUMULATION" if pressure>0 else "DISTRIBUTION","period":f"{len(recent)} sessions",
      "net_buy":pressure,"foreign_net":foreign_volume*last_price,"consistency":f"{positive_days}/{len(recent)} foreign-positive" if recent else "—",
      "silent_accumulation":pressure>0 and abs(sum(float(x.get("change_pct") or 0) for x in recent))<5,
      "heavy_buyers":[f"{x.get('broker_code')} · {idr_number(x.get('nval'))}" for x in buyers[:5]],
      "heavy_sellers":[f"{x.get('broker_code')} · {idr_number(x.get('nval'))}" for x in sellers[:5]],"price_flow_conflict":pressure>0 and bool(recent) and (recent[-1].get("change_pct") or 0)<0}


def idr_number(value) -> str:
    return f"Rp {float(value or 0):,.0f}".replace(",", ".")


def fundamental_snapshot(db: sqlite3.Connection, symbol: str, last_price: float = 0, sector: str = "") -> dict:
    rows = db.execute("""SELECT * FROM financial_statements WHERE symbol=? AND data_status='CACHED'
      ORDER BY period_end DESC,report_type""",(symbol,)).fetchall()
    if not rows:
        legacy = db.execute("SELECT * FROM fundamental_snapshots WHERE symbol=? ORDER BY period_end DESC LIMIT 1",(symbol,)).fetchone()
        if not legacy: return {"status":"DATA_NOT_AVAILABLE","as_of":None,"indicators":[]}
        metrics=json.loads(legacy["metrics_json"])
        return {"status":"AVAILABLE","as_of":legacy["published_at"],"period_end":legacy["period_end"],"source":legacy["source"],"coverage":[metrics.get("report_type")],"indicators":[],**metrics}

    decoded=[{**dict(row),"metrics":json.loads(row["metrics_json"])} for row in rows]
    latest_period=max(row["period_end"] for row in decoded)
    by_type={}
    for row in decoded: by_type.setdefault(row["report_type"],row)
    def recursive_number(value,name):
        if not isinstance(value,dict): return None
        if name in value and isinstance(value[name],(int,float)): return float(value[name])
        for child in value.values():
            found=recursive_number(child,name)
            if found is not None: return found
        return None
    def pick(name):
        for row in decoded:
            value=row["metrics"].get(name)
            if value is None and name=="dividend_paid":
                value=recursive_number(row["metrics"].get("raw"),"pembayaran_dividen_dari_aktivitas_pendanaan")
            if value is not None: return float(value),row["period_end"],row["period_end"]!=latest_period
        return None,None,False
    values={name:pick(name) for name in ("revenue","operating_income","net_income","eps","total_assets","total_liabilities","total_equity","operating_cash_flow","dividend_paid")}
    def val(name): return values[name][0]
    try: quarter=max(1,min(4,int(latest_period.split("Q")[-1])))
    except (ValueError,IndexError): quarter=4
    annualizer=4/quarter
    annual_net=val("net_income")*annualizer if val("net_income") is not None else None
    annual_eps=val("eps")*annualizer if val("eps") is not None else None
    equity,assets,liabilities=val("total_equity"),val("total_assets"),val("total_liabilities")
    roe=annual_net/equity*100 if annual_net is not None and equity else None
    roa=annual_net/assets*100 if annual_net is not None and assets else None
    debt_to_equity=liabilities/equity if liabilities is not None and equity else None
    per=last_price/annual_eps if last_price and annual_eps and annual_eps>0 else None
    implied_shares=(val("net_income")/val("eps")) if val("net_income") is not None and val("eps") and val("eps")>0 else None
    book_value_per_share=equity/implied_shares if equity and implied_shares else None
    pbv=last_price/book_value_per_share if last_price and book_value_per_share else None
    dividend_paid=abs(val("dividend_paid")) if val("dividend_paid") is not None else None
    dividend_per_share=dividend_paid/implied_shares if dividend_paid is not None and implied_shares else None
    dividend_yield=dividend_per_share/last_price*100 if dividend_per_share is not None and last_price else None
    margin=annual_net/(val("revenue")*annualizer)*100 if annual_net is not None and val("revenue") else None

    income={row["period_end"]:row["metrics"] for row in decoded if row["report_type"]=="INCOME_STATEMENT"}
    try: prior_period=f"{int(latest_period[:4])-1}-{latest_period.split('-')[-1]}"
    except (ValueError,IndexError): prior_period=""
    def growth(name):
        latest=(income.get(latest_period) or {}).get(name); prior=(income.get(prior_period) or {}).get(name)
        return (float(latest)-float(prior))/abs(float(prior))*100 if latest is not None and prior not in (None,0) else None
    revenue_growth,profit_growth=growth("revenue"),growth("net_income")

    def grade(key,value):
        if value is None: return "UNAVAILABLE"
        if key=="roe": return "GOOD" if value>=15 else "BAD" if value<8 else "NEUTRAL"
        if key=="roa": return "GOOD" if value>=5 else "BAD" if value<2 else "NEUTRAL"
        if key=="debt_to_equity":
            if "financ" in (sector or "").lower() or "bank" in (sector or "").lower(): return "NEUTRAL"
            return "GOOD" if value<=1 else "BAD" if value>2 else "NEUTRAL"
        if key=="per": return "GOOD" if 5<=value<=25 else "BAD" if value<=0 or value>40 else "NEUTRAL"
        if key=="pbv": return "GOOD" if 0<value<=3 else "BAD" if value<=0 or value>6 else "NEUTRAL"
        if key in {"revenue_growth","profit_growth"}: return "GOOD" if value>=5 else "BAD" if value<0 else "NEUTRAL"
        if key=="operating_cash_flow": return "GOOD" if value>0 else "BAD" if value<0 else "NEUTRAL"
        if key=="dividend_yield": return "GOOD" if value>=2 else "BAD" if value==0 else "NEUTRAL"
        return "NEUTRAL"
    cards=[]
    def card(key,label,value,unit="",period=None,fallback=False):
        cards.append({"key":key,"label":label,"value":round(value,2) if isinstance(value,float) else value,"unit":unit,"status":grade(key,value),"period_end":period or latest_period,"fallback":bool(fallback)})
    card("revenue_growth","Revenue growth YoY",revenue_growth,"%")
    card("profit_growth","Profit growth YoY",profit_growth,"%")
    card("roe","ROE annualized",roe,"%",values["net_income"][1],values["net_income"][2] or values["total_equity"][2])
    card("roa","ROA annualized",roa,"%",values["net_income"][1],values["net_income"][2] or values["total_assets"][2])
    card("debt_to_equity","Debt / equity",debt_to_equity,"×",values["total_equity"][1],values["total_equity"][2])
    card("per","PER annualized",per,"×",values["eps"][1],values["eps"][2])
    card("pbv","PBV",pbv,"×",values["total_equity"][1],values["total_equity"][2])
    card("operating_cash_flow","Operating cash flow",val("operating_cash_flow"),"IDR",values["operating_cash_flow"][1],values["operating_cash_flow"][2])
    card("dividend_yield","Dividend yield",dividend_yield,"%",values["dividend_paid"][1],values["dividend_paid"][2])
    available=[item for item in cards if item["status"]!="UNAVAILABLE"]
    quality=round(sum({"GOOD":100,"NEUTRAL":60,"BAD":20}[item["status"]] for item in available)/len(available)) if available else None
    return {"status":"AVAILABLE","as_of":max(row["fetched_at"] for row in decoded),"period_end":latest_period,
      "source":"arjum_financial_statement_cache","coverage":sorted(by_type),"quality_score":quality,"indicators":cards,
      "revenue":val("revenue"),"operating_income":val("operating_income"),"net_income":val("net_income"),"eps":val("eps"),
      "margin":round(margin,2) if margin is not None else None,"roe":round(roe,2) if roe is not None else None,"roa":round(roa,2) if roa is not None else None,
      "debt_to_equity":round(debt_to_equity,2) if debt_to_equity is not None else None,"operating_cash_flow":val("operating_cash_flow"),
      "per":round(per,2) if per is not None else None,"pbv":round(pbv,2) if pbv is not None else None,"dividend":dividend_paid,
      "dividend_yield":round(dividend_yield,2) if dividend_yield is not None else None,
      "calculation_note":"ROE/ROA/PER use annualized YTD; PBV uses shares implied by reported parent profit/EPS. Missing values are never invented."}


def technical_snapshot(chart: dict, features: dict | None) -> dict:
    if not chart.get("available_timeframes"): return {"status":"DATA_NOT_AVAILABLE"}
    preferred = "Daily" if "Daily" in chart["series"] else chart["default_timeframe"]
    rows = chart["series"][preferred]; closes = [float(x["c"]) for x in rows]
    recent = rows[-20:]; avg = sum(x["c"] for x in recent)/len(recent)
    variance = sum((x["c"]-avg)**2 for x in recent)/len(recent); sd = variance**.5
    latest, previous = rows[-1], rows[-2] if len(rows)>1 else rows[-1]
    candle_range = max(float(latest["h"])-float(latest["l"]),1e-9); body=abs(float(latest["c"])-float(latest["o"]))
    lower_wick=min(latest["o"],latest["c"])-latest["l"]
    pattern = "Doji" if body/candle_range<.1 else "Hammer" if lower_wick>body*2 else "Bullish candle" if latest["c"]>latest["o"] else "Bearish candle"
    dx_values=[]
    if len(rows)>=28:
        for end in range(14,len(rows)):
            window=rows[end-13:end+1]; tr=plus=minus=0.0
            for prior,current in zip(window,window[1:]):
                tr += max(current["h"]-current["l"],abs(current["h"]-prior["c"]),abs(current["l"]-prior["c"]))
                up=current["h"]-prior["h"]; down=prior["l"]-current["l"]
                plus += up if up>down and up>0 else 0; minus += down if down>up and down>0 else 0
            if tr:
                pdi,mdi=100*plus/tr,100*minus/tr
                if pdi+mdi: dx_values.append(100*abs(pdi-mdi)/(pdi+mdi))
    adx=round(sum(dx_values[-14:])/len(dx_values[-14:]),2) if dx_values else None
    trends={name:("Bullish" if values[-1]["c"]>(chart["overlays"].get(name) or {}).get("ema20",values[-1]["c"]) else "Bearish/neutral") for name,values in chart["series"].items()}
    return {"status":"AVAILABLE","trend":trends,"rsi":round((features or {}).get("rsi14") or 0,2),"macd":round((features or {}).get("macd") or 0,2),
      "adx":adx,"atr":round((features or {}).get("atr14") or 0,2),"bollinger":f"{round(avg-2*sd,2)} – {round(avg+2*sd,2)}",
      "relative_volume":round((features or {}).get("relative_volume") or 0,2),"relative_strength_ihsg":None,"relative_strength_sector":None,
      "swing_high":max(x["h"] for x in recent),"swing_low":min(x["l"] for x in recent),
      "support":chart["overlays"].get(preferred,{}).get("support",[]),"resistance":chart["overlays"].get(preferred,{}).get("resistance",[]),
      "gap":round((latest["o"]-previous["c"])/previous["c"]*100,2) if previous["c"] else None,"candlestick":pattern}


def stock_workspace(db: sqlite3.Connection, instrument: sqlite3.Row) -> dict:
    symbol, last_price = instrument["symbol"], float(instrument["last_price"] or 0)
    rich = BRIS_SNAPSHOT if symbol == "BRIS" and settings.demo_mode else {}
    agents = dict_rows(db.execute("SELECT id,name,equity FROM agents ORDER BY id"))
    decisions = {}
    for row in db.execute("SELECT * FROM decisions WHERE symbol=? ORDER BY id DESC", (symbol,)).fetchall():
        decisions.setdefault(row["agent_id"], dict(row))
    positions = dict_rows(db.execute("SELECT p.*,a.name agent_name,ROUND((p.last_price-p.entry_price)*p.lots*100,0) unrealized_pnl,ROUND((p.last_price-p.entry_price)/p.entry_price*100,2) pnl_pct FROM positions p JOIN agents a ON a.id=p.agent_id WHERE p.symbol=? AND p.status='OPEN'", (symbol,)))
    feature_row = db.execute("SELECT features_json FROM feature_snapshots WHERE symbol=? ORDER BY rowid DESC LIMIT 1", (symbol,)).fetchone()
    features = json.loads(feature_row[0]) if feature_row else None
    dynamic_chart = cached_chart(db, symbol)
    dynamic_technical = technical_snapshot(dynamic_chart, features)
    views = []
    demo_views = {
        "swing": ("BUY",82,"WAITING"), "scalping": ("WAIT",61,"WAITING"),
        "open-low": ("NOT_APPLICABLE",None,"INVALID"), "fundamental": ("ACCUMULATE",77,"DRAFT"),
        "breakout-retest": ("BUY",86,"FILLED"),
    } if symbol == "BRIS" and settings.demo_mode else {}
    for agent in agents:
        decision = decisions.get(agent["id"], {})
        action, confidence, plan_status = demo_views.get(agent["id"], (decision.get("action", "NOT_EVALUATED"), decision.get("confidence"), decision.get("status", "DRAFT")))
        entry_low, entry_high = decision.get("entry_low"), decision.get("entry_high")
        stop, target = decision.get("stop_price"), decision.get("target_price")
        plan = {"status":plan_status,"entry_low":entry_low,"entry_high":entry_high,"order_type":"LIMIT" if entry_low else None,"stop_price":stop,"targets":[target] if target else [],"stop_distance_pct":round((entry_high-stop)/entry_high*100,2) if entry_high and stop else None,"risk_reward":decision.get("risk_reward"),"equity_risk_pct":decision.get("equity_risk_pct"),"lots":next((p["lots"] for p in positions if p["agent_id"]==agent["id"]),None),"valid_until":"2026-08-28T16:00:00+07:00" if entry_low else None,"confirmation":["Price holds above retest support","Volume remains above baseline"] if entry_low else [],"cancellation":["Close below structural stop","Data becomes stale"] if entry_low else [],"management":["No averaging down","Partial at first target","Trail after 1R"] if entry_low else []}
        views.append({"agent_id":agent["id"],"agent_name":agent["name"],"action":action,"confidence":confidence,"horizon":AGENT_HORIZONS[agent["id"]],"rationale":decision.get("rationale") or "Belum ada evaluasi tersimpan untuk agen ini.","plan":plan})
    total_exposure = sum(p["last_price"]*p["lots"]*100 for p in positions)
    total_fund = db.execute("SELECT COALESCE(SUM(equity),0) FROM agents").fetchone()[0]
    combined_risk = sum(max(0,(p["entry_price"]-(p["stop_price"] or p["entry_price"]))*p["lots"]*100) for p in positions)
    arjum = rich.get("arjum") if rich else cached_arjum_snapshot(db, symbol)
    liquidity = rich.get("liquidity") if rich else liquidity_snapshot(db,symbol)
    flow = rich.get("flow") if rich else flow_snapshot(arjum,last_price)
    fundamental = rich.get("fundamental") if rich else fundamental_snapshot(db,symbol,last_price,instrument["sector"] or "")
    return {**dict(instrument),"snapshot_version":rich.get("snapshot_version","stock-engine-v1.0" if features else "stock-v1.0"),"source_mode":"stored_stock_snapshot","rescan_triggered":False,"external_requests_triggered":False,"trade_status":rich.get("trade_status","OPEN" if features else "UNKNOWN"),"tick_size":tick_size(last_price),"liquidity":liquidity,"scores":rich.get("scores",{"engine":instrument["evaluation_score"],"arjum":arjum.get("signal_score"),"technical":"BULLISH" if features and features.get("ema20") and last_price>features["ema20"] else "NEUTRAL","broker_flow":flow.get("verdict","DATA_NOT_AVAILABLE"),"fundamental":"AVAILABLE" if fundamental.get("status")=="AVAILABLE" else "DATA_NOT_AVAILABLE","liquidity":liquidity.get("grade"),"data_confidence":90 if features and arjum.get("status")=="CACHED" else 80 if features else None,"final_status":instrument["evaluation_status"]}),"chart":build_chart(last_price) if settings.demo_mode else dynamic_chart,"technical":rich.get("technical",dynamic_technical),"flow":flow,"arjum":arjum,"fundamental":fundamental,"agent_views":views,"positions":positions,"portfolio":{"total_exposure":total_exposure,"master_fund_pct":round(total_exposure/total_fund*100,2) if total_fund else 0,"combined_risk":combined_risk,"sector_concentration_pct":None,"order_conflicts":[]},"decision_history":rich.get("decision_history",[]),"report_history":rich.get("report_history",[]),"data_quality":{"status":"DELAYED" if features else ("FRESH" if instrument["market_data_as_of"] else "INCOMPLETE"),"as_of":instrument["market_data_as_of"],"source":"yahoo_cached" if features else "stored_stock_snapshot","confidence":rich.get("scores",{}).get("data_confidence") or (90 if features and arjum.get("status")=="CACHED" else 80 if features else None)}}


def dict_rows(cursor: sqlite3.Cursor) -> list[dict]:
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def agent_win_rate_summary(db: sqlite3.Connection, agent_id: str) -> dict:
    rows = db.execute("""SELECT
      CASE WHEN strategy_version='2.0' THEN 'v2' ELSE 'legacy' END source,
      COUNT(*) trades,
      SUM(CASE WHEN net_pnl>0 THEN 1 ELSE 0 END) wins
      FROM trade_journal
      WHERE agent_id=? AND closed_at IS NOT NULL
      GROUP BY CASE WHEN strategy_version='2.0' THEN 'v2' ELSE 'legacy' END""",
      (agent_id,)).fetchall()
    by_source = {row["source"]: dict(row) for row in rows}
    selected = by_source.get("v2") or by_source.get("legacy")
    return {
        "display_win_rate": round(selected["wins"] / selected["trades"] * 100, 2)
            if selected and selected["trades"] else None,
        "win_rate_source": selected["source"] if selected else None,
        "v2_closed_trades": (by_source.get("v2") or {}).get("trades", 0),
        "legacy_closed_trades": (by_source.get("legacy") or {}).get("trades", 0),
    }


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def provider_usage_today(db: sqlite3.Connection, moment: datetime | None = None) -> dict:
    """Return Arjum usage for the Jakarta calendar day, never yesterday's row."""
    current = moment or datetime.now(JAKARTA)
    if current.tzinfo is None:
        current = current.replace(tzinfo=JAKARTA)
    usage_date = current.astimezone(JAKARTA).date().isoformat()
    row = db.execute(
        "SELECT * FROM provider_usage WHERE provider='arjum' AND usage_date=?",
        (usage_date,),
    ).fetchone()
    if row:
        return dict(row)
    return {
        "provider": "arjum",
        "usage_date": usage_date,
        "requests_used": 0,
        "request_limit": settings.arjum_daily_limit,
    }


def intraday_symbol_ranks(db: sqlite3.Connection, limit: int | None = None) -> dict[str, int]:
    """Return the ranking used by both the collector and the dashboard.

    Open positions and pending orders must stay inside the limited intraday
    universe.  Otherwise a position can stop receiving new candles as soon as
    its daily score falls below the top-N cut, which prevents mark-to-market
    and automated exits from running.
    """
    ceiling = settings.intraday_universe_limit if limit is None else max(0, int(limit))
    rows = db.execute("""SELECT i.symbol FROM instruments i WHERE i.status='ACTIVE'
      ORDER BY CASE
                 WHEN EXISTS (SELECT 1 FROM positions p
                              WHERE p.symbol=i.symbol AND p.status='OPEN') THEN 0
                 WHEN EXISTS (SELECT 1 FROM paper_orders po
                              WHERE po.symbol=i.symbol AND po.status='PENDING') THEN 1
                 WHEN i.evaluation_status='ACTIONABLE' THEN 2
                 WHEN i.evaluation_status='WATCH' THEN 3 ELSE 4
               END,
               COALESCE(i.evaluation_score,0) DESC, i.symbol
      LIMIT ?""", (ceiling,)).fetchall()
    return {row["symbol"]: index for index, row in enumerate(rows, 1)}


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = connect()
    db.executescript("""
    CREATE TABLE IF NOT EXISTS instruments (
      symbol TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT, subsector TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE', last_price REAL, change_pct REAL,
      evaluation_score INTEGER, evaluation_status TEXT, market_data_as_of TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      starting_equity REAL NOT NULL, equity REAL NOT NULL, win_rate REAL,
      open_risk_pct REAL, status TEXT NOT NULL, validation_status TEXT,
      strategy_version TEXT NOT NULL DEFAULT '1.0'
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, symbol TEXT NOT NULL,
      action TEXT NOT NULL, confidence INTEGER, rationale TEXT,
      entry_low REAL, entry_high REAL, stop_price REAL, target_price REAL,
      equity_risk_pct REAL, risk_reward REAL, status TEXT,
      evaluated_at TEXT NOT NULL DEFAULT '2026-08-26T16:22:00+07:00',
      FOREIGN KEY(agent_id) REFERENCES agents(id), FOREIGN KEY(symbol) REFERENCES instruments(symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_symbol_evaluated
      ON decisions(symbol,evaluated_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_instruments_screener
      ON instruments(status,evaluation_status,evaluation_score DESC,symbol);
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, symbol TEXT NOT NULL,
      lots INTEGER NOT NULL, entry_price REAL NOT NULL, last_price REAL NOT NULL,
      stop_price REAL, target_price REAL, status TEXT NOT NULL,
      fill_id TEXT, opened_at TEXT, entry_candle_at TEXT,
      last_managed_candle_at TEXT, buy_fees REAL NOT NULL DEFAULT 0,
      initial_risk REAL, strategy_version TEXT NOT NULL DEFAULT '2.0',
      FOREIGN KEY(agent_id) REFERENCES agents(id), FOREIGN KEY(symbol) REFERENCES instruments(symbol)
    );
    CREATE TABLE IF NOT EXISTS reports (
      report_date TEXT PRIMARY KEY, status TEXT NOT NULL, snapshot_json TEXT NOT NULL,
      generated_at TEXT NOT NULL, source_mode TEXT NOT NULL, rescan_on_read INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS provider_usage (
      provider TEXT NOT NULL, usage_date TEXT NOT NULL, requests_used INTEGER NOT NULL,
      request_limit INTEGER, PRIMARY KEY(provider, usage_date)
    );
    CREATE TABLE IF NOT EXISTS equity_history (
      agent_id TEXT NOT NULL, equity_date TEXT NOT NULL, equity REAL NOT NULL,
      cash REAL NOT NULL, drawdown_pct REAL NOT NULL DEFAULT 0,
      PRIMARY KEY(agent_id,equity_date), FOREIGN KEY(agent_id) REFERENCES agents(id)
    );
    CREATE TABLE IF NOT EXISTS trade_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, symbol TEXT NOT NULL,
      opened_at TEXT NOT NULL, closed_at TEXT, side TEXT NOT NULL DEFAULT 'LONG',
      lots INTEGER NOT NULL, entry_price REAL NOT NULL, exit_price REAL,
      gross_pnl REAL, fees REAL DEFAULT 0, net_pnl REAL, r_multiple REAL,
      setup TEXT, exit_reason TEXT, notes TEXT,
      buy_fees REAL NOT NULL DEFAULT 0, sell_fees REAL NOT NULL DEFAULT 0,
      initial_risk REAL, strategy_version TEXT NOT NULL DEFAULT '2.0',
      FOREIGN KEY(agent_id) REFERENCES agents(id), FOREIGN KEY(symbol) REFERENCES instruments(symbol)
    );
    """)
    init_engine_schema(db)
    # CREATE TABLE does not add fields to an existing SQLite database.
    # Keep the read-only web process compatible while the engine owns the
    # one-time v1 -> v2 history classification.
    for table, columns in {
        "paper_orders": {"timeframe":"TEXT NOT NULL DEFAULT '5m'", "strategy_version":"TEXT NOT NULL DEFAULT '2.0'"},
        "positions": {"fill_id":"TEXT", "opened_at":"TEXT", "entry_candle_at":"TEXT",
            "last_managed_candle_at":"TEXT", "buy_fees":"REAL NOT NULL DEFAULT 0",
            "initial_risk":"REAL", "strategy_version":"TEXT NOT NULL DEFAULT '2.0'"},
        "trade_journal": {"buy_fees":"REAL NOT NULL DEFAULT 0", "sell_fees":"REAL NOT NULL DEFAULT 0",
            "initial_risk":"REAL", "strategy_version":"TEXT NOT NULL DEFAULT '2.0'"},
    }.items():
        existing = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        for column, definition in columns.items():
            if column not in existing:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    if not settings.demo_mode:
        db.commit()
        db.close()
        return
    db.executemany("INSERT OR REPLACE INTO agents(id,name,description,starting_equity,equity,win_rate,open_risk_pct,status,validation_status) VALUES(?,?,?,?,?,?,?,?,?)", AGENTS)
    db.executemany("INSERT OR REPLACE INTO instruments(symbol,name,sector,subsector,last_price,change_pct,evaluation_score,evaluation_status,market_data_as_of) VALUES(?,?,?,?,?,?,?,?,?)", STOCKS)
    if db.execute("SELECT COUNT(*) FROM decisions").fetchone()[0] == 0:
        db.executemany("INSERT INTO decisions(agent_id,symbol,action,confidence,rationale,entry_low,entry_high,stop_price,target_price,equity_risk_pct,risk_reward,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", DECISIONS)
    if db.execute("SELECT COUNT(*) FROM positions").fetchone()[0] == 0:
        db.executemany("INSERT INTO positions(agent_id,symbol,lots,entry_price,last_price,stop_price,target_price,status) VALUES(?,?,?,?,?,?,?,?)", POSITIONS)
    snapshot_path = ROOT / "data" / "evaluation_snapshot_2026-08-26.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    db.execute("INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?,?)", ("2026-08-26", "READY", json.dumps(snapshot), snapshot["generated_at"], "stored_evaluation", 0))
    db.execute("INSERT OR REPLACE INTO provider_usage VALUES(?,?,?,?)", ("arjum", "2026-08-26", 312, 1000))
    if db.execute("SELECT COUNT(*) FROM equity_history").fetchone()[0] == 0:
        for agent_id, _, _, start, equity, *_ in AGENTS:
            steps = [0, .002, -.004, .006, .012, .008, .017, .014, .024, .021, (equity/start)-1]
            peak = start
            for idx, ret in enumerate(steps):
                value = round(start*(1+ret)); peak=max(peak,value); dd=(value-peak)/peak*100
                db.execute("INSERT INTO equity_history VALUES(?,?,?,?,?)", (agent_id, f"2026-08-{idx+16:02d}", value, value, round(dd,2)))
    if db.execute("SELECT COUNT(*) FROM trade_journal").fetchone()[0] == 0:
        trades = [
          ("swing","ANTM","2026-08-17T09:12:00+07:00","2026-08-21T14:18:00+07:00",800,1840,1945,8_400_000,552_000,7_848_000,2.1,"EMA pullback","Target 2 tercapai","Volume mengonfirmasi tren"),
          ("swing","BMRI","2026-08-18T10:05:00+07:00","2026-08-20T13:44:00+07:00",180,6025,5925,-1_800_000,130_000,-1_930_000,-1.0,"Momentum continuation","Stop loss","IHSG melemah intraday"),
          ("scalping","TINS","2026-08-25T09:21:00+07:00","2026-08-25T09:47:00+07:00",300,1100,1105,150_000,98_000,52_000,.18,"VWAP reclaim","Time exit","Edge terkikis biaya"),
          ("open-low","ERAA","2026-08-24T09:08:00+07:00","2026-08-24T14:05:00+07:00",400,446,460,560_000,82_000,478_000,1.7,"Open=Low","Target intraday","Open bertahan sepanjang sesi"),
          ("fundamental","BBCA","2026-07-14T10:20:00+07:00","2026-08-18T11:10:00+07:00",80,8550,8900,2_800_000,198_000,2_602_000,1.4,"Quality value","Valuation trim","Partial realization"),
          ("breakout-retest","PGEO","2026-08-15T10:35:00+07:00","2026-08-22T14:20:00+07:00",250,1370,1480,2_750_000,188_000,2_562_000,2.3,"Breakout retest","Target 2 tercapai","Retest dangkal dan volume kuat")]
        db.executemany("INSERT INTO trade_journal(agent_id,symbol,opened_at,closed_at,lots,entry_price,exit_price,gross_pnl,fees,net_pnl,r_multiple,setup,exit_reason,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", trades)
    db.commit()
    db.close()


def tick_size(price: float) -> int:
    if price < 200: return 1
    if price < 500: return 2
    if price < 2000: return 5
    if price < 5000: return 10
    return 25


def risk_size(equity: float, entry: float, stop: float, risk_pct: float, max_alloc_pct: float = 100) -> dict:
    if entry <= stop or risk_pct <= 0:
        return {"lots": 0, "risk_budget": 0, "reason": "invalid_parameters"}
    tick = tick_size(entry)
    stop = int(stop // tick * tick)
    budget = equity * risk_pct / 100
    risk_per_share = entry - stop
    shares_by_risk = int(budget // risk_per_share)
    shares_by_cash = int((equity * max_alloc_pct / 100) // entry)
    shares = min(shares_by_risk, shares_by_cash)
    lots = shares // 100
    return {"lots": lots, "shares": lots * 100, "risk_budget": budget, "rounded_stop": stop, "tick_size": tick, "notional": lots * 100 * entry}


def current_market_phase(moment: datetime | None = None) -> str:
    """Return a display-only IDX phase; the engine remains the scheduling authority."""
    moment = (moment or datetime.now(JAKARTA)).astimezone(JAKARTA)
    calendar_path = ROOT / "data" / "idx_holidays.json"
    holidays: set[str] = set()
    if calendar_path.exists():
        try:
            holidays = set(json.loads(calendar_path.read_text(encoding="utf-8")).get("holidays", []))
        except (json.JSONDecodeError, OSError):
            pass
    if moment.weekday() >= 5 or moment.date().isoformat() in holidays:
        return "CLOSED"
    now, friday = moment.time(), moment.weekday() == 4
    if clock_time(8, 30) <= now < clock_time(9):
        return "PREOPEN"
    if clock_time(9) <= now < (clock_time(11, 30) if friday else clock_time(12)):
        return "SESSION_1"
    if (clock_time(14) if friday else clock_time(13, 30)) <= now < clock_time(15, 50):
        return "SESSION_2"
    if clock_time(15, 50) <= now < clock_time(16, 15):
        return "CLOSING"
    if clock_time(16, 15) <= now < clock_time(18):
        return "POSTCLOSE"
    return "CLOSED"


def dashboard_activity(db: sqlite3.Connection, limit: int = 20) -> list[dict]:
    """Normalize stored decisions, fills, and engine events into one read-only audit feed."""
    items: list[dict] = []
    for row in db.execute("""SELECT d.evaluated_at created_at,d.symbol,d.agent_id,a.name agent_name,
      d.action event,d.status,d.rationale details FROM decisions d
      JOIN agents a ON a.id=d.agent_id ORDER BY d.id DESC LIMIT ?""", (limit,)).fetchall():
        item = dict(row)
        item.update({"kind": "DECISION", "level": "INFO"})
        items.append(item)
    for row in db.execute("""SELECT pf.filled_at created_at,po.symbol,po.agent_id,a.name agent_name,
      'FILLED' event,po.status,printf('%d lot @ %.0f · fee Rp %.0f',pf.lots,pf.price,pf.fees) details
      FROM paper_fills pf JOIN paper_orders po ON po.id=pf.order_id
      JOIN agents a ON a.id=po.agent_id ORDER BY pf.filled_at DESC LIMIT ?""", (limit,)).fetchall():
        item = dict(row)
        item.update({"kind": "FILL", "level": "INFO"})
        items.append(item)
    for row in db.execute("SELECT * FROM engine_events ORDER BY id DESC LIMIT ?", (limit,)).fetchall():
        details = {}
        try:
            details = json.loads(row["details_json"] or "{}")
        except json.JSONDecodeError:
            details = {"message": row["details_json"]}
        items.append({
            "created_at": row["created_at"], "symbol": details.get("symbol"),
            "agent_id": details.get("agent_id"), "agent_name": details.get("agent_id") or row["component"],
            "event": row["event"], "status": row["level"], "details": details,
            "kind": "ENGINE", "level": row["level"],
        })
    return sorted(items, key=lambda item: item.get("created_at") or "", reverse=True)[:limit]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[nusaquant] {self.address_string()} {fmt % args}")

    def json_response(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def pdf_response(self, body: bytes, filename: str):
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        asset_path = urlparse(self.path).path
        if not asset_path.startswith("/api") and (asset_path in {"/", "/index.html"} or asset_path.endswith((".html", ".js", ".css"))):
            # Detail routes are rewritten to shared HTML files. Revalidate them
            # so an old renderer cannot survive while the API schema evolves.
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    def do_GET(self):
        if settings.is_production and settings.access_password:
            supplied = self.headers.get("Authorization", "")
            expected = "Basic " + base64.b64encode(f"{settings.access_user}:{settings.access_password}".encode()).decode()
            if not hmac.compare_digest(supplied, expected):
                self.send_response(401)
                self.send_header("WWW-Authenticate", 'Basic realm="NusaQuant Paper Fund"')
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path.startswith("/api"):
            return self.handle_api(path, parse_qs(parsed.query))
        if path.startswith("/agents/"):
            self.path = "/agent.html"
        elif path.startswith("/stocks/"):
            self.path = "/stock.html"
        elif path == "/reports" or path.startswith("/reports/"):
            self.path = "/reports.html"
        return super().do_GET()

    def handle_api(self, path: str, query: dict):
        db = connect()
        try:
            if path == "/api/health":
                return self.json_response({"status": "ok", "database": "sqlite", "environment": settings.environment, "paper_only": settings.paper_only, "time": datetime.now(timezone.utc).isoformat()})
            if path == "/api/system/status":
                report = db.execute("SELECT report_date,generated_at,status FROM reports ORDER BY report_date DESC LIMIT 1").fetchone()
                engine_run = db.execute("SELECT * FROM engine_runs ORDER BY rowid DESC LIMIT 1").fetchone()
                eod_run = db.execute("""SELECT * FROM engine_runs
                  WHERE timeframe='1d' AND status IN ('COMPLETED','PARTIAL')
                  ORDER BY completed_at DESC LIMIT 1""").fetchone()
                candle_count = db.execute("SELECT COUNT(*) FROM market_candles").fetchone()[0]
                universe_path = ROOT / "data" / "idx_universe.csv"
                universe_size = max(0, len(universe_path.read_text(encoding="utf-8-sig").splitlines()) - 1) if universe_path.exists() else 0
                calendar_path = ROOT / "data" / "idx_holidays.json"
                calendar = json.loads(calendar_path.read_text(encoding="utf-8")) if calendar_path.exists() else {"status":"MISSING"}
                blockers, warnings = [], []
                report_age_hours = None
                if report:
                    try:
                        generated = datetime.fromisoformat(report["generated_at"])
                        if generated.tzinfo is None:
                            generated = generated.replace(tzinfo=timezone.utc)
                        report_age_hours = round((datetime.now(timezone.utc) - generated.astimezone(timezone.utc)).total_seconds() / 3600, 1)
                        if report_age_hours < -0.25:
                            blockers.append("report_timestamp_in_future")
                        elif report_age_hours > settings.stale_after_hours:
                            blockers.append("latest_report_is_stale")
                    except ValueError:
                        blockers.append("latest_report_timestamp_invalid")
                else:
                    blockers.append("no_evaluation_report")
                if settings.is_production and settings.demo_mode:
                    blockers.append("demo_mode_enabled_in_production")
                if not settings.paper_only:
                    blockers.append("paper_only_guard_disabled")
                if settings.is_production and not settings.access_password:
                    blockers.append("production_access_control_not_configured")
                if settings.is_production and not settings.data_license_acknowledged:
                    blockers.append("market_data_terms_not_acknowledged")
                if not engine_run or engine_run["status"] not in {"COMPLETED", "PARTIAL"}:
                    blockers.append("no_successful_engine_run")
                if not eod_run:
                    blockers.append("no_successful_eod_run")
                elif eod_run["universe_size"] < universe_size:
                    blockers.append("latest_eod_universe_incomplete")
                if candle_count == 0:
                    blockers.append("no_cached_market_candles")
                if universe_size < settings.min_universe_size:
                    blockers.append("idx_universe_below_minimum")
                if calendar.get("status") != "VALIDATED":
                    blockers.append("idx_holiday_calendar_not_validated")
                if not settings.yahoo_enabled:
                    blockers.append("yahoo_provider_disabled")
                if not settings.arjum_api_key:
                    warnings.append("arjum_api_key_not_configured")
                if settings.allow_delayed_paper:
                    warnings.append("yahoo_idx_data_delayed_paper_only")
                if settings.is_production and HOST in {"0.0.0.0", "::"}:
                    warnings.append("protect_public_endpoint_with_tls_and_access_control")
                return self.json_response({
                    "ready": not blockers,
                    "environment": settings.environment,
                    "demo_mode": settings.demo_mode,
                    "paper_only": settings.paper_only,
                    "market_phase": current_market_phase(),
                    "database_path": str(DB_PATH),
                    "providers": {"yahoo_enabled": settings.yahoo_enabled, "yahoo_delay_minutes": settings.yahoo_delay_minutes, "delayed_paper_allowed": settings.allow_delayed_paper, "arjum_configured": bool(settings.arjum_api_key), "arjum_daily_limit": settings.arjum_daily_limit},
                    "engine": {"latest_run": dict(engine_run) if engine_run else None, "latest_eod_run": dict(eod_run) if eod_run else None, "candle_count": candle_count, "universe_size": universe_size, "minimum_universe_size": settings.min_universe_size, "calendar_status": calendar.get("status")},
                    "latest_report": dict(report) if report else None,
                    "report_age_hours": report_age_hours,
                    "stale_after_hours": settings.stale_after_hours,
                    "blockers": blockers,
                    "warnings": warnings,
                })
            if path == "/api/engine/status":
                run = db.execute("SELECT * FROM engine_runs ORDER BY rowid DESC LIMIT 1").fetchone()
                return self.json_response({"latest_run":dict(run) if run else None,"market_phase":current_market_phase(),"pending_orders":db.execute("SELECT COUNT(*) FROM paper_orders WHERE status='PENDING'").fetchone()[0],"fills":db.execute("SELECT COUNT(*) FROM paper_fills").fetchone()[0],"candles":db.execute("SELECT COUNT(*) FROM market_candles").fetchone()[0],"events":dict_rows(db.execute("SELECT * FROM engine_events ORDER BY id DESC LIMIT 20")),"source":"Yahoo .JK","data_status":"DELAYED","paper_only":settings.paper_only})
            if path == "/api/overview":
                agents = dict_rows(db.execute("SELECT *, ROUND((equity-starting_equity)/starting_equity*100,2) pnl_pct FROM agents ORDER BY id"))
                for agent in agents:
                    agent.update(agent_win_rate_summary(db, agent["id"]))
                usage = provider_usage_today(db)
                total_equity = sum(a["equity"] for a in agents)
                equity_curve = dict_rows(db.execute("""SELECT equity_date,SUM(equity) equity
                  FROM equity_history GROUP BY equity_date ORDER BY equity_date"""))
                prior_equity = equity_curve[-2]["equity"] if len(equity_curve) > 1 else None
                position_stats = db.execute("""SELECT COUNT(*) count,COALESCE(SUM(last_price*lots*100),0) market_value,
                  COALESCE(SUM((last_price-entry_price)*lots*100),0) unrealized,
                  COALESCE(SUM(MAX(entry_price-COALESCE(stop_price,entry_price),0)*lots*100),0) risk_value
                  FROM positions WHERE status='OPEN'""").fetchone()
                latest = db.execute("""SELECT d.*,a.name agent_name,i.name FROM decisions d JOIN agents a ON a.id=d.agent_id JOIN instruments i ON i.symbol=d.symbol
                  WHERE d.action IN ('BUY','ACCUMULATE') ORDER BY d.id DESC LIMIT 1""").fetchone()
                return self.json_response({"agents": agents, "total_equity": total_equity,
                  "today_pnl": total_equity-prior_equity if prior_equity is not None else None,
                  "position_stats":dict(position_stats),"open_risk_pct":round(position_stats["risk_value"]/total_equity*100,2) if total_equity else 0,
                  "latest_decision":dict(latest) if latest else None,"provider_usage": usage,
                  "equity_curve":equity_curve,"source_mode": "stored_evaluation"})
            if path == "/api/agents":
                agents = dict_rows(db.execute("SELECT *, ROUND((equity-starting_equity)/starting_equity*100,2) pnl_pct FROM agents ORDER BY id"))
                for agent in agents:
                    agent.update(agent_win_rate_summary(db, agent["id"]))
                return self.json_response(agents)
            if path == "/api/positions":
                return self.json_response(dict_rows(db.execute("SELECT p.*,a.name agent_name,ROUND((p.last_price-p.entry_price)*p.lots*100,0) unrealized_pnl,ROUND((p.last_price-p.entry_price)/p.entry_price*100,2) pnl_pct FROM positions p JOIN agents a ON a.id=p.agent_id WHERE p.status='OPEN' ORDER BY p.id DESC")))
            if path.startswith("/api/agents/"):
                agent_id = path.split("/")[-1]
                row = db.execute("SELECT *, ROUND((equity-starting_equity)/starting_equity*100,2) pnl_pct FROM agents WHERE id=?", (agent_id,)).fetchone()
                if not row: return self.json_response({"error": "agent_not_found"}, 404)
                payload = dict(row)
                payload["positions"] = dict_rows(db.execute("""SELECT p.*,i.name,
                  ROUND(p.entry_price*p.lots*100,0) entry_value,
                  ROUND(p.last_price*p.lots*100,0) market_value,
                  ROUND((p.last_price-p.entry_price)*p.lots*100,0) unrealized_pnl
                  FROM positions p JOIN instruments i USING(symbol)
                  WHERE p.agent_id=? AND p.status='OPEN' ORDER BY p.id DESC""", (agent_id,)))
                payload["open_position_count"] = len(payload["positions"])
                payload["pending_orders"] = dict_rows(db.execute("""SELECT po.*,i.name,
                  ROUND(po.limit_price*po.lots*100,0) order_value
                  FROM paper_orders po JOIN instruments i USING(symbol)
                  WHERE po.agent_id=? AND po.status='PENDING' ORDER BY po.created_at DESC""", (agent_id,)))
                payload["decisions"] = dict_rows(db.execute("SELECT d.*,i.name FROM decisions d JOIN instruments i USING(symbol) WHERE d.agent_id=? ORDER BY d.id DESC LIMIT 100", (agent_id,)))
                payload["equity_history"] = dict_rows(db.execute("SELECT * FROM equity_history WHERE agent_id=? ORDER BY equity_date", (agent_id,)))
                payload["trade_journal"] = dict_rows(db.execute("""SELECT t.*,i.name,
                  ROUND(t.entry_price*t.lots*100,0) entry_value,
                  CASE WHEN t.exit_price IS NOT NULL THEN ROUND(t.exit_price*t.lots*100,0) END exit_value
                  FROM trade_journal t JOIN instruments i USING(symbol)
                  WHERE t.agent_id=? ORDER BY t.opened_at DESC""", (agent_id,)))
                for trade in payload["trade_journal"]:
                    if trade.get("r_multiple") is not None:
                        trade["r_multiple"] = round(float(trade["r_multiple"]), 2)
                payload["strategy"] = STRATEGIES.get(agent_id, {})
                closed = [t for t in payload["trade_journal"] if t["closed_at"] and t.get("strategy_version") == "2.0"]
                legacy_closed = [t for t in payload["trade_journal"] if t["closed_at"] and t.get("strategy_version") != "2.0"]
                net = sum(t["net_pnl"] or 0 for t in closed)
                wins = [t for t in closed if (t["net_pnl"] or 0) > 0]
                losses = [t for t in closed if (t["net_pnl"] or 0) < 0]
                payload["performance"] = {"strategy_version":"2.0","closed_trades":len(closed),"wins":len(wins),"win_rate":round(len(wins)/len(closed)*100,2) if closed else None,"net_pnl":net,"profit_factor":round(sum(t["net_pnl"] for t in wins)/abs(sum(t["net_pnl"] for t in losses)),2) if losses else None,"avg_r":round(sum(t["r_multiple"] or 0 for t in closed)/len(closed),2) if closed else None,"max_drawdown_pct":round(min((x["drawdown_pct"] for x in payload["equity_history"]),default=0),2)}
                legacy_wins = [t for t in legacy_closed if (t["net_pnl"] or 0) > 0]
                payload["legacy_performance"] = {"strategy_version":"1.0-legacy","closed_trades":len(legacy_closed),"wins":len(legacy_wins),"win_rate":round(len(legacy_wins)/len(legacy_closed)*100,2) if legacy_closed else None,"net_pnl":sum(t["net_pnl"] or 0 for t in legacy_closed)}
                return self.json_response(payload)
            if path == "/api/screener":
                status = query.get("status", [None])[0]
                sql = """SELECT i.*,d.agent_id owner_agent_id,a.name owner_agent_name,
                  d.action signal,d.status decision_status,d.confidence agent_confidence,d.rationale,d.entry_low,d.entry_high,
                  d.stop_price,d.target_price,d.risk_reward,d.equity_risk_pct,d.evaluated_at
                  FROM instruments i
                  LEFT JOIN decisions d ON d.id=(SELECT x.id FROM decisions x WHERE x.symbol=i.symbol ORDER BY x.evaluated_at DESC,x.id DESC LIMIT 1)
                  LEFT JOIN agents a ON a.id=d.agent_id"""
                args = []
                if status: sql += " WHERE i.evaluation_status=?"; args.append(status.upper())
                sql += " ORDER BY i.evaluation_score DESC"
                rows = dict_rows(db.execute(sql, args))
                intraday_ranks = intraday_symbol_ranks(db)
                flow_rows = {row["symbol"]: dict(row) for row in db.execute("SELECT symbol,status,verdict FROM screener_flow_cache")}
                for row in rows:
                    row["intraday_rank"] = intraday_ranks.get(row["symbol"])
                    row["is_intraday"] = row["symbol"] in intraday_ranks
                    flow = flow_rows.get(row["symbol"], {})
                    row["flow_status"] = flow.get("status", "DATA_NOT_AVAILABLE")
                    row["flow_verdict"] = flow.get("verdict") if flow.get("status") == "AVAILABLE" else "DATA NOT AVAILABLE"
                return self.json_response({"universe": "ALL_ACTIVE_IDX", "source": "stored_evaluation",
                  "intraday_count": len(intraday_ranks), "intraday_symbols": list(intraday_ranks), "rows": rows})
            if path == "/api/activity":
                try:
                    limit = min(50, max(1, int(query.get("limit", [20])[0])))
                except ValueError:
                    limit = 20
                return self.json_response({"rows": dashboard_activity(db, limit), "source_mode": "stored_audit_log"})
            if path == "/api/reports":
                rows = dict_rows(db.execute("SELECT report_date,status,generated_at,source_mode,rescan_on_read FROM reports ORDER BY report_date DESC LIMIT 90"))
                return self.json_response({"rows": rows, "rescan_triggered": False})
            if path.startswith("/api/reports/") and path.endswith("/pdf"):
                report_date = path.split("/")[-2]
                row = (db.execute("SELECT * FROM reports ORDER BY report_date DESC LIMIT 1").fetchone()
                       if report_date == "latest" else db.execute("SELECT * FROM reports WHERE report_date=?", (report_date,)).fetchone())
                if not row: return self.json_response({"status":"NOT_READY","rescan_triggered":False},404)
                from pdf_report import build_daily_report_pdf
                payload = json.loads(row["snapshot_json"]); payload["rescan_triggered"] = False
                body = build_daily_report_pdf(payload)
                return self.pdf_response(body, f"NusaQuant_Daily_Report_{payload.get('evaluation_date','latest')}.pdf")
            if path.startswith("/api/stocks/"):
                symbol = path.split("/")[-1].upper()
                row = db.execute("SELECT * FROM instruments WHERE symbol=?", (symbol,)).fetchone()
                if not row: return self.json_response({"error": "stock_not_found"}, 404)
                return self.json_response(stock_workspace(db, row))
            if path == "/api/reports/latest":
                row = db.execute("SELECT * FROM reports ORDER BY report_date DESC LIMIT 1").fetchone()
                if not row: return self.json_response({"status": "NOT_READY", "rescan_triggered": False}, 404)
                payload = json.loads(row["snapshot_json"]); payload["rescan_triggered"] = False
                return self.json_response(payload)
            if path.startswith("/api/reports/"):
                date = path.split("/")[-1]
                row = db.execute("SELECT * FROM reports WHERE report_date=?", (date,)).fetchone()
                if not row: return self.json_response({"status": "NOT_READY", "rescan_triggered": False}, 404)
                payload = json.loads(row["snapshot_json"]); payload["rescan_triggered"] = False
                return self.json_response(payload)
            if path == "/api/risk/size":
                try:
                    return self.json_response(risk_size(float(query["equity"][0]), float(query["entry"][0]), float(query["stop"][0]), float(query["risk_pct"][0])))
                except (KeyError, ValueError, ZeroDivisionError):
                    return self.json_response({"error": "invalid_risk_parameters"}, 400)
            return self.json_response({"error": "not_found"}, 404)
        finally:
            db.close()


if __name__ == "__main__":
    init_db()
    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"NusaQuant running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
