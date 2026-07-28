import { useState, useEffect } from 'react';
import { gasCall } from '../api';
import { tx } from '../translations';
import { txe } from '../translations';
import { formatDate, getDateRange, hitColor, getMolderWeekStatus, useIsDesktop, calcActualEH } from '../helpers';
import { PressBarChart } from './Charts';

export function ViewerView({ lang, user, onLogout }) {
  const [period, setPeriod] = useState('week');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    setLoading(true);
    gasCall('getReportsByRange', getDateRange(period))
      .then(r => { if (r.success) setReports(r.reports); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  const periods = [
    ['week', tx(lang, 'thisWeek')],
    ['lastWeek', tx(lang, 'lastWeek')],
    ['month', tx(lang, 'thisMonth')],
  ];

  // Calculate stats
  const opStats = {}, pressStats = {}, dayStats = {};
  let tG = 0, tGl = 0;
  reports.forEach(r => {
    const d = r.date;
    if (!dayStats[d]) dayStats[d] = { good: 0, goal: 0 };
    (r.pressData || []).forEach(p => {
      if (!p.isRunning) return;
      const g = parseInt(p.good || 0, 10), gl = parseInt(p.goal || 0, 10);
      if (!gl) return;
      tG += g; tGl += gl;
      dayStats[d].good += g; dayStats[d].goal += gl;
      if (!pressStats[p.pressNumber]) pressStats[p.pressNumber] = { good: 0, goal: 0 };
      pressStats[p.pressNumber].good += g; pressStats[p.pressNumber].goal += gl;
      if (p.operatorName) {
        if (!opStats[p.operatorName]) opStats[p.operatorName] = { good: 0, goal: 0 };
        opStats[p.operatorName].good += g; opStats[p.operatorName].goal += gl;
      }
    });
  });

  const overall = tGl > 0 ? Math.round((tG / tGl) * 100) : 0;
  const opR = Object.entries(opStats).map(([n, s]) => ({ name: n, hit: Math.round((s.good / s.goal) * 100) })).sort((a, b) => b.hit - a.hit);
  const prR = Object.entries(pressStats).map(([p, s]) => ({ press: p, hit: Math.round((s.good / s.goal) * 100) })).sort((a, b) => b.hit - a.hit);
  const dayR = Object.entries(dayStats).map(([date, d]) => ({ date, hit: d.goal > 0 ? Math.round((d.good / d.goal) * 100) : 0 })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="header-title">nVent | Molding Dashboard</div>
          <div className="header-sub">{txe(lang, 'viewerSub')} — {user.username}</div>
        </div>
        <button className="header-btn" onClick={onLogout}>{tx(lang, 'logout')}</button>
      </div>

      {/* Read-only badge */}
      <div style={{ background: '#fff8e1', borderBottom: '1px solid #fcd34d', padding: '6px 16px', fontSize: 12, color: '#92400e', fontWeight: 'bold', textAlign: 'center' }}>
        📋 {txe(lang, 'readOnly')} — View only, no changes can be made
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 60px' }}>
        {/* Period filter */}
        <div className="period-filter">
          {periods.map(([k, l]) => (
            <button key={k} className={`period-btn${period === k ? ' active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>

        {loading && <div className="loading-msg">{tx(lang, 'loading')}</div>}

        {!loading && !reports.length && (
          <div className="empty-msg" style={{ padding: 40 }}>{tx(lang, 'noWeekData')}</div>
        )}

        {!loading && reports.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-big" style={{ color: hitColor(overall) }}>{overall}%</div>
                <div className="stat-label">{tx(lang, 'overallHit')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-big">{tG.toLocaleString()}</div>
                <div className="stat-label">{tx(lang, 'totalGood')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-big">{reports.length}</div>
                <div className="stat-label">{tx(lang, 'reports')}</div>
              </div>
            </div>

            {/* Daily performance bars */}
            {dayR.length > 0 && (
              <>
                <div className="section-head">{tx(lang, 'dailyPerf')}</div>
                <div className="card">
                  {dayR.map(({ date, hit }) => (
                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 56, fontSize: 11, color: '#888', flexShrink: 0 }}>{formatDate(date)}</div>
                      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(hit, 100)}%`, background: hitColor(hit), borderRadius: 4 }}></div>
                      </div>
                      <div style={{ width: 38, fontSize: 12, fontWeight: 'bold', color: hitColor(hit), textAlign: 'right' }}>{hit}%</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Production vs Goal chart */}
            <div className="section-head">{tx(lang, 'prodVsGoal')}</div>
            <div className="card"><PressBarChart reports={reports} /></div>

            {/* Scorecards */}
            <div className={isDesktop ? 'scorecard-cols' : ''}>
              <div className="card" style={{ marginBottom: 11 }}>
                <div className="section-head">{tx(lang, 'opScorecard')}</div>
                {opR.map(o => (
                  <div key={o.name} className="scorecard-row">
                    <div className="scorecard-name">{o.name}</div>
                    <div className="scorecard-bar-wrap"><div className="scorecard-bar" style={{ width: `${Math.min(o.hit, 100)}%`, background: hitColor(o.hit) }}></div></div>
                    <div className="scorecard-pct" style={{ color: hitColor(o.hit) }}>{o.hit}%</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ marginBottom: 11 }}>
                <div className="section-head">{tx(lang, 'pressPerf')}</div>
                {prR.map(p => (
                  <div key={p.press} className="scorecard-row">
                    <div className="scorecard-name">{tx(lang, 'press')} {p.press}</div>
                    <div className="scorecard-bar-wrap"><div className="scorecard-bar" style={{ width: `${Math.min(p.hit, 100)}%`, background: hitColor(p.hit) }}></div></div>
                    <div className="scorecard-pct" style={{ color: hitColor(p.hit) }}>{p.hit}%</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
