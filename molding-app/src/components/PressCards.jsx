import { calcHit, hitColor, hitCls } from '../helpers';
import { NR_REASONS } from '../constants';
import { Switch, PartSearch } from './Common';
import { tx } from '../translations';

export function PressCard({ data, operators, parts, lang, onChange }) {
  const { pressNumber, operatorId, good, scrap, goal, notes, hasIssue, isRunning, notRunningReason, moldNumber, partId, partNumber, fromPrediction } = data;
  const reasons = NR_REASONS[lang] || NR_REASONS.en;
  const hit = isRunning ? calcHit(good, goal) : null;
  const upd = (f, v) => onChange(pressNumber, f, v);

  const handleOp = opId => {
    const op = operators.find(o => o.id === opId);
    upd('operatorId', opId); upd('operatorName', op ? op.name : ''); upd('operatorStamp', op ? op.stampNumber : '');
  };

  const handlePart = part => {
    if (fromPrediction && partId && (!part || part.id !== partId)) {
      if (!window.confirm(`This press was set to "${partNumber}" in tonight's prediction. Change it?`)) return;
    }
    upd('partId', part ? part.id : '');
    upd('partNumber', part ? part.partNumber : '');
    upd('partEhRate', part ? part.ehRate : 0);
    upd('fromPrediction', false);
  };

  const selPart = parts.find(p => p.id === partId) || null;
  let cls = 'card press-card';
  if (!isRunning) cls += ' is-stopped'; else cls += ' is-running' + (hasIssue ? ' has-issue' : '');

  return (
    <div className={cls}>
      <div className="press-card-top">
        <div className="press-num">{tx(lang, 'press')} {pressNumber}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`press-badge ${!isRunning ? 'badge-stopped' : hasIssue ? 'badge-issue' : 'badge-ok'}`}>
            {!isRunning ? tx(lang, 'stopped') : hasIssue ? tx(lang, 'issue') : tx(lang, 'ok')}
          </span>
          <div className="nr-toggle-wrap">
            <span className="nr-toggle-label">{tx(lang, 'notRunning')}</span>
            <Switch id={`nr-${pressNumber}`} checked={!isRunning} onChange={v => upd('isRunning', !v)} />
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">{tx(lang, 'operator')}</label>
        <select value={operatorId} onChange={e => handleOp(e.target.value)}>
          <option value="">{tx(lang, 'selectOp')}</option>
          {operators.map(op => <option key={op.id} value={op.id}>{op.name} — #{op.stampNumber}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field-label">{tx(lang, 'moldNo')} <span style={{ color: '#ccc', fontWeight: 'normal', textTransform: 'none', fontSize: 10 }}>({tx(lang, 'moldOptional')})</span></label>
        <input type="text" value={moldNumber} placeholder="e.g. M-452-A" onChange={e => upd('moldNumber', e.target.value)} />
      </div>

      {parts.length > 0 && (
        <div className="field">
          <label className="field-label">
            {tx(lang, 'part')} <span style={{ color: '#ccc', fontWeight: 'normal', textTransform: 'none', fontSize: 10 }}>({tx(lang, 'partOptional')})</span>
            {fromPrediction && <span style={{ marginLeft: 6, fontSize: 10, color: '#1a4dc3', fontWeight: 'bold' }}>★ from prediction</span>}
          </label>
          <PartSearch parts={parts} selectedPart={selPart} onSelect={handlePart} placeholder={tx(lang, 'searchPart')} />
        </div>
      )}

      {isRunning ? (
        <>
          <div className="field">
            <div className="three-col">
              <div><div className="col-label">{tx(lang, 'good')}</div><input type="text" inputMode="numeric" value={good} placeholder="0" onChange={e => upd('good', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><div className="col-label">{tx(lang, 'scrap')}</div><input type="text" inputMode="numeric" value={scrap} placeholder="0" onChange={e => upd('scrap', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><div className="col-label">{tx(lang, 'goal')}</div><input type="text" inputMode="numeric" value={goal} onChange={e => upd('goal', e.target.value.replace(/[^0-9]/g, ''))} /></div>
            </div>
          </div>
          {hit !== null && (
            <div className="hit-row">
              <span className={`hit-pct ${hitCls(hit)}`}>{hit}%</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{tx(lang, 'hitPct')}</span>
            </div>
          )}
          <div className="divider" />
          <div className="toggle-row">
            <span className="toggle-text">⚠ {tx(lang, 'hadIssue')}</span>
            <Switch id={`iss-${pressNumber}`} checked={hasIssue} onChange={v => upd('hasIssue', v)} />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label className="field-label">{tx(lang, 'notes')}</label>
            <textarea value={notes} placeholder={tx(lang, 'notesHint')} onChange={e => upd('notes', e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-label">{tx(lang, 'reason')}</label>
            <select value={notRunningReason} onChange={e => upd('notRunningReason', e.target.value)}>
              <option value="">{tx(lang, 'selectReason')}</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{tx(lang, 'notes')}</label>
            <textarea value={notes} placeholder={tx(lang, 'notesHint')} onChange={e => upd('notes', e.target.value)} />
          </div>
        </>
      )}
    </div>
  );
}

export function EHPressCard({ data, parts, lang, onChange }) {
  const { pressNumber, isRunning, notRunningReason, partId, estimatedQty } = data;
  const reasons = NR_REASONS[lang] || NR_REASONS.en;
  const selPart = parts.find(p => p.id === partId) || null;
  const projEH = selPart && estimatedQty ? ((parseInt(estimatedQty, 10) || 0) * selPart.ehRate) : 0;
  const upd = (f, v) => onChange(pressNumber, f, v);
  const handlePart = part => {
    upd('partId', part ? part.id : ''); upd('partNumber', part ? part.partNumber : '');
    upd('partDescription', part ? part.description : ''); upd('partEhRate', part ? part.ehRate : 0);
  };
  const borderColor = !isRunning ? '#999' : partId ? '#28a745' : '#f59e0b';
  return (
    <div className="card press-card" style={{ borderLeftColor: borderColor, borderLeftWidth: 5 }}>
      <div className="press-card-top">
        <div className="press-num">{tx(lang, 'press')} {pressNumber}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isRunning && projEH > 0 && <span style={{ fontWeight: 'bold', color: '#1e7e34', fontSize: 15 }}>{projEH.toFixed(2)}h</span>}
          <div className="nr-toggle-wrap">
            <span className="nr-toggle-label">{tx(lang, 'notRunning')}</span>
            <Switch id={`nreh-${pressNumber}`} checked={!isRunning} onChange={v => upd('isRunning', !v)} />
          </div>
        </div>
      </div>
      {isRunning ? (
        <>
          <div className="field">
            <label className="field-label">{tx(lang, 'part')}</label>
            <PartSearch parts={parts} selectedPart={selPart} onSelect={handlePart} placeholder={tx(lang, 'searchPart')} />
          </div>
          {selPart && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{selPart.description && <span>{selPart.description} — </span>}<strong>{selPart.ehRate} EH/part</strong></div>}
          <div className="field">
            <label className="field-label">{tx(lang, 'estimatedQty')}</label>
            <input type="text" inputMode="numeric" value={estimatedQty} placeholder="0" onChange={e => upd('estimatedQty', e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </>
      ) : (
        <div className="field">
          <label className="field-label">{tx(lang, 'reason')}</label>
          <select value={notRunningReason} onChange={e => upd('notRunningReason', e.target.value)}>
            <option value="">{tx(lang, 'selectReason')}</option>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
