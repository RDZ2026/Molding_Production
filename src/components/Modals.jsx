import { useState } from 'react';
import { gasCall } from '../api';
import { tx } from '../translations';
import { ROLES } from '../constants';
import { Switch } from './Common';
import { Stars } from './Common';

export function UserModal({ lang, item, onSave, onClose }) {
  const [username, setUsername] = useState(item ? item.username : '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(item ? item.role : 'lead');
  const [shift, setShift] = useState(item ? (item.shift || 2) : 2);
  const [email, setEmail] = useState(item ? item.email || '' : '');
  const [notify, setNotify] = useState(item ? item.notifyReport || false : false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!username.trim() || (!item && !password)) return;
    setSaving(true); setErr('');
    try {
      const pl = item
        ? { id: item.id, username: username.trim(), role, shift, email, notifyReport: notify, ...(password ? { password } : {}) }
        : { username: username.trim(), password, role, shift, email, notifyReport: notify };
      const r = await gasCall(item ? 'updateUser' : 'addUser', pl);
      if (r.success) onSave(); else { setErr(r.error || tx(lang, 'errOccurred')); setSaving(false); }
    } catch { setErr(tx(lang, 'networkErr')); setSaving(false); }
  };

  const roleOptions = [
    { value: 'lead',    label: 'Lead' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin',   label: 'Admin' },
    { value: 'viewer',  label: 'Viewer (Read Only)' },
  ];

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-title">{item ? tx(lang, 'editUser') : tx(lang, 'addUser')}</div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="field"><label className="field-label">{tx(lang, 'username')}</label><input type="text" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} /></div>
        <div className="field"><label className="field-label">{tx(lang, 'password')}{item ? ` — ${tx(lang, 'keepPw')}` : ''}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="field">
          <label className="field-label">{tx(lang, 'role')}</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {(role === 'lead' || role === 'manager') && (
          <div className="field">
            <label className="field-label">Shift</label>
            <select value={shift} onChange={e => setShift(parseInt(e.target.value))}>
              <option value={1}>1st Shift</option>
              <option value={2}>2nd Shift</option>
            </select>
          </div>
        )}
        <div className="field"><label className="field-label">{tx(lang, 'email')}</label><input type="text" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></div>
        <div className="toggle-row" style={{ marginBottom: 12 }}>
          <span className="toggle-text" style={{ fontSize: 13 }}>{tx(lang, 'notifyReport')}</span>
          <Switch id="notify-sw" checked={notify} onChange={setNotify} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-gray" style={{ flex: 1 }} onClick={onClose}>{tx(lang, 'cancel')}</button>
          <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? tx(lang, 'saving') : tx(lang, 'save')}</button>
        </div>
      </div>
    </div>
  );
}

export function OperatorModal({ lang, item, onSave, onClose }) {
  const [name, setName] = useState(item ? item.name : '');
  const [stamp, setStamp] = useState(item ? item.stampNumber : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!name.trim() || !stamp.trim()) return; setSaving(true); setErr('');
    const pl = item ? { id: item.id, name: name.trim(), stampNumber: stamp.trim() } : { name: name.trim(), stampNumber: stamp.trim() };
    try { const r = await gasCall(item ? 'updateOperator' : 'addOperator', pl); if (r.success) onSave(); else { setErr(r.error || tx(lang, 'errOccurred')); setSaving(false); } } catch { setErr(tx(lang, 'networkErr')); setSaving(false); }
  };
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-title">{item ? tx(lang, 'editOp') : tx(lang, 'addOp')}</div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="field"><label className="field-label">{tx(lang, 'name')}</label><input type="text" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label className="field-label">{tx(lang, 'stampNo')}</label><input type="text" value={stamp} onChange={e => setStamp(e.target.value)} /></div>
        <div className="modal-footer">
          <button className="btn btn-gray" style={{ flex: 1 }} onClick={onClose}>{tx(lang, 'cancel')}</button>
          <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? tx(lang, 'saving') : tx(lang, 'save')}</button>
        </div>
      </div>
    </div>
  );
}

export function PartModal({ lang, item, onSave, onClose }) {
  const [pn, setPn] = useState(item ? item.partNumber : '');
  const [desc, setDesc] = useState(item ? item.description || '' : '');
  const [rate, setRate] = useState(item ? String(item.ehRate) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!pn.trim() || !rate) return; setSaving(true); setErr('');
    const pl = { partNumber: pn.trim(), description: desc.trim(), ehRate: parseFloat(rate) || 0 };
    if (item) pl.id = item.id;
    try { const r = await gasCall(item ? 'updatePart' : 'addPart', pl); if (r.success) onSave(); else { setErr(r.error || tx(lang, 'errOccurred')); setSaving(false); } } catch { setErr(tx(lang, 'networkErr')); setSaving(false); }
  };
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-title">{item ? tx(lang, 'editPart') : tx(lang, 'addPart')}</div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="field"><label className="field-label">{tx(lang, 'partNumber')}</label><input type="text" value={pn} onChange={e => setPn(e.target.value)} placeholder="e.g. VJ1008Base" /></div>
        <div className="field"><label className="field-label">{tx(lang, 'description')} <span style={{ color: '#ccc', fontWeight: 'normal', textTransform: 'none', fontSize: 10 }}>(optional)</span></label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} /></div>
        <div className="field"><label className="field-label">{tx(lang, 'ehRate')}</label><input type="text" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 0.04" /></div>
        <div className="modal-footer">
          <button className="btn btn-gray" style={{ flex: 1 }} onClick={onClose}>{tx(lang, 'cancel')}</button>
          <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? tx(lang, 'saving') : tx(lang, 'save')}</button>
        </div>
      </div>
    </div>
  );
}

export function AddNoteModal({ lang, operatorName, author, onSave, onClose }) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!note.trim()) return; setSaving(true); setErr('');
    try {
      const r = await gasCall('saveMolderNote', { operatorName, note: note.trim(), rating, author });
      if (r.success) onSave({ id: r.id, note: note.trim(), rating, timestamp: r.timestamp, author });
      else { setErr(r.error || tx(lang, 'errOccurred')); setSaving(false); }
    } catch { setErr(tx(lang, 'networkErr')); setSaving(false); }
  };
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-title">{tx(lang, 'addNote')} — {operatorName}</div>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="field"><label className="field-label">{tx(lang, 'rating')}</label><Stars value={rating} onChange={setRating} /></div>
        <div className="field"><label className="field-label">{tx(lang, 'notePlaceholder')}</label><textarea value={note} placeholder={tx(lang, 'notePlaceholder')} onChange={e => setNote(e.target.value)} style={{ minHeight: 120 }} autoFocus /></div>
        <div className="modal-footer">
          <button className="btn btn-gray" style={{ flex: 1 }} onClick={onClose}>{tx(lang, 'cancel')}</button>
          <button className="btn btn-red" style={{ flex: 1 }} onClick={save} disabled={saving || !note.trim()}>{saving ? tx(lang, 'saving') : tx(lang, 'saveNote')}</button>
        </div>
      </div>
    </div>
  );
}
