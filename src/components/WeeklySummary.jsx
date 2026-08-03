import { useState, useEffect } from 'react';
import { gasCall } from '../api';
import { PRESSES } from '../constants';
import { formatDate, getMondayStr, calcActualEH, hitColor } from '../helpers';
import { tx } from '../translations';

// ── Data helpers ──────────────────────────────────────────────
function groupByWeek(reports) {
  const map = {};
  reports.forEach(r => {
    const wk = getMondayStr(r.date);
    if (!map[wk]) map[wk] = [];
    map[wk].push(r);
  });
  return map;
}

function buildWeekStats(weekReports, allPreds, weekStart) {
  const pressMap = {};
  const opMap    = {};
  const dayMap   = {};
  let totalGood = 0, totalGoal = 0, totalScrap = 0, issueNights = 0;

  PRESSES.forEach(p => {
    pressMap[p] = { good:0, goal:0, scrap:0, nights:0, issueNights:0, notRunNights:0 };
  });

  weekReports.forEach(r => {
    let dayGood = 0, dayGoal = 0, dayHasIssue = false;
    (r.pressData || []).forEach(p => {
      const pn = p.pressNumber;
      if (!pressMap[pn]) pressMap[pn] = { good:0, goal:0, scrap:0, nights:0, issueNights:0, notRunNights:0 };
      if (!p.isRunning) {
        pressMap[pn].notRunNights++;
        return;
      }
      const g = parseInt(p.good||0,10), sc = parseInt(p.scrap||0,10), gl = parseInt(p.goal||0,10);
      pressMap[pn].good += g; pressMap[pn].scrap += sc; pressMap[pn].goal += gl;
      pressMap[pn].nights++;
      if (p.hasIssue) { pressMap[pn].issueNights++; dayHasIssue = true; }
      dayGood += g; dayGoal += gl;
      totalGood += g; totalGoal += gl; totalScrap += sc;
      if (p.operatorName) {
        if (!opMap[p.operatorName]) opMap[p.operatorName] = { good:0, goal:0, scrap:0, nights:0, issueNights:0, stamp:p.operatorStamp||'' };
        opMap[p.operatorName].good  += g; opMap[p.operatorName].scrap += sc;
        opMap[p.operatorName].goal  += gl; opMap[p.operatorName].nights++;
        if (p.hasIssue) opMap[p.operatorName].issueNights++;
      }
    });
    if (dayGoal > 0) {
      dayMap[r.date] = { good:dayGood, goal:dayGoal, hit:Math.round((dayGood/dayGoal)*100), hasIssue:dayHasIssue, submittedBy:r.submittedBy };
    }
    if (dayHasIssue) issueNights++;
  });

  // EH: match predictions to reports by date
  const ehByDate = {};
  allPreds.filter(p => getMondayStr(p.date) === weekStart).forEach(pred => {
    if (!ehByDate[pred.date]) ehByDate[pred.date] = { predEH:0, actualEH:0, predBy:'' };
    ehByDate[pred.date].predEH  += pred.totalEH || 0;
    ehByDate[pred.date].predBy   = pred.submittedBy;
  });
  weekReports.forEach(r => {
    const actual = calcActualEH(r.pressData);
    if (actual > 0) {
      if (!ehByDate[r.date]) ehByDate[r.date] = { predEH:0, actualEH:0, predBy:'' };
      ehByDate[r.date].actualEH += actual;
    }
  });

  const ehBreakdown    = Object.entries(ehByDate).map(([date,d])=>({date,...d})).sort((a,b)=>a.date.localeCompare(b.date));
  const totalPredEH    = ehBreakdown.reduce((s,d)=>s+d.predEH,0);
  const totalActualEH  = ehBreakdown.reduce((s,d)=>s+d.actualEH,0);

  return {
    totalGood, totalGoal, totalScrap,
    overallHit: totalGoal>0 ? Math.round((totalGood/totalGoal)*100) : null,
    issueNights, nightCount: weekReports.length,
    pressBreakdown: Object.entries(pressMap)
      .map(([press,d])=>({press:Number(press),...d, hit:d.goal>0?Math.round((d.good/d.goal)*100):null}))
      .filter(p=>p.nights>0||p.notRunNights>0)
      .sort((a,b)=>(b.hit||0)-(a.hit||0)),
    opBreakdown: Object.entries(opMap)
      .map(([name,d])=>({name,...d, hit:d.goal>0?Math.round((d.good/d.goal)*100):null}))
      .sort((a,b)=>(b.hit||0)-(a.hit||0)),
    dayBreakdown: Object.entries(dayMap).map(([date,d])=>({date,...d})).sort((a,b)=>a.date.localeCompare(b.date)),
    ehBreakdown, totalPredEH, totalActualEH,
    hasEH: totalPredEH>0||totalActualEH>0,
  };
}

// ── PDF export ────────────────────────────────────────────────
function generatePrintHTML(weekStart, stats, shiftLabel) {
  const hc = h => h>=90?'#1e7e34':h>=70?'#d6820a':'#C8102E';
  const fmt = h => h!=null?h+'%':'—';
  const weekEnd = new Date(weekStart+'T12:00:00'); weekEnd.setDate(weekEnd.getDate()+6);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd.toISOString().split('T')[0])}`;

  const dayRows = stats.dayBreakdown.map(d=>`
    <tr><td>${formatDate(d.date)}</td><td>${d.good.toLocaleString()}</td><td>${d.goal.toLocaleString()}</td>
    <td style="color:${hc(d.hit)};font-weight:bold">${d.hit}%</td>
    <td>${d.hasIssue?'⚠ Yes':'—'}</td><td style="font-size:11px;color:#666">${d.submittedBy||''}</td></tr>`).join('');

  const pressRows = stats.pressBreakdown.map(p=>`
    <tr><td>${p.press}</td><td>${p.nights}${p.notRunNights>0?' (+'+p.notRunNights+' NR)':''}</td>
    <td>${p.good.toLocaleString()}</td><td>${p.scrap.toLocaleString()}</td><td>${p.goal.toLocaleString()}</td>
    <td style="color:${p.hit!=null?hc(p.hit):'#aaa'};font-weight:bold">${fmt(p.hit)}</td>
    <td style="color:${p.issueNights>0?'#C8102E':'#aaa'}">${p.issueNights>0?p.issueNights:'—'}</td></tr>`).join('');

  const opRows = stats.opBreakdown.map(o=>`
    <tr><td>${o.name}${o.stamp?' <span style="color:#aaa;font-size:11px;">#'+o.stamp+'</span>':''}</td>
    <td>${o.nights}</td><td>${o.good.toLocaleString()}</td><td>${o.goal.toLocaleString()}</td>
    <td style="color:${o.hit!=null?hc(o.hit):'#aaa'};font-weight:bold">${fmt(o.hit)}</td>
    <td style="color:${o.issueNights>0?'#C8102E':'#aaa'}">${o.issueNights>0?o.issueNights:'—'}</td></tr>`).join('');

  let ehSection = '';
  if (stats.hasEH) {
    const ehVar = stats.totalActualEH - stats.totalPredEH;
    const ehPct = stats.totalPredEH>0 ? Math.round((ehVar/stats.totalPredEH)*100) : 0;
    const ehRows = stats.ehBreakdown.map(e => {
      const v = e.actualEH - e.predEH;
      const vp = e.predEH>0 ? Math.round((v/e.predEH)*100) : null;
      return `<tr><td>${formatDate(e.date)}</td>
        <td>${e.predEH>0?e.predEH.toFixed(2)+'h':'—'}</td>
        <td>${e.actualEH>0?e.actualEH.toFixed(2)+'h':'—'}</td>
        <td style="color:${v>=0?'#1e7e34':'#C8102E'};font-weight:bold">
          ${e.predEH>0&&e.actualEH>0?(v>=0?'+':'')+v.toFixed(2)+'h'+(vp!=null?' ('+vp+'%)':''):'—'}
        </td></tr>`;
    }).join('');
    ehSection = `
    <div class="section">
      <div class="section-title">Earned Hours — Predicted vs Actual</div>
      <div class="summary-boxes" style="margin-bottom:14px">
        <div class="box"><div class="box-num">${stats.totalPredEH.toFixed(1)}h</div><div class="box-label">Total Predicted</div></div>
        <div class="box"><div class="box-num">${stats.totalActualEH.toFixed(1)}h</div><div class="box-label">Total Actual</div></div>
        <div class="box"><div class="box-num" style="color:${ehVar>=0?'#1e7e34':'#C8102E'}">${ehVar>=0?'+':''}${ehVar.toFixed(1)}h</div>
          <div class="box-label">Variance (${ehPct>=0?'+':''}${ehPct}%)</div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Predicted</th><th>Actual</th><th>Variance</th></tr></thead>
      <tbody>${ehRows}</tbody></table>
    </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Weekly Report — ${weekLabel}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:28px;max-width:920px;margin:0 auto}
    .report-header{border-bottom:3px solid #C8102E;padding-bottom:14px;margin-bottom:22px}
    .report-header h1{font-size:21px;color:#C8102E;font-weight:bold}
    .report-header .sub{font-size:13px;color:#555;margin-top:5px}
    .section{margin-bottom:26px}
    .section-title{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;color:#C8102E;border-bottom:1px solid #eee;padding-bottom:5px;margin-bottom:12px}
    .summary-boxes{display:flex;gap:12px;flex-wrap:wrap}
    .box{flex:1;min-width:100px;background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:10px 14px;text-align:center}
    .box-num{font-size:21px;font-weight:bold;color:#333}
    .box-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.4px;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#f3f3f3;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:#666;border-bottom:2px solid #ddd}
    td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:nth-child(even) td{background:#fafafa}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
    @media print{body{padding:14px}@page{margin:1.4cm;size:letter}}
  </style></head><body>
  <div class="report-header">
    <h1>nVent Hoffman — Molding Department</h1>
    <div class="sub">Weekly Production Report &nbsp;·&nbsp; ${weekLabel}${shiftLabel?' &nbsp;·&nbsp; '+shiftLabel:''}</div>
  </div>
  <div class="section">
    <div class="section-title">Week Summary</div>
    <div class="summary-boxes">
      <div class="box"><div class="box-num" style="color:${stats.overallHit!=null?hc(stats.overallHit):'#aaa'}">${stats.overallHit!=null?stats.overallHit+'%':'—'}</div><div class="box-label">Overall Hit</div></div>
      <div class="box"><div class="box-num">${stats.totalGood.toLocaleString()}</div><div class="box-label">Parts Good</div></div>
      <div class="box"><div class="box-num">${stats.totalGoal.toLocaleString()}</div><div class="box-label">Goal</div></div>
      <div class="box"><div class="box-num">${stats.totalScrap.toLocaleString()}</div><div class="box-label">Scrap</div></div>
      <div class="box"><div class="box-num">${stats.nightCount}</div><div class="box-label">Nights</div></div>
      <div class="box"><div class="box-num" style="color:${stats.issueNights>0?'#C8102E':'#1e7e34'}">${stats.issueNights}</div><div class="box-label">Issue Nights</div></div>
    </div>
  </div>
  ${ehSection}
  <div class="section">
    <div class="section-title">Day by Day</div>
    <table><thead><tr><th>Date</th><th>Good</th><th>Goal</th><th>Hit %</th><th>Issues</th><th>Submitted By</th></tr></thead>
    <tbody>${dayRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Press Breakdown</div>
    <table><thead><tr><th>Press</th><th>Nights Run</th><th>Good</th><th>Scrap</th><th>Goal</th><th>Hit %</th><th>Issue Nights</th></tr></thead>
    <tbody>${pressRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Operator Scorecard</div>
    <table><thead><tr><th>Operator</th><th>Nights</th><th>Good</th><th>Goal</th><th>Hit %</th><th>Issue Nights</th></tr></thead>
    <tbody>${opRows}</tbody></table>
  </div>
  <div class="footer">
    <span>nVent Hoffman — Molding Department | Confidential</span>
    <span>Generated ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</span>
  </div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`;
}

// ── Week detail view ──────────────────────────────────────────
function WeekDetail({ weekStart, reports, allPreds, shiftLabel, lang, onBack }) {
  const stats = buildWeekStats(reports, allPreds, weekStart);
  const weekEnd = new Date(weekStart+'T12:00:00'); weekEnd.setDate(weekEnd.getDate()+6);
  const weekLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd.toISOString().split('T')[0])}`;
  const hc = hitColor;
  const fmt = h => h!=null?h+'%':'—';

  const exportPDF = () => {
    const html = generatePrintHTML(weekStart, stats, shiftLabel);
    const w = window.open('','_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <div className="app-header">
        <div>
          <div className="header-title">Week of {formatDate(weekStart)}</div>
          <div className="header-sub">{weekLabel}{shiftLabel?' · '+shiftLabel:''}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportPDF}
            style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.4)', color:'white', borderRadius:6, padding:'6px 12px', fontSize:13, cursor:'pointer', fontWeight:'bold' }}>
            ⬇ Export PDF
          </button>
          <button className="header-btn" onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="scroll-area">

        {/* Week summary boxes */}
        <div className="section-head">Week Summary</div>
        <div className="stat-row" style={{ flexWrap:'wrap' }}>
          {[
            [stats.overallHit!=null?stats.overallHit+'%':'—', 'Overall Hit', stats.overallHit!=null?hc(stats.overallHit):'#aaa'],
            [stats.totalGood.toLocaleString(), 'Parts Good', '#333'],
            [stats.totalGoal.toLocaleString(), 'Goal', '#333'],
            [stats.nightCount, 'Nights', '#333'],
            [stats.issueNights, 'Issue Nights', stats.issueNights>0?'#C8102E':'#1e7e34'],
            [stats.totalScrap.toLocaleString(), 'Scrap', '#555'],
          ].map(([val,label,color])=>(
            <div key={label} className="stat-card" style={{ minWidth:80 }}>
              <div className="stat-big" style={{ color }}>{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* EH comparison */}
        {stats.hasEH && (<>
          <div className="section-head">Earned Hours — Predicted vs Actual</div>
          <div className="stat-row" style={{ marginBottom:10 }}>
            {[
              [stats.totalPredEH.toFixed(1)+'h','Predicted','#1a4dc3'],
              [stats.totalActualEH.toFixed(1)+'h','Actual','#1e7e34'],
              [((stats.totalActualEH-stats.totalPredEH)>=0?'+':'')+(stats.totalActualEH-stats.totalPredEH).toFixed(1)+'h',
               'Variance', stats.totalActualEH>=stats.totalPredEH?'#1e7e34':'#C8102E'],
            ].map(([val,label,color])=>(
              <div key={label} className="stat-card">
                <div className="stat-big" style={{ color }}>{val}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflowX:'auto', marginBottom:11 }}>
            <table className="week-table">
              <thead><tr><th>Date</th><th>Predicted</th><th>Actual</th><th>Variance</th></tr></thead>
              <tbody>{stats.ehBreakdown.map(e=>{
                const v = e.actualEH-e.predEH;
                const vp = e.predEH>0?Math.round((v/e.predEH)*100):null;
                return (<tr key={e.date}>
                  <td>{formatDate(e.date)}</td>
                  <td>{e.predEH>0?e.predEH.toFixed(2)+'h':'—'}</td>
                  <td>{e.actualEH>0?e.actualEH.toFixed(2)+'h':'—'}</td>
                  <td style={{ fontWeight:'bold', color:v>=0?'#1e7e34':'#C8102E' }}>
                    {e.predEH>0&&e.actualEH>0?(v>=0?'+':'')+v.toFixed(2)+'h'+(vp!=null?' ('+vp+'%)':''):'—'}
                  </td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </>)}

        {/* Day by day */}
        <div className="section-head">Day by Day</div>
        <div className="card" style={{ marginBottom:11 }}>
          {stats.dayBreakdown.map(d=>(
            <div key={d.date} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ width:52, fontSize:11, color:'#888', flexShrink:0 }}>{formatDate(d.date)}</div>
              <div style={{ flex:1, background:'#f0f0f0', borderRadius:4, height:18, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min(d.hit,100)}%`, background:hc(d.hit), borderRadius:4 }}></div>
              </div>
              <div style={{ width:38, fontSize:12, fontWeight:'bold', color:hc(d.hit), textAlign:'right' }}>{d.hit}%</div>
              {d.hasIssue&&<span style={{ fontSize:11, color:'#C8102E' }}>⚠</span>}
            </div>
          ))}
        </div>

        {/* Press breakdown */}
        <div className="section-head">Press Breakdown</div>
        <div className="card" style={{ overflowX:'auto', marginBottom:11 }}>
          <table className="week-table">
            <thead><tr><th>Press</th><th>Nights</th><th>Good</th><th>Goal</th><th>Hit %</th><th>Scrap</th><th>Issues</th></tr></thead>
            <tbody>{stats.pressBreakdown.map(p=>(
              <tr key={p.press}>
                <td style={{ fontWeight:'bold' }}>{p.press}</td>
                <td>{p.nights}{p.notRunNights>0&&<span style={{ color:'#aaa', fontSize:10 }}> (+{p.notRunNights} NR)</span>}</td>
                <td>{p.good.toLocaleString()}</td>
                <td>{p.goal.toLocaleString()}</td>
                <td style={{ fontWeight:'bold', color:p.hit!=null?hc(p.hit):'#aaa' }}>{fmt(p.hit)}</td>
                <td>{p.scrap.toLocaleString()}</td>
                <td style={{ color:p.issueNights>0?'#C8102E':'#aaa' }}>{p.issueNights>0?p.issueNights:'—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Operator scorecard */}
        <div className="section-head">Operator Scorecard</div>
        <div className="card" style={{ overflowX:'auto', marginBottom:32 }}>
          <table className="week-table">
            <thead><tr><th>Operator</th><th>Nights</th><th>Good</th><th>Goal</th><th>Hit %</th><th>Issues</th></tr></thead>
            <tbody>{stats.opBreakdown.map(o=>(
              <tr key={o.name}>
                <td><span style={{ fontWeight:'bold' }}>{o.name}</span>{o.stamp&&<span style={{ color:'#aaa', fontSize:10 }}> #{o.stamp}</span>}</td>
                <td>{o.nights}</td>
                <td>{o.good.toLocaleString()}</td>
                <td>{o.goal.toLocaleString()}</td>
                <td style={{ fontWeight:'bold', color:o.hit!=null?hc(o.hit):'#aaa' }}>{fmt(o.hit)}</td>
                <td style={{ color:o.issueNights>0?'#C8102E':'#aaa' }}>{o.issueNights>0?o.issueNights:'—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

// ── Main Weekly Summary Tab ───────────────────────────────────
export function WeeklySummaryTab({ lang, user, shiftParam }) {
  const [allReports, setAllReports]   = useState([]);
  const [allPreds, setAllPreds]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);

  const shiftLabel = shiftParam?.shift ? (shiftParam.shift===1?'1st Shift':'2nd Shift') : null;

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      gasCall('getReports', shiftParam||{}),
      gasCall('getEHPredictions', shiftParam||{}),
    ]).then(([rr,pr]) => {
      if (rr.status==='fulfilled'&&rr.value?.success) setAllReports(rr.value.reports||[]);
      if (pr.status==='fulfilled'&&pr.value?.success) setAllPreds(pr.value.predictions||[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  if (loading) return <div className="loading-msg">{tx(lang,'loading')}</div>;

  const weekMap = groupByWeek(allReports);
  const weeks   = Object.keys(weekMap).sort().reverse();

  if (selected) {
    return <WeekDetail weekStart={selected} reports={weekMap[selected]||[]}
      allPreds={allPreds} shiftLabel={shiftLabel} lang={lang} onBack={()=>setSelected(null)} />;
  }

  if (weeks.length === 0) {
    return <div className="empty-msg" style={{ padding:40 }}>No reports yet. Nightly reports will appear here grouped by week.</div>;
  }

  return (
    <>
      {weeks.map(wk => {
        const reps  = weekMap[wk];
        const stats = buildWeekStats(reps, allPreds, wk);
        const weekEnd = new Date(wk+'T12:00:00'); weekEnd.setDate(weekEnd.getDate()+6);
        return (
          <div key={wk} className="card report-card" onClick={()=>setSelected(wk)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:'bold', fontSize:15 }}>
                  {formatDate(wk)} – {formatDate(weekEnd.toISOString().split('T')[0])}
                </div>
                <div style={{ fontSize:12, color:'#888', marginTop:3 }}>
                  {reps.length} night{reps.length!==1?'s':''} &nbsp;·&nbsp; {stats.totalGood.toLocaleString()} parts good
                  {stats.issueNights>0&&<span style={{ color:'#C8102E', marginLeft:8 }}>⚠ {stats.issueNights} issue night{stats.issueNights>1?'s':''}</span>}
                </div>
                {stats.hasEH&&(
                  <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                    EH: {stats.totalPredEH.toFixed(1)}h pred · {stats.totalActualEH.toFixed(1)}h actual
                  </div>
                )}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {stats.overallHit!=null&&(
                  <div style={{ fontSize:24, fontWeight:'bold', color:hitColor(stats.overallHit) }}>
                    {stats.overallHit}%
                  </div>
                )}
                <span style={{ color:'#C8102E', fontSize:20 }}>›</span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
