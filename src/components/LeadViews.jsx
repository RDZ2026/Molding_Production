import { useState, useEffect, useRef } from 'react';
import { gasCall } from '../api';
import { tx } from '../translations';
import { PRESSES } from '../constants';
import { todayStr, initPressData, initEHPressData, generatePassdown, generateEHPassdown, calcPressEH, useIsDesktop } from '../helpers';
import { PressCard, EHPressCard } from './PressCards';
import { UndoOverlay, CopyBtn } from './Common';

function shiftLabel(user) { return user && user.shift === 1 ? '1st Shift' : '2nd Shift'; }

export function LeadHomeScreen({ lang, user, parts, onSelect, onLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div><div className="header-title">nVent | {tx(lang, 'appName')}</div><div className="header-sub">{shiftLabel(user)} — {user.username}</div></div>
        <button className="header-btn" onClick={onLogout}>{tx(lang, 'logout')}</button>
      </div>
      <div className="scroll-area" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', marginBottom: 22 }}>{tx(lang, 'whatSubmit')}</div>
        {parts.length > 0 && (
          <div className="home-option-card" onClick={() => onSelect('prediction')}>
            <div className="home-option-icon">📊</div>
            <div><div className="home-option-title">{tx(lang, 'ehPrediction')}</div><div className="home-option-sub">{tx(lang, 'ehPredictionSub')}</div></div>
          </div>
        )}
        <div className="home-option-card" onClick={() => onSelect('report')}>
          <div className="home-option-icon">📋</div>
          <div><div className="home-option-title">{tx(lang, 'productionReport')}</div><div className="home-option-sub">{tx(lang, 'productionReportSub')}</div></div>
        </div>
        {parts.length === 0 && <div className="alert alert-info" style={{ marginTop: 10 }}>{tx(lang, 'noParts')}</div>}
      </div>
    </div>
  );
}

export function EHPredictionView({ lang, user, parts, ehGoal, onBack }) {
  const isDesktop = useIsDesktop();
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState(() => initEHPressData());
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [showWarn, setShowWarn] = useState(false);
  const [missing, setMissing] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [finalData, setFinalData] = useState(null);
  const [finalEH, setFinalEH] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  const upd = (pn, f, v) => setItems(prev => prev.map(p => p.pressNumber === pn ? { ...p, [f]: v } : p));
  const totalEH = items.reduce((s, p) => s + calcPressEH(p), 0);
  const pct = ehGoal > 0 ? Math.round((totalEH / ehGoal) * 100) : 0;
  const ehCol = totalEH >= ehGoal ? '#1e7e34' : totalEH >= ehGoal * 0.8 ? '#d6820a' : '#C8102E';

  const handleClick = () => {
    const m = items.filter(p => p.isRunning && !p.partId).map(p => p.pressNumber);
    if (m.length) { setMissing(m); setShowWarn(true); } else startCd();
  };
  const startCd = () => { setShowWarn(false); setError(''); setCountdown(5); setSubmitting(true); };
  const handleUndo = () => { clearInterval(timerRef.current); setSubmitting(false); };

  useEffect(() => {
    if (!submitting) return;
    let cnt = 5;
    timerRef.current = setInterval(() => { cnt -= 1; setCountdown(cnt); if (cnt <= 0) { clearInterval(timerRef.current); doSubmit(); } }, 1000);
    return () => clearInterval(timerRef.current);
  }, [submitting]);

  const doSubmit = async () => {
    const total = items.reduce((s, p) => s + calcPressEH(p), 0);
    try {
      const r = await gasCall('saveEHPrediction', { date, submittedBy: user.username, shift: user.shift || 2, pressData: items.map(p => ({ ...p })), totalEH: total, goalEH: ehGoal });
      if (r.success) { setFinalEH(total); setFinalData(items.map(p => ({ ...p }))); setSubmitting(false); setSubmitted(true); }
      else { setSubmitting(false); setError(r.error || tx(lang, 'errOccurred')); }
    } catch { setSubmitting(false); setError(tx(lang, 'networkErr')); }
  };

  if (submitted) {
    const passText = generateEHPassdown(finalData, finalEH, ehGoal, date, user.username);
    const fp = ehGoal > 0 ? Math.round((finalEH / ehGoal) * 100) : 0;
    return (
      <div className="success-panels">
        <div className="success-left">
          <div className="success-icon">{finalEH >= ehGoal ? '✅' : '📊'}</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: finalEH >= ehGoal ? '#1e7e34' : '#d6820a' }}>{tx(lang, 'predictionSubmitted')}</div>
          <div style={{ fontSize: 14, color: '#888' }}>Share with your supervisor on Teams</div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 42, fontWeight: 'bold', color: finalEH >= ehGoal ? '#1e7e34' : '#C8102E' }}>{finalEH.toFixed(1)}h</div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>of {ehGoal}h goal ({fp}%)</div>
          </div>
          <button className="btn btn-gray" style={{ maxWidth: 280, width: '100%', marginTop: 10 }} onClick={onBack}>{tx(lang, 'backToMenu')}</button>
        </div>
        <div className="success-right">
          <div className="passdown-label">Teams Copy / Paste</div>
          <pre className="passdown-pre">{passText}</pre>
          <CopyBtn text={passText} label={tx(lang, 'copyToTeams')} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div><div className="header-title">{tx(lang, 'ehPrediction')}</div><div className="header-sub">{user.username} — {shiftLabel(user)}</div></div>
        <button className="header-btn" onClick={onBack}>{tx(lang, 'back')}</button>
      </div>
      <div className="date-bar">
        <span className="date-bar-label">{tx(lang, 'reportDate')}</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div className="scroll-area">
        {error && <div className="alert alert-error">{error}</div>}
        <div className={isDesktop ? 'press-grid' : ''}>{items.map(p => <EHPressCard key={p.pressNumber} data={p} parts={parts} lang={lang} onChange={upd} />)}</div>
      </div>
      <div className="bottom-bar">
        <div className="eh-total-row">
          <span className="eh-total-label">{tx(lang, 'totalProjEH')}</span>
          <span className="eh-total-value" style={{ color: ehCol }}>{totalEH.toFixed(1)}h <span style={{ fontSize: 14, color: '#aaa', fontWeight: 'normal' }}>/ {ehGoal}h</span></span>
        </div>
        <button className="btn btn-red" onClick={handleClick}>{tx(lang, 'submitPrediction')}</button>
      </div>
      {submitting && <UndoOverlay countdown={countdown} lang={lang} onUndo={handleUndo} />}
      {showWarn && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowWarn(false)}>
          <div className="modal-sheet">
            <div className="modal-title">⚠ {tx(lang, 'missingPartsWarning')}</div>
            {missing.map(pn => <div key={pn} style={{ padding: '6px 0', borderBottom: '1px solid #f3f3f3', fontWeight: 'bold', fontSize: 14 }}>Press {pn}</div>)}
            <div style={{ fontSize: 14, color: '#888', margin: '14px 0' }}>{tx(lang, 'missingPartsSure')}</div>
            <div className="modal-footer">
              <button className="btn btn-gray" style={{ flex: 1 }} onClick={() => setShowWarn(false)}>{tx(lang, 'cancel')}</button>
              <button className="btn btn-red" style={{ flex: 1 }} onClick={startCd}>{tx(lang, 'submitPrediction')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductionReportView({ lang, user, operators, goals, parts, lastReport, onBack }) {
  const isDesktop = useIsDesktop();
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState(() => initPressData(goals, lastReport));
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [subData, setSubData] = useState(null);
  const [overallHit, setOverallHit] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const payloadRef = useRef(null);

  useEffect(() => {
    gasCall('getTodayPrediction').then(r => {
      if (!r.success || !r.prediction) return;
      const pd = r.prediction.pressData;
      setItems(prev => prev.map(item => {
        const pp = pd.find(x => x.pressNumber === item.pressNumber);
        if (pp && pp.partId && !item.partId) {
          return { ...item, partId: pp.partId, partNumber: pp.partNumber, partEhRate: pp.partEhRate, fromPrediction: true };
        }
        return item;
      }));
    }).catch(() => {});
  }, []);

  const handleChange = (pn, f, v) => setItems(prev => prev.map(p => p.pressNumber === pn ? { ...p, [f]: v } : p));

  const handleSubmit = () => {
    const run = items.filter(p => p.isRunning);
    const tG = run.reduce((s, p) => s + (parseInt(p.good, 10) || 0), 0);
    const tGl = run.reduce((s, p) => s + (parseInt(p.goal, 10) || 0), 0);
    payloadRef.current = { date, submittedBy: user.username, pressData: items.map(p => ({ ...p })) };
    setOverallHit(tGl > 0 ? Math.round((tG / tGl) * 100) : null);
    setError(''); setCountdown(5); setSubmitting(true);
  };

  useEffect(() => {
    if (!submitting) return;
    let cnt = 5;
    timerRef.current = setInterval(() => { cnt -= 1; setCountdown(cnt); if (cnt <= 0) { clearInterval(timerRef.current); doSubmit(); } }, 1000);
    return () => clearInterval(timerRef.current);
  }, [submitting]);

  const handleUndo = () => { clearInterval(timerRef.current); setSubmitting(false); };

  const doSubmit = async () => {
    const pl = payloadRef.current;
    try {
      pl.shift = user.shift || 2;
      const r = await gasCall('submitReport', pl);
      if (r.success) { setSubData(pl.pressData); setSubmitting(false); setSubmitted(true); }
      else { setSubmitting(false); setError(r.error || tx(lang, 'errOccurred')); }
    } catch { setSubmitting(false); setError(tx(lang, 'networkErr')); }
  };

  if (submitted) {
    const pt = generatePassdown(subData || []);
    return (
      <div className="success-panels">
        <div className="success-left">
          <div className="success-icon">✅</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#1e7e34' }}>{tx(lang, 'submitted')}</div>
          <div style={{ fontSize: 14, color: '#888' }}>{tx(lang, 'submittedSub')}</div>
          {overallHit !== null && overallHit >= 90 && (
            <div style={{ background: '#e8f5e9', border: '1.5px solid #a5d6a7', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 15, fontWeight: 'bold', color: '#1e7e34' }}>🏆 {tx(lang, 'congrats')} {user.username}!</div>
              <div style={{ fontSize: 13, color: '#2e7d32', marginTop: 3 }}>{tx(lang, 'congratsSub')} {overallHit}%</div>
            </div>
          )}
          <button className="btn btn-gray" style={{ maxWidth: 280, width: '100%', marginTop: 10 }} onClick={onBack}>{tx(lang, 'backToMenu')}</button>
        </div>
        <div className="success-right">
          <div className="passdown-label">{tx(lang, 'passdown')}</div>
          <pre className="passdown-pre">{pt}</pre>
          <CopyBtn text={pt} label={tx(lang, 'copyPassdown')} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div><div className="header-title">{tx(lang, 'productionReport')}</div><div className="header-sub">{shiftLabel(user)} — {user.username}</div></div>
        <button className="header-btn" onClick={onBack}>{tx(lang, 'back')}</button>
      </div>
      <div className="date-bar">
        <span className="date-bar-label">{tx(lang, 'reportDate')}</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div className="scroll-area">
        {error && <div className="alert alert-error">{error}</div>}
        <div className={isDesktop ? 'press-grid' : ''}>
          {items.map(p => <PressCard key={p.pressNumber} data={p} operators={operators} parts={parts} lang={lang} onChange={handleChange} />)}
        </div>
      </div>
      <div className="bottom-bar"><button className="btn btn-red" onClick={handleSubmit}>{tx(lang, 'submitReport')}</button></div>
      {submitting && <UndoOverlay countdown={countdown} lang={lang} onUndo={handleUndo} />}
    </div>
  );
}

export function LeadView({ lang, user, operators, goals, parts, ehGoal, lastReport, onLogout }) {
  const [mode, setMode] = useState('home');
  if (mode === 'home')       return <LeadHomeScreen lang={lang} user={user} parts={parts} onSelect={setMode} onLogout={onLogout} />;
  if (mode === 'prediction') return <EHPredictionView lang={lang} user={user} parts={parts} ehGoal={ehGoal} onBack={() => setMode('home')} />;
  if (mode === 'report')     return <ProductionReportView lang={lang} user={user} operators={operators} goals={goals} parts={parts} lastReport={lastReport} onBack={() => setMode('home')} />;
  return null;
}
