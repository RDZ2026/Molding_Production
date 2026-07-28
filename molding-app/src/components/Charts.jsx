import { hitColor } from '../helpers';
import { PRESSES } from '../constants';

export function PressBarChart({ reports }) {
  const pd = {};
  PRESSES.forEach(p => { pd[p] = { good: 0, goal: 0 }; });
  reports.forEach(r => {
    (r.pressData || []).forEach(p => {
      if (!p.isRunning || !pd[p.pressNumber]) return;
      pd[p.pressNumber].good += parseInt(p.good || 0, 10);
      pd[p.pressNumber].goal += parseInt(p.goal || 0, 10);
    });
  });
  const maxVal = Math.max(...Object.values(pd).map(d => d.goal), 1);
  const cH = 160, bW = 32, gW = 48, lP = 30, tP = 24, bP = 22;
  const tW = lP + PRESSES.length * gW + 8;
  return (
    <div style={{ overflowX: 'auto', marginBottom: 4 }}>
      <svg viewBox={`0 0 ${tW} ${cH + tP + bP}`} style={{ minWidth: tW, width: '100%', height: cH + tP + bP, display: 'block' }}>
        {[0, 25, 50, 75, 100].map(pct => {
          const y = tP + cH - (pct / 100) * cH;
          return (
            <g key={pct}>
              <line x1={lP} y1={y} x2={tW - 4} y2={y} stroke="#f0f0f0" strokeWidth="1" />
              <text x={lP - 4} y={y + 4} fontSize="8" textAnchor="end" fill="#bbb">{pct}</text>
            </g>
          );
        })}
        {PRESSES.map((press, i) => {
          const d = pd[press];
          const hit = d.goal > 0 ? Math.round((d.good / d.goal) * 100) : 0;
          const gH = d.goal > 0 ? (d.goal / maxVal) * cH : 0;
          const goodH = d.goal > 0 ? Math.min((d.good / maxVal) * cH, cH) : 0;
          const x = lP + i * gW + (gW - bW) / 2;
          const c = hitColor(hit);
          return (
            <g key={press}>
              <rect x={x} y={tP + cH - gH} width={bW} height={gH} fill="none" stroke="#e0e0e0" strokeWidth="1.5" rx="2" />
              {goodH > 0 && <rect x={x} y={tP + cH - goodH} width={bW} height={goodH} fill={c} opacity="0.82" rx="2" />}
              {d.goal > 0 && <text x={x + bW / 2} y={tP + cH - gH - 5} fontSize="9" textAnchor="middle" fill={c} fontWeight="bold">{hit}%</text>}
              <text x={x + bW / 2} y={tP + cH + 14} fontSize="9" textAnchor="middle" fill="#888">{press}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 11, color: '#aaa', marginTop: 2 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 10, background: '#e0e0e0', border: '1.5px solid #ccc', marginRight: 4, verticalAlign: 'middle' }}></span>Goal</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 10, background: '#1e7e34', opacity: 0.8, marginRight: 4, verticalAlign: 'middle' }}></span>Good</span>
      </div>
    </div>
  );
}

export function MolderTrendChart({ nights }) {
  if (!nights.length) return null;
  const display = nights.slice(-30);
  const bW = 22, gW = 28, lP = 28, tP = 26, bP = 18, cH = 150;
  const tW = lP + display.length * gW + 8;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${tW} ${cH + tP + bP}`} style={{ minWidth: tW, width: '100%', height: cH + tP + bP, display: 'block' }}>
        <line x1={lP} y1={tP + cH * 0.05} x2={tW - 4} y2={tP + cH * 0.05} stroke="#e8f5e9" strokeWidth="1.5" strokeDasharray="4" />
        <line x1={lP} y1={tP + cH * 0.25} x2={tW - 4} y2={tP + cH * 0.25} stroke="#fde8ec" strokeWidth="1.5" strokeDasharray="4" />
        <text x={lP - 4} y={tP + cH * 0.05 + 4} fontSize="8" textAnchor="end" fill="#a5d6a7">95</text>
        <text x={lP - 4} y={tP + cH * 0.25 + 4} fontSize="8" textAnchor="end" fill="#f5bdc8">75</text>
        {display.map((n, i) => {
          const bH = (n.hit / 100) * cH;
          const x = lP + i * gW + (gW - bW) / 2;
          const c = hitColor(n.hit);
          return (
            <g key={n.date}>
              <rect x={x} y={tP + cH - bH} width={bW} height={bH} fill={c} opacity="0.8" rx="2" />
              {n.hasIssue && <text x={x + bW / 2} y={tP + cH - bH - 3} fontSize="9" textAnchor="middle" fill="#C8102E">⚠</text>}
              {i % 5 === 0 && <text x={x + bW / 2} y={tP + cH + 12} fontSize="7" textAnchor="middle" fill="#aaa">{n.date.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
