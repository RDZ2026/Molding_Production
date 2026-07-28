import { useState, useEffect } from 'react';
import { gasCall } from '../api';
import { txe } from '../translations';
import { tx } from '../translations';
import { PRESSES, ROLES } from '../constants';
import { formatDate, formatDateTime, generatePassdown, calcHit, calcActualEH, getDateRange, getMolderWeekStatus, hitColor, useIsDesktop } from '../helpers';
import { PressBarChart } from './Charts';
import { CopyBtn } from './Common';
import { MolderProfilesTab } from './MolderViews';
import { UserModal, OperatorModal, PartModal } from './Modals';
import { EHPredictionView, ProductionReportView } from './LeadViews';
import { PartSearch } from './Common';
import { calcPressEH, generateEHPassdown } from '../helpers';

// ── EH Summary Tab ────────────────────────────────────────────
function EHSummaryTab({ lang }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gasCall('getEHSummary').then(r => { if (r.success) setSummary(r.summary); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-msg">{tx(lang, 'loading')}</div>;
  if (!summary.length) return <div className="empty-msg" style={{ padding: 32 }}>No EH data yet. Submit a prediction and a production report to see the comparison.</div>;

  return (
    <>
      {summary.map(({ date, prediction, report }) => {
        const predEH = prediction ? prediction.totalEH : null;
        const actualEH = report ? calcActualEH(report.pressData) : null;
        let variance = null, variancePct = null;
        if (predEH !== null && actualEH !== null && predEH > 0) {
          variance = actualEH - predEH; variancePct = Math.round((variance / predEH) * 100);
        }
        const varColor = variance === null ? '#888' : variance >= 0 ? '#1e7e34' : '#C8102E';
        const hasActualParts = report && (report.pressData || []).some(p => p.isRunning && p.partEhRate && p.good);
        return (
          <div key={date} className="card" style={{ marginBottom: 11 }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>{formatDate(date)}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#eff3ff', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, fontWeight: 'bold' }}>Predicted</div>
                {predEH !== null ? <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1a4dc3' }}>{predEH.toFixed(1)}h</div> : <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic', marginTop: 4 }}>No prediction</div>}
                {prediction && <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{prediction.submittedBy}</div>}
              </div>
              <div style={{ flex: 1, background: actualEH !== null ? '#e8f5e9' : '#f5f5f5', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4, fontWeight: 'bold' }}>Actual</div>
                {actualEH !== null ? <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1e7e34' }}>{actualEH.toFixed(1)}h</div> : <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic', marginTop: 4 }}>{!report ? 'No report yet' : !hasActualParts ? 'No parts on report' : ''}</div>}
                {report && actualEH !== null && <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{report.submittedBy}</div>}
              </div>
            </div>
            {variance !== null && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#f9f9f9', borderRadius: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#888', fontWeight: 'bold' }}>Variance</span>
                <span style={{ fontWeight: 'bold', fontSize: 15, color: varColor }}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}h &nbsp; ({variancePct >= 0 ? '+' : ''}{variancePct}%)</span>
              </div>
            )}
            {prediction && !report && <div style={{ marginTop: 6, fontSize: 12, color: '#bbb', textAlign: 'center' }}>Production report not submitted yet</div>}
            {report && !prediction && <div style={{ marginTop: 6, fontSize: 12, color: '#bbb', textAlign: 'center' }}>No EH prediction was submitted for this night</div>}
          </div>
        );
      })}
    </>
  );
}

// ── EH Prediction Detail ──────────────────────────────────────
function EHPredictionDetail({ prediction, parts, lang, ehGoal, onBack, onDelete }) {
  const [pd, setPd] = useState(prediction.pressData.map(p => ({ ...p })));
  const [editDate, setEditDate] = useState(prediction.date || '');
  const [showDateEdit, setShowDateEdit] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const upd = (pn, f, v) => setPd(prev => prev.map(p => p.pressNumber === pn ? { ...p, [f]: v } : p));
  const handlePart = (pn, part) => { upd(pn, 'partId', part ? part.id : ''); upd(pn, 'partNumber', part ? part.partNumber : ''); upd(pn, 'partDescription', part ? part.description : ''); upd(pn, 'partEhRate', part ? part.ehRate : 0); };
  const totalEH = pd.reduce((s, p) => s + calcPressEH(p), 0);
  const pct = prediction.goalEH > 0 ? Math.round((totalEH / prediction.goalEH) * 100) : 0;
  const save = async () => {
    setSaving(true); setMsg('');
    try { const r = await gasCall('updateEHPrediction', { id: prediction.id, pressData: pd, totalEH }); if (r.success) setMsg('Saved.'); else setMsg('Error: ' + (r.error || '?')); } catch { setMsg(tx(lang, 'networkErr')); }
    setSaving(false);
  };
  const savePredDate = async () => {
    if (!editDate) return; setSavingDate(true);
    try { const r = await gasCall('updatePredictionDate', { id: prediction.id, date: editDate }); if (r.success) { setShowDateEdit(false); setMsg(txe(lang, 'predDateUpdated')); } else setMsg('Error: ' + (r.error || '?')); } catch { setMsg(tx(lang, 'networkErr')); }
    setSavingDate(false);
  };
  const passText = generateEHPassdown(pd, totalEH, prediction.goalEH || ehGoal, prediction.date, prediction.submittedBy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div>
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{tx(lang, 'ehPrediction')}</span>
            {showDateEdit ? (<><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ fontSize: 13, padding: '3px 6px', border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 5, background: 'rgba(255,255,255,0.15)', color: 'white', width: 140 }} /><button onClick={savePredDate} disabled={savingDate} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>{savingDate ? '...' : 'Save'}</button><button onClick={() => setShowDateEdit(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12 }}>✕</button></>) : (<><span>— {formatDate(prediction.date)}</span><button onClick={() => setShowDateEdit(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>✏</button></>)}
          </div>
          <div className="header-sub">{prediction.submittedBy}</div>
        </div>
        <button className="header-btn" onClick={onBack}>{tx(lang, 'back')}</button>
      </div>
      <div className="scroll-area">
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="stat-row" style={{ marginBottom: 11 }}>
          <div className="stat-card"><div className="stat-big" style={{ color: hitColor(pct) }}>{totalEH.toFixed(1)}h</div><div className="stat-label">{tx(lang, 'totalProjEH')}</div></div>
          <div className="stat-card"><div className="stat-big">{prediction.goalEH || ehGoal}h</div><div className="stat-label">{tx(lang, 'ehGoalShort')}</div></div>
          <div className="stat-card"><div className="stat-big" style={{ color: hitColor(pct) }}>{pct}%</div><div className="stat-label">vs Goal</div></div>
        </div>
        <div className="card" style={{ marginBottom: 11 }}><CopyBtn text={passText} label={tx(lang, 'copyToTeams')} /></div>
        <pre className="passdown-pre" style={{ marginBottom: 11 }}>{passText}</pre>
        {pd.map(p => {
          const selPart = parts.find(pt => pt.id === p.partId) || null;
          const proj = calcPressEH(p);
          return (
            <div key={p.pressNumber} className="card press-card" style={{ borderLeftColor: p.isRunning ? (p.partId ? '#28a745' : '#f59e0b') : '#999', borderLeftWidth: 5 }}>
              <div className="press-card-top">
                <div className="press-num">{tx(lang, 'press')} {p.pressNumber}</div>
                {p.isRunning && proj > 0 && <span style={{ fontWeight: 'bold', color: '#1e7e34' }}>{proj.toFixed(2)}h</span>}
                {!p.isRunning && <span className="press-badge badge-stopped">{tx(lang, 'stopped')}</span>}
              </div>
              {p.isRunning && (
                <>
                  <div className="field"><label className="field-label">{tx(lang, 'part')}</label><PartSearch parts={parts} selectedPart={selPart} onSelect={pt => handlePart(p.pressNumber, pt)} placeholder={tx(lang, 'searchPart')} /></div>
                  <div className="field"><label className="field-label">{tx(lang, 'estimatedQty')}</label><input type="text" inputMode="numeric" value={p.estimatedQty || ''} placeholder="0" onChange={e => upd(p.pressNumber, 'estimatedQty', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                </>
              )}
              {!p.isRunning && <div style={{ fontSize: 14, color: '#777' }}>{p.notRunningReason || '—'}</div>}
            </div>
          );
        })}
        <button className="btn btn-red" style={{ marginTop: 12 }} onClick={save} disabled={saving}>{saving ? tx(lang, 'saving') : tx(lang, 'save')}</button>
        <button className="btn-sm btn-sm-danger" style={{ width: '100%', padding: '11px', textAlign: 'center', borderRadius: 8, marginTop: 10, display: 'block' }}
          onClick={() => { if (window.confirm('Delete this EH prediction? This cannot be undone.')) onDelete(prediction.id); }}>
          Delete Prediction
        </button>
      </div>
    </div>
  );
}

// ── Report Detail ─────────────────────────────────────────────
function ReportDetail({ report, lang, onBack, onArchive, operators, parts }) {
  const [resending, setResending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editingPress, setEditingPress] = useState(null);
  const [moldInput, setMoldInput] = useState('');
  const [localData, setLocalData] = useState(report.pressData || []);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDate, setEditDate] = useState(report.date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [showDateEdit, setShowDateEdit] = useState(false);
  const isDesktop = useIsDesktop();

  const resend = async () => { setResending(true); setMsg(''); try { const r = await gasCall('resendEmail', { reportId: report.id }); setMsg(r.success ? 'Email re-sent.' : 'Error: ' + (r.error || '?')); } catch { setMsg(tx(lang, 'networkErr')); } setResending(false); };
  const handleArchive = async () => { if (!window.confirm(tx(lang, 'confirmArchive'))) return; setArchiving(true); try { const r = await gasCall('archiveReport', { reportId: report.id }); if (r.success) onArchive(report.id); } catch { setMsg(tx(lang, 'networkErr')); } setArchiving(false); };
  const saveMold = async resendEmail => {
    const pn = editingPress;
    try { const r = await gasCall('editReport', { reportId: report.id, pressNumber: pn, updates: { moldNumber: moldInput }, resendEmail }); if (r.success) { setLocalData(prev => prev.map(p => String(p.pressNumber) === String(pn) ? { ...p, moldNumber: moldInput } : p)); setMsg(resendEmail ? 'Saved and re-sent.' : 'Saved.'); } else setMsg('Error: ' + (r.error || '?')); } catch { setMsg(tx(lang, 'networkErr')); }
    setEditingPress(null);
  };

  const startEdit = () => { setEditItems(localData.map(p => ({ ...p }))); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setEditItems([]); };
  const handleEditChange = (pressNum, field, val) => setEditItems(prev => prev.map(p => p.pressNumber === pressNum ? { ...p, [field]: val } : p));
  const handleEditOp = (pressNum, opId, opsList) => { const op = opsList.find(o => o.id === opId); handleEditChange(pressNum, 'operatorId', opId); handleEditChange(pressNum, 'operatorName', op ? op.name : ''); handleEditChange(pressNum, 'operatorStamp', op ? op.stampNumber : ''); };

  const saveFullEdit = async () => {
    setSavingEdit(true); setMsg('');
    try {
      const r = await gasCall('fullEditReport', { reportId: report.id, pressData: editItems });
      if (r.success) {
        setLocalData(editItems.map(p => ({ ...p }))); setEditMode(false);
        const resend = window.confirm(txe(lang, 'resendAfterEdit'));
        if (resend) {
          await gasCall('fullEditReport', { reportId: report.id, pressData: editItems, resendEmail: true });
          setMsg('Report updated and email re-sent.');
        } else { setMsg(txe(lang, 'reportEdited')); }
      } else setMsg('Error: ' + (r.error || '?'));
    } catch { setMsg(tx(lang, 'networkErr')); }
    setSavingEdit(false);
  };

  const saveDate = async () => {
    if (!editDate) return; setSavingDate(true);
    try {
      const r = await gasCall('updateReportDate', { reportId: report.id, date: editDate });
      if (r.success) { setShowDateEdit(false); setMsg(txe(lang, 'dateUpdated')); }
      else setMsg('Error: ' + (r.error || '?'));
    } catch { setMsg(tx(lang, 'networkErr')); }
    setSavingDate(false);
  };

  // If in full edit mode, show editable press cards
  if (editMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div className="app-header">
          <div><div className="header-title">{txe(lang, 'editReport')}</div><div className="header-sub">{formatDate(report.date)}</div></div>
          <button className="header-btn" onClick={cancelEdit}>{txe(lang, 'cancelEdit')}</button>
        </div>
        <div className="scroll-area">
          {msg && <div className="alert alert-error">{msg}</div>}
          <div className="alert alert-info" style={{ marginBottom: 12 }}>Editing all fields. Press running status, operator, counts, and notes are all adjustable.</div>
          <div className={isDesktop ? 'press-grid' : ''}>
            {editItems.map(p => (
              <div key={p.pressNumber} className={`card press-card ${!p.isRunning ? 'is-stopped' : p.hasIssue ? 'is-running has-issue' : 'is-running'}`}>
                <div className="press-card-top">
                  <div className="press-num">{tx(lang, 'press')} {p.pressNumber}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`press-badge ${!p.isRunning ? 'badge-stopped' : p.hasIssue ? 'badge-issue' : 'badge-ok'}`}>{!p.isRunning ? tx(lang, 'stopped') : p.hasIssue ? tx(lang, 'issue') : tx(lang, 'ok')}</span>
                    <div className="nr-toggle-wrap"><span className="nr-toggle-label">{tx(lang, 'notRunning')}</span>
                      <label className="sw" htmlFor={`edit-nr-${p.pressNumber}`}><input id={`edit-nr-${p.pressNumber}`} type="checkbox" checked={!p.isRunning} onChange={e => handleEditChange(p.pressNumber, 'isRunning', !e.target.checked)} /><span className="sw-track"></span></label>
                    </div>
                  </div>
                </div>
                <div className="field"><label className="field-label">{tx(lang, 'operator')}</label>
                  <select value={p.operatorId || ''} onChange={e => handleEditOp(p.pressNumber, e.target.value, operators)}>
                    <option value="">{tx(lang, 'selectOp')}</option>
                    {operators.map(op => <option key={op.id} value={op.id}>{op.name} — #{op.stampNumber}</option>)}
                  </select>
                </div>
                {p.isRunning ? (<>
                  <div className="three-col" style={{ marginBottom: 8 }}>
                    <div><div className="col-label">{tx(lang, 'good')}</div><input type="text" inputMode="numeric" value={p.good || ''} placeholder="0" onChange={e => handleEditChange(p.pressNumber, 'good', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <div><div className="col-label">{tx(lang, 'scrap')}</div><input type="text" inputMode="numeric" value={p.scrap || ''} placeholder="0" onChange={e => handleEditChange(p.pressNumber, 'scrap', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <div><div className="col-label">{tx(lang, 'goal')}</div><input type="text" inputMode="numeric" value={p.goal || ''} onChange={e => handleEditChange(p.pressNumber, 'goal', e.target.value.replace(/[^0-9]/g, ''))} /></div>
                  </div>
                  <div className="toggle-row"><span className="toggle-text">⚠ {tx(lang, 'hadIssue')}</span>
                    <label className="sw" htmlFor={`edit-iss-${p.pressNumber}`}><input id={`edit-iss-${p.pressNumber}`} type="checkbox" checked={!!p.hasIssue} onChange={e => handleEditChange(p.pressNumber, 'hasIssue', e.target.checked)} /><span className="sw-track"></span></label>
                  </div>
                  <div className="field" style={{ marginTop: 8 }}><label className="field-label">{tx(lang, 'notes')}</label><textarea value={p.notes || ''} placeholder={tx(lang, 'notesHint')} onChange={e => handleEditChange(p.pressNumber, 'notes', e.target.value)} /></div>
                </>) : (
                  <div className="field"><label className="field-label">{tx(lang, 'reason')}</label>
                    <select value={p.notRunningReason || ''} onChange={e => handleEditChange(p.pressNumber, 'notRunningReason', e.target.value)}>
                      <option value="">{tx(lang, 'selectReason')}</option>
                      {['No Operator','Press Breakdown','Scheduled to Not Run','Mold Change / Tooling Change','Material Shortage','Waiting on Maintenance','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="bottom-bar">
          <button className="btn btn-red" onClick={saveFullEdit} disabled={savingEdit}>{savingEdit ? tx(lang, 'saving') : txe(lang, 'saveReport')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="app-header">
        <div>
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showDateEdit ? (
              <><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ fontSize: 14, padding: '3px 6px', border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 5, background: 'rgba(255,255,255,0.15)', color: 'white', width: 140 }} /><button onClick={saveDate} disabled={savingDate} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>{savingDate ? '...' : 'Save'}</button><button onClick={() => setShowDateEdit(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12 }}>✕</button></>
            ) : (
              <><span>{formatDate(report.date)}</span><button onClick={() => setShowDateEdit(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12 }}>✏</button></>
            )}
          </div>
          <div className="header-sub">{tx(lang, 'submittedBy')}: {report.submittedBy} · {formatDateTime(report.timestamp)}</div>
        </div>
        <button className="header-btn" onClick={onBack}>{tx(lang, 'back')}</button>
      </div>
      <div className="scroll-area">
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="card" style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={resend} disabled={resending}>{resending ? '...' : tx(lang, 'resend')}</button>
            <CopyBtn text={generatePassdown(localData)} label={tx(lang, 'copyPassdown')} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-sm btn-sm-amber" style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8 }} onClick={startEdit}>✏ {txe(lang, 'editReport')}</button>
            <button className="btn-sm btn-sm-danger" style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: 8 }} onClick={handleArchive} disabled={archiving}>{archiving ? '...' : tx(lang, 'archiveReport')}</button>
          </div>
          <pre className="passdown-pre" style={{ marginTop: 10, fontSize: 11 }}>{generatePassdown(localData)}</pre>
        </div>
        {localData.map(p => {
          const hit = p.isRunning ? calcHit(p.good, p.goal) : null;
          const isEd = editingPress === p.pressNumber || editingPress === String(p.pressNumber);
          let cls = 'card press-card ' + (p.isRunning ? (p.hasIssue ? 'is-running has-issue' : 'is-running') : 'is-stopped');
          return (
            <div key={p.pressNumber} className={cls}>
              <div className="press-card-top">
                <div className="press-num">{tx(lang, 'press')} {p.pressNumber}</div>
                <span className={`press-badge ${!p.isRunning ? 'badge-stopped' : p.hasIssue ? 'badge-issue' : 'badge-ok'}`}>{!p.isRunning ? tx(lang, 'stopped') : p.hasIssue ? tx(lang, 'issue') : tx(lang, 'ok')}</span>
              </div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{p.operatorName ? `${p.operatorName} — #${p.operatorStamp}` : '—'}</div>
              {p.partNumber && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Part: {p.partNumber}</div>}
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>
                {tx(lang, 'moldNo')}: {p.moldNumber || '—'}
                <button onClick={() => { setEditingPress(p.pressNumber); setMoldInput(p.moldNumber || ''); }} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#C8102E', fontSize: 11, cursor: 'pointer', fontWeight: 'bold' }}>{tx(lang, 'editMold')}</button>
              </div>
              {isEd && <div className="mold-edit-row"><input className="mold-edit-input" type="text" value={moldInput} placeholder="e.g. M-452-A" onChange={e => setMoldInput(e.target.value)} /><button className="btn-sm btn-sm-gray" onClick={() => saveMold(false)}>{tx(lang, 'saveQuiet')}</button><button className="btn-sm btn-sm-green" onClick={() => saveMold(true)}>{tx(lang, 'saveAndResend')}</button></div>}
              {p.isRunning ? (
                <div className="three-col" style={{ marginTop: 8, marginBottom: 4 }}>
                  {[[tx(lang, 'good'), p.good || 0], [tx(lang, 'scrap'), p.scrap || 0], [tx(lang, 'hitPct'), hit !== null ? hit + '%' : '—']].map(([label, val], i) => (
                    <div key={label} style={{ textAlign: 'center' }}><div className="col-label">{label}</div><div style={{ fontSize: 20, fontWeight: 'bold', color: i === 2 && hit !== null ? hitColor(hit) : '#1a1a1a' }}>{val}</div></div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 14, color: '#777', marginTop: 4 }}>{p.notRunningReason || '—'}</div>}
              {p.notes && <div style={{ fontSize: 13, fontStyle: 'italic', color: '#555', marginTop: 8, padding: '7px 10px', background: '#f8f8f8', borderRadius: 6 }}>"{p.notes}"</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ lang, operators }) {
  const [period, setPeriod] = useState('week');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const isDesktop = useIsDesktop();

  useEffect(() => { setLoading(true); gasCall('getReportsByRange', getDateRange(period)).then(r => { if (r.success) setReports(r.reports); setLoading(false); }).catch(() => setLoading(false)); }, [period]);

  const periods = [['week', tx(lang, 'thisWeek')], ['lastWeek', tx(lang, 'lastWeek')], ['month', tx(lang, 'thisMonth')]];
  const molderAlerts = reports.length && operators.length ? operators.map(op => ({ ...op, ...getMolderWeekStatus(op.name, reports) })).filter(o => o.isConcern || o.isOnFire) : [];
  const concerns = molderAlerts.filter(o => o.isConcern);
  const onFire = molderAlerts.filter(o => o.isOnFire && !o.isConcern);
  const pf = <div className="period-filter">{periods.map(([k, l]) => <button key={k} className={`period-btn${period === k ? ' active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}</div>;

  if (loading) return <>{pf}<div className="loading-msg">{tx(lang, 'loading')}</div></>;
  if (!reports.length) return <>{pf}<div className="empty-msg" style={{ padding: 40 }}>{tx(lang, 'noWeekData')}</div></>;

  const opStats = {}, pressStats = {}, dayStats = {};
  let tG = 0, tGl = 0;
  reports.forEach(r => {
    const d = r.date; if (!dayStats[d]) dayStats[d] = { good: 0, goal: 0 };
    (r.pressData || []).forEach(p => {
      if (!p.isRunning) return;
      const g = parseInt(p.good || 0, 10), gl = parseInt(p.goal || 0, 10); if (!gl) return;
      tG += g; tGl += gl; dayStats[d].good += g; dayStats[d].goal += gl;
      if (!pressStats[p.pressNumber]) pressStats[p.pressNumber] = { good: 0, goal: 0 };
      pressStats[p.pressNumber].good += g; pressStats[p.pressNumber].goal += gl;
      if (p.operatorName) { if (!opStats[p.operatorName]) opStats[p.operatorName] = { good: 0, goal: 0 }; opStats[p.operatorName].good += g; opStats[p.operatorName].goal += gl; }
    });
  });
  const overall = tGl > 0 ? Math.round((tG / tGl) * 100) : 0;
  const opR = Object.entries(opStats).map(([n, s]) => ({ name: n, hit: Math.round((s.good / s.goal) * 100) })).sort((a, b) => b.hit - a.hit);
  const prR = Object.entries(pressStats).map(([p, s]) => ({ press: p, hit: Math.round((s.good / s.goal) * 100) })).sort((a, b) => b.hit - a.hit);
  const dayR = Object.entries(dayStats).map(([date, d]) => ({ date, hit: d.goal > 0 ? Math.round((d.good / d.goal) * 100) : 0 })).sort((a, b) => b.hit - a.hit);
  const best = dayR[0], worst = dayR[dayR.length - 1];

  return (
    <>
      {concerns.length > 0 && <div className="alert-section alert-section-concern"><div className="alert-section-title" style={{ color: '#C8102E' }}>⚠ {tx(lang, 'concernFlag')} — below 75%</div><div className="alert-names" style={{ color: '#C8102E' }}>{concerns.map(o => o.name).join(', ')}</div></div>}
      {onFire.length > 0 && <div className="alert-section alert-section-fire"><div className="alert-section-title" style={{ color: '#1e7e34' }}>🏆 {tx(lang, 'onFireFlag')} — 95%+ three nights in a row</div><div className="alert-names" style={{ color: '#1e7e34' }}>{onFire.map(o => o.name).join(', ')}</div></div>}
      {pf}
      <div className="stat-row">
        <div className="stat-card"><div className="stat-big" style={{ color: hitColor(overall) }}>{overall}%</div><div className="stat-label">{tx(lang, 'overallHit')}</div></div>
        <div className="stat-card"><div className="stat-big">{tG.toLocaleString()}</div><div className="stat-label">{tx(lang, 'totalGood')}</div></div>
        <div className="stat-card"><div className="stat-big">{reports.length}</div><div className="stat-label">{tx(lang, 'reports')}</div></div>
      </div>
      {dayR.length > 1 && <div className="stat-row"><div className="stat-card"><div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>🏆 {tx(lang, 'bestDay')}</div><div style={{ fontSize: 22, fontWeight: 'bold', color: '#1e7e34' }}>{best.hit}%</div><div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{formatDate(best.date)}</div></div><div className="stat-card"><div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>📉 {tx(lang, 'worstDay')}</div><div style={{ fontSize: 22, fontWeight: 'bold', color: '#C8102E' }}>{worst.hit}%</div><div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{formatDate(worst.date)}</div></div></div>}
      <div className="section-head">{tx(lang, 'prodVsGoal')}</div><div className="card"><PressBarChart reports={reports} /></div>
      {dayR.length > 0 && <><div className="section-head">{tx(lang, 'dailyPerf')}</div><div className="card">{[...dayR].sort((a, b) => a.date.localeCompare(b.date)).map(({ date, hit }) => (<div key={date} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}><div style={{ width: 56, fontSize: 11, color: '#888', flexShrink: 0 }}>{formatDate(date)}</div><div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 18, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(hit, 100)}%`, background: hitColor(hit), borderRadius: 4 }}></div></div><div style={{ width: 38, fontSize: 12, fontWeight: 'bold', color: hitColor(hit), textAlign: 'right' }}>{hit}%</div></div>))}</div></>}
      <div className={isDesktop ? 'scorecard-cols' : ''}>
        <div className="card" style={{ marginBottom: 11 }}><div className="section-head">{tx(lang, 'opScorecard')}</div>{opR.map(o => (<div key={o.name} className="scorecard-row"><div className="scorecard-name">{o.name}{concerns.find(c => c.name === o.name) && <span style={{ color: '#C8102E', marginLeft: 6, fontSize: 11 }}>⚠</span>}{onFire.find(c => c.name === o.name) && <span style={{ marginLeft: 6, fontSize: 11 }}>🏆</span>}</div><div className="scorecard-bar-wrap"><div className="scorecard-bar" style={{ width: `${Math.min(o.hit, 100)}%`, background: hitColor(o.hit) }}></div></div><div className="scorecard-pct" style={{ color: hitColor(o.hit) }}>{o.hit}%</div></div>))}</div>
        <div className="card" style={{ marginBottom: 11 }}><div className="section-head">{tx(lang, 'pressPerf')}</div>{prR.map(p => (<div key={p.press} className="scorecard-row"><div className="scorecard-name">{tx(lang, 'press')} {p.press}</div><div className="scorecard-bar-wrap"><div className="scorecard-bar" style={{ width: `${Math.min(p.hit, 100)}%`, background: hitColor(p.hit) }}></div></div><div className="scorecard-pct" style={{ color: hitColor(p.hit) }}>{p.hit}%</div></div>))}</div>
      </div>
    </>
  );
}

// ── Manager View ──────────────────────────────────────────────
export function ManagerView({ lang, user, operators, setOperators, goals, setGoals, parts, setParts, settings, setSettings, lastReport, onLogout }) {
  const isAdmin = user?.role === ROLES.ADMIN;
  const [tab, setTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [archived, setArchived] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [ehPreds, setEHPreds] = useState([]);
  const [selPred, setSelPred] = useState(null);
  const [submitMode, setSubmitMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [selReport, setSelReport] = useState(null);
  const [localGoals, setLocalGoals] = useState({ ...goals });
  const [goalMsg, setGoalMsg] = useState('');
  const [ehGoalInput, setEHGoalInput] = useState(String(settings.ehGoal || 47.5));
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else if (tab === 'reports') loadReports();
    else if (tab === 'goals') { setLocalGoals({ ...goals }); setEHGoalInput(String(settings.ehGoal || 47.5)); }
    else if (tab === 'parts') loadParts();
    else if (tab === 'eh') loadEHPreds();
  }, [tab]);

  const loadUsers = async () => { setLoading(true); try { const r = await gasCall('getUsers'); if (r.success) setUsers(r.users); } catch {} setLoading(false); };
  const loadReports = async () => { setLoading(true); try { const r = await gasCall('getReports'); if (r.success) setReports(r.reports); } catch {} setLoading(false); };
  const loadArchived = async () => { try { const r = await gasCall('getArchivedReports'); if (r.success) setArchived(r.reports); } catch {} };
  const loadParts = async () => { setLoading(true); try { const r = await gasCall('getParts'); if (r.success) setParts(r.parts); } catch {} setLoading(false); };
  const loadEHPreds = async () => { setLoading(true); try { const r = await gasCall('getEHPredictions'); if (r.success) setEHPreds(r.predictions); } catch {} setLoading(false); };
  const refreshOps = async () => { try { const r = await gasCall('getOperators'); if (r.success) setOperators(r.operators); } catch {} };
  const delUser = async id => { if (!window.confirm(tx(lang, 'confirmDel'))) return; await gasCall('deleteUser', { id }); loadUsers(); };
  const delOp = async id => { if (!window.confirm(tx(lang, 'confirmDel'))) return; await gasCall('deleteOperator', { id }); refreshOps(); };
  const delPart = async id => { if (!window.confirm(tx(lang, 'confirmDel'))) return; await gasCall('deletePart', { id }); loadParts(); };
  const saveGoals = async () => { const arr = PRESSES.map(p => ({ press: p, goal: parseInt(localGoals[p], 10) || 0 })); const r = await gasCall('updateGoals', { goals: arr }); if (r.success) { const u = {}; PRESSES.forEach(p => { u[p] = parseInt(localGoals[p], 10) || 0; }); setGoals(u); setGoalMsg(tx(lang, 'goalsSaved')); setTimeout(() => setGoalMsg(''), 3000); } };
  const saveEHGoal = async () => { const val = parseFloat(ehGoalInput) || 47.5; const r = await gasCall('saveSetting', { key: 'ehGoal', value: val }); if (r.success) { setSettings(prev => ({ ...prev, ehGoal: val })); setGoalMsg(tx(lang, 'ehGoalSaved')); setTimeout(() => setGoalMsg(''), 3000); } };
  const handleArchive = id => { setSelReport(null); setReports(prev => prev.filter(r => r.id !== id)); };
  const handleRestore = async id => { await gasCall('archiveReport', { reportId: id, restore: true }); setArchived(prev => prev.filter(r => r.id !== id)); };
  const handleDeletePred = async id => { await gasCall('deleteEHPrediction', { id }); setEHPreds(prev => prev.filter(p => p.id !== id)); setSelPred(null); };
  const toggleArchived = () => { if (!showArchived) loadArchived(); setShowArchived(v => !v); };

  if (submitMode === 'prediction') return <EHPredictionView lang={lang} user={user} parts={parts} ehGoal={settings.ehGoal || 47.5} onBack={() => setSubmitMode(null)} />;
  if (submitMode === 'report') return <ProductionReportView lang={lang} user={user} operators={operators} goals={goals} parts={parts} lastReport={lastReport} onBack={() => setSubmitMode(null)} />;
  if (selReport) return <ReportDetail report={selReport} lang={lang} onBack={() => setSelReport(null)} onArchive={handleArchive} operators={operators} parts={parts} />;
  if (selPred) return <EHPredictionDetail prediction={selPred} parts={parts} lang={lang} ehGoal={settings.ehGoal || 47.5} onBack={() => setSelPred(null)} onDelete={handleDeletePred} />;

  const adminTabs = ['overview', 'molders', 'submit', 'users', 'operators', 'goals', 'parts', 'eh', 'ehsummary', 'reports'];
  const managerTabs = ['overview', 'molders', 'submit', 'eh', 'ehsummary', 'reports'];
  const tabs = isAdmin ? adminTabs : managerTabs;

  const renderContent = () => {
    if (loading) return <div className="loading-msg">{tx(lang, 'loading')}</div>;
    if (tab === 'overview') return <OverviewTab lang={lang} operators={operators} />;
    if (tab === 'molders')  return <MolderProfilesTab lang={lang} operators={operators} user={user} />;
    if (tab === 'ehsummary') return <EHSummaryTab lang={lang} />;
    if (tab === 'submit') return (
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>{tx(lang, 'whatSubmit')}</div>
        {parts.length > 0 && <div className="home-option-card" onClick={() => setSubmitMode('prediction')}><div className="home-option-icon">📊</div><div><div className="home-option-title">{tx(lang, 'ehPrediction')}</div><div className="home-option-sub">{tx(lang, 'ehPredictionSub')}</div></div></div>}
        <div className="home-option-card" onClick={() => setSubmitMode('report')}><div className="home-option-icon">📋</div><div><div className="home-option-title">{tx(lang, 'productionReport')}</div><div className="home-option-sub">{tx(lang, 'productionReportSub')}</div></div></div>
      </div>
    );
    if (tab === 'users') return (<><button className="btn btn-red" style={{ marginBottom: 12 }} onClick={() => setModal({ type: 'user', item: null })}>+ {tx(lang, 'addUser')}</button><div className="card">{users.length === 0 && <div className="empty-msg">{tx(lang, 'noUsers')}</div>}{users.map(u => (<div key={u.id} className="list-row"><div><div className="list-row-main">{u.username}</div><div className="list-row-sub">{u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Manager' : u.role === 'viewer' ? 'Viewer' : 'Lead'}{u.shift && (u.role === 'lead' || u.role === 'manager') ? ` · Shift ${u.shift}` : ''}{u.email ? ` — ${u.email}` : ''}</div></div><div className="list-row-actions"><button className="btn-sm btn-sm-gray" onClick={() => setModal({ type: 'user', item: u })}>{tx(lang, 'edit')}</button><button className="btn-sm btn-sm-danger" onClick={() => delUser(u.id)}>{tx(lang, 'delete')}</button></div></div>))}</div></>);
    if (tab === 'operators') return (<><button className="btn btn-red" style={{ marginBottom: 12 }} onClick={() => setModal({ type: 'operator', item: null })}>+ {tx(lang, 'addOp')}</button><div className="card">{operators.length === 0 && <div className="empty-msg">{tx(lang, 'noOps')}</div>}{operators.map(op => (<div key={op.id} className="list-row"><div><div className="list-row-main">{op.name}</div><div className="list-row-sub">{tx(lang, 'stampNo')}: {op.stampNumber}</div></div><div className="list-row-actions"><button className="btn-sm btn-sm-gray" onClick={() => setModal({ type: 'operator', item: op })}>{tx(lang, 'edit')}</button><button className="btn-sm btn-sm-danger" onClick={() => delOp(op.id)}>{tx(lang, 'delete')}</button></div></div>))}</div></>);
    if (tab === 'parts') return (<><button className="btn btn-red" style={{ marginBottom: 12 }} onClick={() => setModal({ type: 'part', item: null })}>+ {tx(lang, 'addPart')}</button><div className="card">{parts.length === 0 && <div className="empty-msg">{tx(lang, 'noParts')}</div>}{parts.map(p => (<div key={p.id} className="list-row"><div><div className="list-row-main">{p.partNumber}</div><div className="list-row-sub">{p.description && <span>{p.description} — </span>}{p.ehRate} EH/part</div></div><div className="list-row-actions"><button className="btn-sm btn-sm-gray" onClick={() => setModal({ type: 'part', item: p })}>{tx(lang, 'edit')}</button><button className="btn-sm btn-sm-danger" onClick={() => delPart(p.id)}>{tx(lang, 'delete')}</button></div></div>))}</div></>);
    if (tab === 'eh') return (<>{ehPreds.length === 0 && <div className="empty-msg" style={{ padding: 24 }}>{tx(lang, 'noEHPredictions')}</div>}{ehPreds.map(pred => { const pct = pred.goalEH > 0 ? Math.round((pred.totalEH / pred.goalEH) * 100) : 0; return (<div key={pred.id} className="card report-card" onClick={() => setSelPred(pred)}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 'bold', fontSize: 16 }}>{formatDate(pred.date)}</div><div className="report-meta">{pred.submittedBy} · {formatDateTime(pred.timestamp)}</div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 20, fontWeight: 'bold', color: hitColor(pct) }}>{pred.totalEH.toFixed(1)}h</div><div style={{ fontSize: 12, color: '#888' }}>of {pred.goalEH}h ({pct}%)</div></div></div></div>); })}</>);
    if (tab === 'goals') return (
      <>
        {goalMsg && <div className="alert alert-success">{goalMsg}</div>}
        <div className="section-head" style={{ marginBottom: 8 }}>{tx(lang, 'ehGoalLabel')}</div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="goal-row" style={{ borderBottom: 'none', paddingBottom: 0 }}><div className="goal-label">{tx(lang, 'ehGoalLabel')}</div><input className="goal-input" type="text" inputMode="decimal" value={ehGoalInput} onChange={e => setEHGoalInput(e.target.value)} /></div>
          <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={saveEHGoal}>{tx(lang, 'saveEHGoal')}</button>
        </div>
        <div className="section-head">{tx(lang, 'defaultGoals')}</div>
        <div className="card">{PRESSES.map(p => (<div key={p} className="goal-row"><div className="goal-label">{tx(lang, 'press')} {p}</div><input className="goal-input" type="text" inputMode="numeric" value={localGoals[p] != null ? localGoals[p] : ''} onChange={e => setLocalGoals(prev => ({ ...prev, [p]: e.target.value.replace(/[^0-9]/g, '') }))} /></div>))}</div>
        <button className="btn btn-red" style={{ marginTop: 12 }} onClick={saveGoals}>{tx(lang, 'saveGoals')}</button>
      </>
    );
    if (tab === 'reports') return (
      <>
        {reports.length === 0 && <div className="empty-msg" style={{ padding: 24 }}>{tx(lang, 'noReports')}</div>}
        {reports.map(r => { const iss = (r.pressData || []).filter(p => p.hasIssue).length, stop = (r.pressData || []).filter(p => !p.isRunning).length; return (<div key={r.id} className="card report-card" onClick={() => setSelReport(r)}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 'bold', fontSize: 16 }}>{formatDate(r.date)}</div><div className="report-meta">{r.submittedBy} · {formatDateTime(r.timestamp)}</div></div><span style={{ color: '#C8102E', fontSize: 22, fontWeight: 'bold' }}>›</span></div>{(iss > 0 || stop > 0) && <div className="report-flags">{iss > 0 && <span className="flag flag-issue">⚠ {iss} {iss === 1 ? 'issue' : 'issues'}</span>}{stop > 0 && <span className="flag flag-stopped">● {stop} not running</span>}</div>}</div>); })}
        <div className="archived-toggle" onClick={toggleArchived}><span className="archived-toggle-label">📦 {tx(lang, 'archivedReports')}</span><span style={{ fontSize: 14, color: '#aaa' }}>{showArchived ? '▲' : '▼'}</span></div>
        {showArchived && <div>{archived.length === 0 && <div className="empty-msg" style={{ padding: 16 }}>{tx(lang, 'noArchived')}</div>}{archived.map(r => (<div key={r.id} className="card" style={{ opacity: 0.75 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 'bold', fontSize: 15 }}>{formatDate(r.date)}</div><div className="report-meta">{r.submittedBy} · {formatDateTime(r.timestamp)}</div></div><button className="btn-sm btn-sm-green" onClick={() => handleRestore(r.id)}>{tx(lang, 'restore')}</button></div></div>))}</div>}
      </>
    );
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="app-header">
        <div><div className="header-title">nVent | {tx(lang, 'manager')}</div><div className="header-sub">{user.username}</div></div>
        <button className="header-btn" onClick={onLogout}>{tx(lang, 'logout')}</button>
      </div>
      {!isDesktop && <div className="tabs">{tabs.map(tk => <div key={tk} className={`tab${tab === tk ? ' active' : ''}`} onClick={() => setTab(tk)}>{tx(lang, tk) || tk}</div>)}</div>}
      <div className="mgr-body">
        {isDesktop && <div className="mgr-sidebar">{tabs.map(tk => <button key={tk} className={`mgr-sidebar-btn${tab === tk ? ' active' : ''}`} onClick={() => setTab(tk)}>{tx(lang, tk) || tk}</button>)}</div>}
        <div className="mgr-content">{renderContent()}</div>
      </div>
      {modal?.type === 'user'     && <UserModal lang={lang} item={modal.item} onSave={() => { setModal(null); loadUsers(); }} onClose={() => setModal(null)} />}
      {modal?.type === 'operator' && <OperatorModal lang={lang} item={modal.item} onSave={() => { setModal(null); refreshOps(); }} onClose={() => setModal(null)} />}
      {modal?.type === 'part'     && <PartModal lang={lang} item={modal.item} onSave={() => { setModal(null); loadParts(); }} onClose={() => setModal(null)} />}
    </div>
  );
}
