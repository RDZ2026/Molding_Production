import { useState, useEffect } from 'react';
import { gasCall } from '../api';
import { tx } from '../translations';
import { formatDate, formatDateTime, calcMolderStats, getMolderWeekStatus, getDateRange, hitColor } from '../helpers';
import { Stars, CopyBtn } from './Common';
import { Switch } from './Common';
import { MolderTrendChart } from './Charts';
import { AddNoteModal } from './Modals';

function MolderProfileDetail({ operator, lang, user, settings, onBack, onSettingsUpdate }) {
  const [period, setPeriod] = useState('week');
  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [visible, setVisible] = useState(settings[operator.name]?.profileVisible || false);

  useEffect(() => {
    setLoading(true);
    gasCall('getReportsByRange', getDateRange(period)).then(r => { if (r.success) setReports(r.reports); setLoading(false); }).catch(() => setLoading(false));
  }, [period]); // Note: molder profiles show all-time data for that operator regardless of shift

  useEffect(() => {
    gasCall('getMolderNotes', { operatorName: operator.name }).then(r => { if (r.success) setNotes(r.notes); }).catch(() => {});
  }, []);

  const toggleVis = async v => {
    setVisible(v);
    try { await gasCall('setMolderVisibility', { operatorName: operator.name, visible: v }); if (onSettingsUpdate) onSettingsUpdate(operator.name, { profileVisible: v }); } catch {}
  };
  const delNote = async id => {
    if (!window.confirm(tx(lang, 'confirmDel'))) return;
    try { const r = await gasCall('deleteMolderNote', { noteId: id }); if (r.success) setNotes(prev => prev.filter(n => n.id !== id)); } catch {}
  };

  const stats = calcMolderStats(operator.name, reports);
  const periods = [['week', tx(lang, 'thisWeek')], ['lastWeek', tx(lang, 'lastWeek')], ['month', tx(lang, 'thisMonth')], ['all', tx(lang, 'allTime')]];

  const exportText = () => {
    let t = `=== ${operator.name.toUpperCase()} ===\nStamp: #${operator.stampNumber} | Period: ${period} | Avg Hit: ${stats.avgHit !== null ? stats.avgHit + '%' : 'N/A'}\nNights: ${stats.totalNights} | Issue Rate: ${stats.issueRate}%\n\n`;
    if (stats.pressBreakdown.length) { t += '--- PRESS BREAKDOWN ---\n'; stats.pressBreakdown.forEach(p => { t += `Press ${p.press}: ${p.hit}% (${p.nights} nights${p.latestMold ? ', Mold: ' + p.latestMold : ''})\n`; }); }
    if (stats.weeklySummary.length) { t += '\n--- WEEKLY SUMMARY ---\n'; stats.weeklySummary.forEach(w => { t += `${tx(lang, 'weekOf')} ${w.week}: ${w.hit}% — ${w.good} good / ${w.goal} goal (${w.nights} nights)\n`; }); }
    if (notes.length) { t += '\n--- 1:1 NOTES ---\n'; notes.forEach(n => { t += `${formatDateTime(n.timestamp)} [${n.author}] ${'★'.repeat(n.rating || 0)}\n${n.note}\n\n`; }); }
    return t;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div><div className="header-title">{operator.name}</div><div className="header-sub">#{operator.stampNumber}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CopyBtn text={exportText()} label={tx(lang, 'exportProfile')} />
          <button className="header-btn" onClick={onBack}>{tx(lang, 'back')}</button>
        </div>
      </div>
      <div className="scroll-area">
        <div className="period-filter">{periods.map(([k, l]) => <button key={k} className={`period-btn${period === k ? ' active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        {loading && <div className="loading-msg">{tx(lang, 'loading')}</div>}
        {!loading && stats.totalNights === 0 && <div className="empty-msg" style={{ padding: 24 }}>{tx(lang, 'noMolderData')}</div>}
        {!loading && stats.totalNights > 0 && (
          <>
            {(stats.isConcern || stats.isOnFire) && (
              <div className={`alert-section ${stats.isConcern ? 'alert-section-concern' : 'alert-section-fire'}`} style={{ marginBottom: 11 }}>
                <div className="alert-section-title" style={{ color: stats.isConcern ? '#C8102E' : '#1e7e34' }}>
                  {stats.isConcern ? `⚠ ${tx(lang, 'concernFlag')} — below 75%` : `🏆 ${tx(lang, 'onFireFlag')} — 95%+ three nights in a row`}
                </div>
              </div>
            )}
            <div className="stat-row">
              <div className="stat-card"><div className="stat-big" style={{ color: stats.avgHit !== null ? hitColor(stats.avgHit) : '#aaa' }}>{stats.avgHit !== null ? stats.avgHit + '%' : '—'}</div><div className="stat-label">{tx(lang, 'avgHitRate')}</div></div>
              <div className="stat-card"><div className="stat-big">{stats.totalNights}</div><div className="stat-label">{tx(lang, 'nightsWorked')}</div></div>
              <div className="stat-card"><div className="stat-big" style={{ color: stats.issueRate > 20 ? '#C8102E' : stats.issueRate > 10 ? '#d6820a' : '#1e7e34' }}>{stats.issueRate}%</div><div className="stat-label">{tx(lang, 'issueRate')}</div></div>
            </div>
            <div className="section-head">{tx(lang, 'trendChart')}</div>
            <div className="card"><MolderTrendChart nights={stats.nights} /></div>
            {stats.pressBreakdown.length > 0 && (
              <><div className="section-head">{tx(lang, 'pressBrk')}</div>
              <div className="card">{stats.pressBreakdown.map(p => (
                <div key={p.press} className="scorecard-row">
                  <div><div className="scorecard-name">{tx(lang, 'press')} {p.press}</div><div style={{ fontSize: 11, color: '#aaa' }}>{p.nights} nights{p.latestMold ? ` · Mold: ${p.latestMold}` : ''}</div></div>
                  <div className="scorecard-bar-wrap"><div className="scorecard-bar" style={{ width: `${Math.min(p.hit, 100)}%`, background: hitColor(p.hit) }}></div></div>
                  <div className="scorecard-pct" style={{ color: hitColor(p.hit) }}>{p.hit}%</div>
                </div>
              ))}</div></>
            )}
            {stats.weeklySummary.length > 0 && (
              <><div className="section-head">{tx(lang, 'weeklySum')}</div>
              <div className="card" style={{ overflowX: 'auto' }}>
                <table className="week-table">
                  <thead><tr><th>{tx(lang, 'weekOf')}</th><th>Hit %</th><th>{tx(lang, 'good')}</th><th>{tx(lang, 'goal')}</th><th>Nights</th></tr></thead>
                  <tbody>{stats.weeklySummary.map(w => (<tr key={w.week}><td>{formatDate(w.week)}</td><td style={{ fontWeight: 'bold', color: hitColor(w.hit) }}>{w.hit}%</td><td>{w.good.toLocaleString()}</td><td>{w.goal.toLocaleString()}</td><td>{w.nights}</td></tr>))}</tbody>
                </table>
              </div></>
            )}
          </>
        )}
        <div className="card"><div className="toggle-row"><span className="toggle-text" style={{ fontSize: 13 }}>{tx(lang, 'visibleToMolder')}</span><Switch id="vis-sw" checked={visible} onChange={toggleVis} /></div></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>{tx(lang, 'oneOnOneNotes')}</div>
          <button className="btn-sm btn-sm-amber" onClick={() => setShowAdd(true)}>+ {tx(lang, 'addNote')}</button>
        </div>
        {notes.length === 0 && <div style={{ padding: 16, background: 'white', borderRadius: 10, marginBottom: 11, color: '#bbb', fontSize: 14 }}>{tx(lang, 'noNotes')}</div>}
        {notes.map(n => (
          <div key={n.id} className="note-card">
            <div className="note-meta">
              <div><span style={{ fontWeight: 'bold', color: '#555' }}>{n.author}</span><span style={{ margin: '0 6px' }}>·</span><span>{formatDateTime(n.timestamp)}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {n.rating > 0 && <Stars value={n.rating} readOnly />}
                <button className="btn-sm btn-sm-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => delNote(n.id)}>✕</button>
              </div>
            </div>
            <div className="note-text">{n.note}</div>
          </div>
        ))}
      </div>
      {showAdd && <AddNoteModal lang={lang} operatorName={operator.name} author={user.username} onSave={n => { setNotes(prev => [n, ...prev]); setShowAdd(false); }} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

export function MolderProfilesTab({ lang, operators, user }) {
  const [selected, setSelected] = useState(null);
  const [weekReports, setWeekReports] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([gasCall('getReportsByRange', getDateRange('week')), gasCall('getMolderSettings')])
      .then(([rr, sr]) => { if (rr.success) setWeekReports(rr.reports); if (sr.success) setSettings(sr.settings); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (selected) return <MolderProfileDetail operator={selected} lang={lang} user={user} settings={settings} onBack={() => setSelected(null)} onSettingsUpdate={(name, upd) => setSettings(prev => ({ ...prev, [name]: { ...prev[name], ...upd } }))} />;
  if (loading) return <div className="loading-msg">{tx(lang, 'loading')}</div>;

  const sorted = [...operators].map(op => {
    const s = getMolderWeekStatus(op.name, weekReports);
    const cfg = settings[op.name] || {};
    return { ...op, ...s, lastReviewed: cfg.lastReviewed };
  }).sort((a, b) => {
    if (a.isConcern && !b.isConcern) return -1; if (!a.isConcern && b.isConcern) return 1;
    if (a.isOnFire && !b.isOnFire) return -1; if (!a.isOnFire && b.isOnFire) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {/* Helper to render one operator card */}
      {(() => {
        const isAdmin = user?.role === 'admin';
        const shift1 = sorted.filter(op => op.shift === 1);
        const shift2 = sorted.filter(op => op.shift !== 1);

        const ShiftSection = ({ label, color, ops }) => ops.length === 0 ? null : (
          <>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: color, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 14px', background: color + '15', borderRadius: 8, marginBottom: 10, marginTop: 4 }}>
              {label} — {ops.length} operator{ops.length !== 1 ? 's' : ''}
            </div>
            {ops.map(op => (
              <div key={op.id} className="card report-card" onClick={() => setSelected(op)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {op.name}
                      {op.isOnFire && <span className="molder-badge badge-fire">🏆</span>}
                      {op.isConcern && <span className="molder-badge badge-concern">⚠</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>#{op.stampNumber} · {op.nightCount} {tx(lang, 'nightsWorked')} this week</div>
                    {op.lastReviewed && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{tx(lang, 'lastReviewed')}: {formatDateTime(op.lastReviewed)}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {op.weekAvg !== null && <div style={{ fontSize: 22, fontWeight: 'bold', color: hitColor(op.weekAvg) }}>{op.weekAvg}%</div>}
                    <span style={{ color: '#C8102E', fontSize: 20 }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        );

        if (isAdmin) {
          return (
            <>
              <ShiftSection label="1st Shift" color="#1a4dc3" ops={shift1} />
              {shift1.length > 0 && shift2.length > 0 && <div style={{ height: 8 }} />}
              <ShiftSection label="2nd Shift" color="#C8102E" ops={shift2} />
            </>
          );
        }
        return <ShiftSection label="" color="#C8102E" ops={sorted} />;
      })()}
    </>
  );
}
