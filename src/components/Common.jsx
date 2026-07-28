import { useState, useEffect } from 'react';
import { gasCall } from '../api';

export function Switch({ id, checked, onChange }) {
  return (
    <label className="sw" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="sw-track"></span>
    </label>
  );
}

export function Stars({ value, onChange, readOnly }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} className="star-btn"
          onClick={() => !readOnly && onChange && onChange(s)}
          style={{ color: s <= value ? '#f59e0b' : '#ddd', cursor: readOnly ? 'default' : 'pointer' }}>
          ★
        </button>
      ))}
    </div>
  );
}

export function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const go = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };
  return <button className="btn btn-outline" onClick={go}>{copied ? '✓ Copied!' : label}</button>;
}

export function UndoOverlay({ countdown, lang, onUndo }) {
  return (
    <div className="overlay">
      <div className="overlay-box">
        <div className="countdown-num">{countdown}</div>
        <div style={{ fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>
          {lang === 'es' ? `Enviando en ${countdown} segundos` : `Submitting in ${countdown} seconds`}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          {lang === 'es' ? 'Enviando...' : 'Sending your report...'}
        </div>
        <button className="btn btn-outline" onClick={onUndo}>
          {lang === 'es' ? 'Deshacer' : 'Undo'}
        </button>
      </div>
    </div>
  );
}

export function PartSearch({ parts, selectedPart, onSelect, placeholder }) {
  const [query, setQuery] = useState(selectedPart ? selectedPart.partNumber : '');
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(selectedPart ? selectedPart.partNumber : ''); }, [selectedPart?.id]);
  const filtered = !query
    ? parts.slice(0, 8)
    : parts.filter(p =>
        p.partNumber.toLowerCase().includes(query.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);
  const select = part => { setQuery(part.partNumber); setOpen(false); onSelect(part); };
  const clear = () => { setQuery(''); setOpen(false); onSelect(null); };
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect(null); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder || 'Search part...'}
          style={{ flex: 1 }} />
        {(query || selectedPart) && (
          <button onClick={clear} style={{ background: 'none', border: '1.5px solid #dce0e5', borderRadius: 7, padding: '0 11px', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="part-dd">
          {filtered.map(p => (
            <div key={p.id} className="part-dd-item" onMouseDown={() => select(p)}>
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>{p.partNumber}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{p.description || ''}{p.description ? ' — ' : ''}{p.ehRate} EH/part</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
