"""Printable NusaQuant Daily Report built only from stored snapshots."""
from __future__ import annotations

from html import escape
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

INK = colors.HexColor("#17202A")
MUTED = colors.HexColor("#667085")
GREEN = colors.HexColor("#0E9F6E")
RED = colors.HexColor("#D92D20")
BLUE = colors.HexColor("#2563EB")
PALE = colors.HexColor("#F4F7FA")
LINE = colors.HexColor("#DCE3EA")


def money(value):
    if value is None: return "-"
    return f"{float(value):,.0f}".replace(",", ".")


def decimal(value, digits=2, suffix=""):
    if value is None: return "-"
    return f"{float(value):,.{digits}f}{suffix}".replace(",", "X").replace(".", ",").replace("X", ".")


class IhsgChart(Flowable):
    def __init__(self, candles, width=170*mm, height=66*mm):
        super().__init__(); self.candles=candles[-60:]; self.width=width; self.height=height

    def draw(self):
        c = self.canv; left, right, bottom, top = 11*mm, 3*mm, 8*mm, 4*mm
        w, h = self.width-left-right, self.height-bottom-top
        closes = [float(x["close"]) for x in self.candles]
        smas = [float(x["sma20"]) for x in self.candles if x.get("sma20") is not None]
        values = closes+smas
        if len(values) < 2:
            c.setFillColor(MUTED); c.drawString(left,bottom+h/2,"Chart IHSG belum tersedia"); return
        lo, hi = min(values), max(values); span = hi-lo or 1
        def y(value): return bottom+(float(value)-lo)/span*h
        c.setStrokeColor(LINE); c.setLineWidth(.4); c.setFillColor(MUTED); c.setFont("Helvetica",6.5)
        for i in range(5):
            yy=bottom+h*i/4; price=lo+span*i/4; c.line(left,yy,left+w,yy); c.drawRightString(left-2,yy-2,money(price))
        step=w/max(1,len(self.candles)-1)
        c.setStrokeColor(BLUE); c.setLineWidth(1.4)
        points=[(left+i*step,y(row["close"])) for i,row in enumerate(self.candles)]
        for a,b in zip(points,points[1:]): c.line(a[0],a[1],b[0],b[1])
        sma_points=[(left+i*step,y(row["sma20"])) for i,row in enumerate(self.candles) if row.get("sma20") is not None]
        c.setStrokeColor(colors.HexColor("#F59E0B")); c.setLineWidth(1)
        for a,b in zip(sma_points,sma_points[1:]): c.line(a[0],a[1],b[0],b[1])
        c.setFillColor(MUTED); c.setFont("Helvetica",6.5)
        for i in (0,len(self.candles)//2,len(self.candles)-1):
            label=str(self.candles[i]["candle_at"])[:10]; x=left+i*step
            if i==len(self.candles)-1: c.drawRightString(x,bottom-6,label)
            elif i==0: c.drawString(x,bottom-6,label)
            else: c.drawCentredString(x,bottom-6,label)
        c.setFillColor(BLUE); c.rect(left,bottom+h+4,7,2,fill=1,stroke=0); c.setFillColor(MUTED); c.drawString(left+10,bottom+h+2,"Close")
        c.setFillColor(colors.HexColor("#F59E0B")); c.rect(left+40,bottom+h+4,7,2,fill=1,stroke=0); c.setFillColor(MUTED); c.drawString(left+50,bottom+h+2,"SMA20")


def styles():
    sheet=getSampleStyleSheet()
    return {
      "title":ParagraphStyle("Title",parent=sheet["Title"],fontName="Helvetica-Bold",fontSize=23,leading=27,textColor=INK,alignment=TA_LEFT,spaceAfter=5*mm),
      "h1":ParagraphStyle("H1",parent=sheet["Heading1"],fontName="Helvetica-Bold",fontSize=16,leading=20,textColor=INK,spaceBefore=2*mm,spaceAfter=4*mm),
      "h2":ParagraphStyle("H2",parent=sheet["Heading2"],fontName="Helvetica-Bold",fontSize=11,leading=14,textColor=INK,spaceBefore=3*mm,spaceAfter=2*mm),
      "body":ParagraphStyle("Body",parent=sheet["BodyText"],fontName="Helvetica",fontSize=8.5,leading=13,textColor=INK),
      "small":ParagraphStyle("Small",parent=sheet["BodyText"],fontName="Helvetica",fontSize=7,leading=10,textColor=MUTED),
      "kicker":ParagraphStyle("Kicker",parent=sheet["BodyText"],fontName="Helvetica-Bold",fontSize=7,leading=9,textColor=BLUE,spaceAfter=2*mm),
      "right":ParagraphStyle("Right",parent=sheet["BodyText"],fontName="Helvetica",fontSize=7,leading=9,textColor=MUTED,alignment=TA_RIGHT),
    }


def page_decor(canvas, doc):
    canvas.saveState(); width,height=A4
    canvas.setStrokeColor(LINE); canvas.line(18*mm,14*mm,width-18*mm,14*mm)
    canvas.setFont("Helvetica",7); canvas.setFillColor(MUTED)
    canvas.drawString(18*mm,9*mm,"NusaQuant - delayed-data paper research")
    canvas.drawRightString(width-18*mm,9*mm,f"Page {doc.page}")
    canvas.restoreState()


def metric_table(ihsg, st):
    metrics=[
      ("Close",money(ihsg.get("close"))), ("Daily",decimal(ihsg.get("change_pct"),2,"%")),
      ("5 sessions",decimal(ihsg.get("return_5d_pct"),2,"%")), ("20 sessions",decimal(ihsg.get("return_20d_pct"),2,"%")),
      ("SMA20",money(ihsg.get("sma20"))), ("SMA50",money(ihsg.get("sma50"))),
      ("RSI14",decimal(ihsg.get("rsi14"),1)), ("From 20D high",decimal(ihsg.get("distance_from_20d_high_pct"),2,"%")),
    ]
    rows=[]
    for i in range(0,len(metrics),2):
        rows.append([Paragraph(f"<font color='#667085'>{escape(metrics[i][0])}</font><br/><b>{escape(metrics[i][1])}</b>",st["body"]),
                     Paragraph(f"<font color='#667085'>{escape(metrics[i+1][0])}</font><br/><b>{escape(metrics[i+1][1])}</b>",st["body"])])
    table=Table(rows,colWidths=[85*mm,85*mm],hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),.5,LINE),("INNERGRID",(0,0),(-1,-1),.5,LINE),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),4*mm),("TOPPADDING",(0,0),(-1,-1),2.5*mm),("BOTTOMPADDING",(0,0),(-1,-1),2.5*mm)]))
    return table


def agent_table(report, st):
    data=[["Agent","Evaluated","Actionable","Wait / research","Rejected","Best daily candidate"]]
    for a in report.get("agent_evaluations",[]):
        best="-" if not a.get("best_symbol") else f"{a['best_symbol']} - {a.get('best_action') or '-'} ({a.get('best_confidence') or '-'}%)"
        data.append([a.get("agent_name") or a.get("agent_id"),a.get("evaluated",0),a.get("actionable",0),(a.get("waiting",0)+a.get("research",0)),a.get("rejected",0),best])
    table=Table(data,colWidths=[35*mm,17*mm,19*mm,26*mm,17*mm,56*mm],repeatRows=1)
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),INK),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTNAME",(0,1),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),7),("GRID",(0,0),(-1,-1),.4,LINE),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,PALE]),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),2*mm),("RIGHTPADDING",(0,0),(-1,-1),2*mm),("TOPPADDING",(0,0),(-1,-1),2.4*mm),("BOTTOMPADDING",(0,0),(-1,-1),2.4*mm)]))
    return table


AGENT_GUIDE = {
  "swing": ("Trend dan momentum Daily", "5-15 hari"),
  "scalping": ("Momentum intraday 5 menit", "Intraday"),
  "open-low": ("Kekuatan pembukaan Open = Low", "60 menit pertama"),
  "fundamental": ("Quality, valuation, dan timing akumulasi", "3-6 bulan"),
  "breakout-retest": ("Breakout lalu retest struktur", "2-10 hari"),
}


def callout(title, body, st, accent=BLUE):
    table=Table([[Paragraph(f"<b>{escape(title)}</b><br/>{escape(body)}",st["body"])]],colWidths=[170*mm])
    table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),.7,accent),("LINEBEFORE",(0,0),(0,-1),3,accent),("LEFTPADDING",(0,0),(-1,-1),4*mm),("RIGHTPADDING",(0,0),(-1,-1),4*mm),("TOPPADDING",(0,0),(-1,-1),3.5*mm),("BOTTOMPADDING",(0,0),(-1,-1),3.5*mm)]))
    return table


def market_interpretation(report):
    ihsg=report.get("ihsg") or {}; regime=report.get("market_regime") or {}; funnel=report.get("funnel") or {}
    trend=ihsg.get("trend","UNCLASSIFIED"); breadth=regime.get("breadth_positive_pct"); above=regime.get("above_ema20_pct")
    if trend=="BULLISH" and breadth is not None and breadth < 55:
        stance="SELECTIVE BUY"
        meaning="IHSG masih berada dalam struktur naik, tetapi penguatan belum merata. Kenaikan indeks kemungkinan ditopang kelompok saham terbatas, sehingga pemilihan saham lebih penting daripada sekadar mengikuti arah indeks."
    elif trend=="BULLISH" and (breadth or 0) >= 55:
        stance="RISK-ON TERKONTROL"
        meaning="Arah IHSG dan breadth bergerak sejalan. Lingkungan relatif mendukung entry baru, tetapi setiap setup tetap harus lolos stop dan risk/reward."
    elif trend=="BEARISH":
        stance="DEFENSIVE"
        meaning="IHSG berada di bawah rata-rata utama. Kurangi agresivitas, hindari mengejar rebound tanpa konfirmasi, dan prioritaskan perlindungan modal."
    else:
        stance="WAIT / SELECTIVE"
        meaning="Arah pasar belum konsisten. Entry hanya layak pada saham dengan katalis teknikal atau fundamental yang jelas dan ukuran posisi konservatif."
    actionable=int(funnel.get("actionable") or 0)
    action=(f"Fokus pada {actionable} trading plan actionable yang sudah lolos risk gate. " if actionable else "Tidak ada trading plan yang layak dipaksakan. ")
    action += "Gunakan entry zone dan stop masing-masing agent; jangan menyamakan horizon intraday dengan swing atau fundamental."
    divergence=(f"Breadth harian {decimal(breadth,1,'%')} sementara {decimal(above,1,'%')} sampel masih di atas EMA20. "
      "Ini menunjukkan momentum sangat pendek lebih lemah daripada struktur tren menengah." if breadth is not None and above is not None and above-breadth>=10 else
      "Breadth dan struktur EMA20 relatif searah, sehingga pembacaan regime lebih konsisten.")
    return stance,meaning,action,divergence


def agent_explanation(agent):
    purpose,horizon=AGENT_GUIDE.get(agent.get("agent_id"),("Strategi independen","Sesuai trading plan"))
    actionable=int(agent.get("actionable") or 0); rejected=int(agent.get("rejected") or 0); waiting=int(agent.get("waiting") or 0)+int(agent.get("research") or 0)
    if actionable:
        conclusion=f"Ada {actionable} setup yang dapat ditindaklanjuti. {rejected} setup lain ditahan oleh risk atau portfolio gate."
        action="Baca plan per saham; entry hanya di zona yang tercantum dan gunakan stop agent ini."
    else:
        conclusion=f"Belum ada entry yang disetujui. {waiting} masih menunggu/riset dan {rejected} ditolak risk gate."
        action="Tidak membuka posisi baru dari agent ini sampai evaluasi berikutnya menghasilkan status actionable."
    if agent.get("agent_id") in {"scalping","open-low"}:
        action += " Rekap EOD bukan sinyal terlambat untuk dikejar; strategi ini harus divalidasi saat sesi aktif."
    best=(f"Kandidat observasi tertinggi {agent.get('best_symbol')} - {agent.get('best_action')} - confidence {agent.get('best_confidence')}%, status {agent.get('best_status')}."
          if agent.get("best_symbol") else "Belum ada kandidat observasi.")
    return purpose,horizon,conclusion,action,best


def group_recommendations(setups):
    grouped={}
    for item in setups:
        grouped.setdefault(item.get("symbol","-"),[]).append(item)
    groups=list(grouped.values())
    groups.sort(key=lambda rows:max(float(x.get("score") or 0) for x in rows),reverse=True)
    return groups


def recommendation_card(items, rank, st):
    primary=max(items,key=lambda x:(float(x.get("score") or 0),float(x.get("risk_reward") or 0)))
    symbol=primary.get("symbol","-"); change=primary.get("change_pct"); change_color="#0E9F6E" if change is not None and change>=0 else "#D92D20"
    agents=", ".join(dict.fromkeys(x.get("owner_agent_name") or x.get("owner_agent") or "-" for x in items))
    stop_distance=primary.get("stop_distance_pct"); risk_label="TINGGI" if stop_distance is not None and stop_distance>7 else "TERKONTROL"
    risk_color="#D92D20" if risk_label=="TINGGI" else "#0E9F6E"
    header=Table([[Paragraph(f"<font color='#AAB4C0'>PRIORITAS {rank}</font><br/><font color='#FFFFFF' size='15'><b>{escape(symbol)}</b></font> &nbsp; <font color='{change_color}'>{escape(decimal(change,2,'%'))}</font>",st["body"]),Paragraph(f"<font color='#FFFFFF'><b>{escape(primary.get('action') or '-')}</b> / {escape(primary.get('status') or '-')}</font><br/><font color='#AAB4C0'>{escape(agents)}</font>",st["right"]) ]],colWidths=[75*mm,95*mm])
    header.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),INK),("TEXTCOLOR",(0,0),(-1,-1),colors.white),("LEFTPADDING",(0,0),(-1,-1),4*mm),("RIGHTPADDING",(0,0),(-1,-1),4*mm),("TOPPADDING",(0,0),(-1,-1),3*mm),("BOTTOMPADDING",(0,0),(-1,-1),3*mm),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    why=primary.get("rationale") or "Setup lolos evaluasi agent dan risk gate pada snapshot tersimpan."
    plan=Paragraph(f"<b>Plan utama ({escape(primary.get('owner_agent_name') or primary.get('owner_agent') or '-')})</b><br/>Entry {money(primary.get('entry_low'))} | Stop {money(primary.get('stop_price'))} | Target {money(primary.get('target_price'))} | Net R/R {decimal(primary.get('risk_reward'),2)} | Risk equity {decimal(primary.get('agent_equity_risk_pct'),2,'%')} | {primary.get('lots') or '-'} lot",st["body"])
    interpretation=Paragraph(f"<b>Mengapa masuk daftar:</b> {escape(why)}<br/><b>Cara bertindak:</b> Tunggu harga berada di entry plan dan validasi kondisi strategi; jangan mengejar jika harga sudah menjauh. <b>Invalidasi:</b> plan batal atau posisi keluar bila stop {money(primary.get('stop_price'))} tersentuh.<br/><b>Risiko plan:</b> <font color='{risk_color}'><b>{risk_label}</b></font> - jarak stop {decimal(stop_distance,2,'%')}; horizon {escape(primary.get('horizon') or '-')}. Data harga delayed.",st["body"])
    alternatives=[]
    for item in items:
        if item is primary: continue
        alternatives.append(f"{item.get('owner_agent_name') or item.get('owner_agent')}: entry {money(item.get('entry_low'))}, stop {money(item.get('stop_price'))}, target {money(item.get('target_price'))}, confidence {item.get('score') or '-'}%")
    alt=Paragraph("<b>Plan agent lain:</b> "+escape("; ".join(alternatives)),st["small"]) if alternatives else None
    body=[header,Table([[plan],[interpretation]],colWidths=[170*mm],style=TableStyle([("BOX",(0,0),(-1,-1),.6,LINE),("LEFTPADDING",(0,0),(-1,-1),4*mm),("RIGHTPADDING",(0,0),(-1,-1),4*mm),("TOPPADDING",(0,0),(-1,-1),3*mm),("BOTTOMPADDING",(0,0),(-1,-1),3*mm),("LINEBELOW",(0,0),(-1,0),.4,LINE)]))]
    if alt: body.append(Table([[alt]],colWidths=[170*mm],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),.6,LINE),("LEFTPADDING",(0,0),(-1,-1),4*mm),("RIGHTPADDING",(0,0),(-1,-1),4*mm),("TOPPADDING",(0,0),(-1,-1),2*mm),("BOTTOMPADDING",(0,0),(-1,-1),2*mm)])))
    body.append(Spacer(1,4*mm))
    return KeepTogether(body)


def build_daily_report_pdf(report: dict) -> bytes:
    buffer=BytesIO(); st=styles(); doc=SimpleDocTemplate(buffer,pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=20*mm,title=f"NusaQuant Daily Report {report.get('evaluation_date','')}",author="NusaQuant")
    quality=report.get("data_quality",{}); universe=report.get("universe",{}); funnel=report.get("funnel",{}); regime=report.get("market_regime",{})
    ihsg=report.get("ihsg") or {}; stance,meaning,action,divergence=market_interpretation(report)
    story=[Paragraph("NUSAQUANT / DAILY DECISION REPORT",st["kicker"]),Paragraph(f"Apa yang Perlu Dilakukan Hari Ini?<br/><font size='11' color='#667085'>Evaluasi {escape(report.get('evaluation_date','-'))} - seluruh angka berasal dari snapshot tersimpan</font>",st["title"])]
    meta=Table([[f"Coverage {decimal(quality.get('score_pct'),1,'%')}",f"Universe {universe.get('symbols_ok',universe.get('evaluated_count','-'))}/{universe.get('eligible_count','-')}",f"Regime {regime.get('label','-')}",f"Actionable {funnel.get('actionable',0)}"]],colWidths=[42.5*mm]*4)
    meta.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),INK),("TEXTCOLOR",(0,0),(-1,-1),colors.white),("FONTNAME",(0,0),(-1,-1),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),8),("ALIGN",(0,0),(-1,-1),"CENTER"),("TOPPADDING",(0,0),(-1,-1),3*mm),("BOTTOMPADDING",(0,0),(-1,-1),3*mm)]))
    story += [meta,Spacer(1,6*mm),callout(f"KESIMPULAN: {stance}",meaning,st,GREEN if "BUY" in stance or "RISK-ON" in stance else BLUE),Spacer(1,5*mm),Paragraph("Tindakan yang disarankan",st["h2"]),Paragraph(escape(action),st["body"]),Spacer(1,3*mm),Paragraph("Hal penting yang mudah terlewat",st["h2"]),Paragraph(escape(divergence),st["body"]),Spacer(1,6*mm),Paragraph("Bagaimana hasil hari ini disaring",st["h2"])]
    stages=[
      ("1. Market data",f"{funnel.get('universe_scanned',universe.get('symbols_ok','-'))} saham memiliki data"),
      ("2. Feature valid",f"{funnel.get('feature_samples',regime.get('sample_size','-'))} saham cukup untuk indikator"),
      ("3. Kandidat unik",f"{funnel.get('unique_candidates',universe.get('evaluated_count','-'))} saham masuk evaluasi agent"),
      ("4. Sinyal agent",f"{funnel.get('shortlisted','-')} Buy/Accumulate - dapat berisi ticker yang sama dari beberapa agent"),
      ("5. Siap ditindak",f"{funnel.get('actionable',0)} plan lolos seluruh risk gate; {funnel.get('hard_rejects',0)} ditolak"),
    ]
    funnel_table=Table([[Paragraph(f"<b>{escape(a)}</b><br/><font color='#667085'>{escape(b)}</font>",st["small"]) for a,b in stages]],colWidths=[34*mm]*5)
    funnel_table.setStyle(TableStyle([("BOX",(0,0),(-1,-1),.5,LINE),("INNERGRID",(0,0),(-1,-1),.5,LINE),("BACKGROUND",(0,0),(-1,-1),PALE),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),2.5*mm),("RIGHTPADDING",(0,0),(-1,-1),2.5*mm),("TOPPADDING",(0,0),(-1,-1),3*mm),("BOTTOMPADDING",(0,0),(-1,-1),3*mm)]))
    story += [funnel_table,Spacer(1,5*mm),Paragraph("Batas penggunaan report",st["h2"]),Paragraph(f"Data {escape(quality.get('status','UNKNOWN'))} dari {escape(quality.get('provider','snapshot lokal'))}, delay indikatif {quality.get('provider_delay_minutes','-')} menit. Coverage {decimal(quality.get('score_pct'),1,'%')}; report dibuat {escape(report.get('generated_at','-'))}. Angka confidence adalah keyakinan rule agent, bukan peluang profit. Report ini tidak boleh digunakan untuk mengejar harga yang sudah melewati entry plan.",st["small"]),PageBreak(),Paragraph("1. Kondisi IHSG dan Implikasinya",st["h1"]),Paragraph(escape(ihsg.get("explanation") or "Data IHSG belum tersedia pada snapshot ini."),st["body"]),Spacer(1,3*mm)]
    if ihsg.get("candles"): story += [IhsgChart(ihsg["candles"]),Spacer(1,3*mm),metric_table(ihsg,st)]
    story += [Spacer(1,4*mm),callout("CARA MEMBACA KONDISI PASAR",divergence+" "+meaning,st,BLUE),Spacer(1,4*mm),Paragraph("Implikasi untuk lima strategi",st["h2"]),Paragraph("Swing dan Breakout-Retest dapat tetap mencari saham yang lebih kuat dari pasar, tetapi jumlah posisi baru sebaiknya dibatasi. Fundamental boleh melakukan cicilan hanya jika quality dan timing sama-sama lolos. Scalping serta Open = Low tetap bergantung pada data 5 menit saat sesi aktif; chart Daily IHSG hanya menjadi konteks, bukan trigger entry.",st["body"]),PageBreak(),Paragraph("2. Kesimpulan Masing-masing Agent",st["h1"]),Paragraph("Tabel adalah rekap kuantitatif. Penjelasan di bawahnya menerjemahkan angka menjadi tindakan; kandidat dengan confidence tinggi belum tentu boleh dibeli jika statusnya bukan actionable.",st["body"]),Spacer(1,4*mm),agent_table(report,st),Spacer(1,6*mm)]
    for a in report.get("agent_evaluations",[]):
        purpose,horizon,conclusion,agent_action,best=agent_explanation(a)
        agent_box=Table([[Paragraph(f"<b>{escape(a.get('agent_name') or a.get('agent_id','-'))}</b><br/><font color='#667085'>{escape(purpose)} - horizon {escape(horizon)}</font>",st["body"]),Paragraph(f"<b>Kesimpulan:</b> {escape(conclusion)}<br/><b>Tindakan:</b> {escape(agent_action)}<br/><b>Kandidat:</b> {escape(best)}",st["body"]) ]],colWidths=[52*mm,118*mm])
        agent_box.setStyle(TableStyle([("BOX",(0,0),(-1,-1),.5,LINE),("BACKGROUND",(0,0),(0,0),PALE),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),3.5*mm),("RIGHTPADDING",(0,0),(-1,-1),3.5*mm),("TOPPADDING",(0,0),(-1,-1),3*mm),("BOTTOMPADDING",(0,0),(-1,-1),3*mm)]))
        story += [KeepTogether([agent_box,Spacer(1,3*mm)])]
    story += [Paragraph("3. Rekomendasi Saham Daily",st["h1"]),Paragraph("Bagian ini sudah menggabungkan ticker yang direkomendasikan oleh lebih dari satu agent. Satu saham dapat memiliki beberapa trading plan karena horizon, stop, dan alokasi risiko setiap agent berbeda.",st["body"]),Spacer(1,3*mm),callout("URUTAN PENGGUNAAN", "1) Periksa status actionable. 2) Pilih plan sesuai horizon agent. 3) Tunggu entry, jangan mengejar harga. 4) Batalkan plan bila stop atau kondisi invalidasi terpenuhi. 5) Evaluasi ulang jika snapshot sudah stale.",st,BLUE),Spacer(1,5*mm)]
    setups=report.get("setups") or []
    if setups:
        for rank,items in enumerate(group_recommendations(setups)[:8],1): story.append(recommendation_card(items,rank,st))
    else: story.append(Paragraph("Tidak ada setup actionable pada evaluasi ini. Keputusan yang tepat adalah menunggu, bukan memaksakan entry.",st["body"]))
    story += [Spacer(1,4*mm),Paragraph("Yang tidak masuk rekomendasi",st["h2"]),Paragraph(f"Sebanyak {funnel.get('hard_rejects',0)} plan Buy/Accumulate ditolak oleh risk, portfolio, cooldown, atau aturan eksekusi. Saham yang hanya berstatus watch/research tidak ditampilkan sebagai rekomendasi. Ini mencegah confidence tinggi disalahartikan sebagai izin entry.",st["body"]),Spacer(1,5*mm),Paragraph("Catatan risiko",st["h2"]),Paragraph("Report ini adalah riset dan simulasi paper trading, bukan rekomendasi investasi personal. Validasi likuiditas, fraksi harga IDX, gap risk, biaya transaksi, dan batas konsentrasi sebelum simulasi entry. Jangan gunakan snapshot stale sebagai dasar order.",st["small"]),Spacer(1,3*mm),Paragraph(f"Source: stored engine snapshot {escape(report.get('report_id','-'))}. Generated {escape(report.get('generated_at','-'))}. Membuka atau mengunduh report tidak memicu scan ulang maupun request API eksternal.",st["small"])]
    doc.build(story,onFirstPage=page_decor,onLaterPages=page_decor)
    return buffer.getvalue()


def write_daily_report_pdf(report: dict, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True,exist_ok=True)
    output_path.write_bytes(build_daily_report_pdf(report))
    return output_path
