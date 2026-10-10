import { useState, useEffect } from 'react';
import { gasCall } from '../api';

const PRESS_NUMBERS = [452, 454, 462, 455, 300, 501, 502, 1000, 1200];

// Returns the shift date — for 2nd shift, approvals often happen after midnight
const getShiftDate = (shiftNum) => {
  const now = new Date();
  if (shiftNum === 2 && now.getHours() < 10) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA'); // "YYYY-MM-DD"
  }
  return now.toLocaleDateString('en-CA');
};

export function OperatorSubmit({ lang, user, operators, parts, shift, onLogout }) {
  const [pressNumber, setPressNumber] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [good, setGood] = useState('');
  const [scrap, setScrap] = useState('');
  const [hasIssue, setHasIssue] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await gasCall('getOperatorSubmission', {
          operatorName: user.name,
          shift: user.shift || shift,
        });
        if (r.success && r.submission) {
          const s = r.submission;
          setSubmitted(s);
          setPressNumber(String(s.pressNumber || ''));
          setGood(String(s.good ?? ''));
          setScrap(String(s.scrap ?? ''));
          setHasIssue(!!s.hasIssue);
          setNotes(s.notes || '');
          if (s.partId) setSelectedPart({ id: s.partId, partNumber: s.partNumber, description: '' });
        }
      } catch {}
      setLoading(false);
    };
    check();
  }, []);

  const filteredParts = partSearch.length < 2 ? [] : parts.filter(p =>
    p.partNumber.toLowerCase().includes(partSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(partSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!pressNumber || !selectedPart || good === '') return;
    setSaving(true); setErr('');
    try {
      const shiftNum = user.shift || shift;
      const pl = {
        date: getShiftDate(shiftNum),
        operatorId: user.id,
        operatorName: user.name,
        operatorStamp: user.stampNumber || '',
        shift: shiftNum,
        pressNumber: parseInt(pressNumber),
        partId: selectedPart.id,
        partNumber: selectedPart.partNumber,
        good: parseInt(good) || 0,
        scrap: parseInt(scrap) || 0,
        hasIssue,
        notes: notes.trim(),
      };
      const action = submitted ? 'updateOperatorSubmission' : 'submitOperatorReport';
      if (submitted) pl.id = submitted.id;
      const r = await gasCall(action, pl);
      if (r.success) {
        setSuccess(true);
        setSubmitted({ ...pl, id: r.id || submitted?.id, status: 'pending' });
      } else {
        setErr(r.error || 'Error saving. Try again.');
      }
    } catch {
      setErr('Network error. Try again.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ width: 36, height: 4, background: '#C8102E', margin: '0 auto 16px', borderRadius: 2 }} />
          Loading...
        </div>
      </div>
    );
  }

  const canSubmit = pressNumber && selectedPart && good !== '';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name || user.username}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            Shift {user.shift || shift} · Stamp #{user.stampNumber || '—'}
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#666' }}>
          Log Out
        </button>
      </div>

      <div style={{ height: 4, background: '#C8102E', borderRadius: 2, marginBottom: 24 }} />

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: '#222' }}>
        End-of-Shift Production Report
      </div>

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#166534', fontWeight: 600 }}>
          Report submitted. Your supervisor will review it.
        </div>
      )}

      {submitted && !success && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#9a3412', fontSize: 13 }}>
          You already submitted a report today (status: <strong>{submitted.status || 'pending'}</strong>). You can update it below.
        </div>
      )}

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#991b1b' }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Press Number */}
        <div>
          <label style={labelStyle}>Press #</label>
          <select value={pressNumber} onChange={e => setPressNumber(e.target.value)} style={inputStyle}>
            <option value="">Select press...</option>
            {PRESS_NUMBERS.map(n => (
              <option key={n} value={n}>Press {n}</option>
            ))}
          </select>
        </div>

        {/* Part Search */}
        <div>
          <label style={labelStyle}>Part Number</label>
          {selectedPart ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px solid #C8102E', borderRadius: 8, background: '#fff5f5' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedPart.partNumber}</div>
                {selectedPart.description && (
                  <div style={{ color: '#888', fontSize: 12 }}>{selectedPart.description}</div>
                )}
              </div>
              <button onClick={() => { setSelectedPart(null); setPartSearch(''); }}
                style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={partSearch}
                onChange={e => setPartSearch(e.target.value)}
                placeholder="Type part number to search..."
                autoCapitalize="none"
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              {filteredParts.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {filteredParts.map(p => (
                    <div key={p.id}
                      onClick={() => { setSelectedPart(p); setPartSearch(''); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onTouchStart={e => e.currentTarget.style.background = '#f9fafb'}
                      onTouchEnd={e => e.currentTarget.style.background = ''}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.partNumber}</div>
                      {p.description && <div style={{ color: '#888', fontSize: 12 }}>{p.description}</div>}
                    </div>
                  ))}
                </div>
              )}
              {partSearch.length >= 2 && filteredParts.length === 0 && (
                <div style={{ marginTop: 6, color: '#aaa', fontSize: 13 }}>No matching parts found</div>
              )}
            </div>
          )}
        </div>

        {/* Good / Scrap counts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Good Parts</label>
            <input
              type="number"
              inputMode="numeric"
              value={good}
              onChange={e => setGood(e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Scrap</label>
            <input
              type="number"
              inputMode="numeric"
              value={scrap}
              onChange={e => setScrap(e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
            />
          </div>
        </div>

        {/* Issue toggle */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }}
          onClick={() => setHasIssue(!hasIssue)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Report an Issue</div>
            <div style={{ color: '#888', fontSize: 12 }}>Machine, material, safety, or quality concern</div>
          </div>
          <div style={{ width: 44, height: 24, borderRadius: 12, background: hasIssue ? '#C8102E' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: hasIssue ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
          </div>
        </div>

        {/* Notes — always visible if issue flagged, optional otherwise */}
        <div>
          <label style={labelStyle}>
            Notes
            {!hasIssue && <span style={{ color: '#ccc', fontWeight: 400, textTransform: 'none', marginLeft: 6, fontSize: 11 }}>(optional)</span>}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={hasIssue ? 'Describe the issue...' : 'Any additional notes...'}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={saving || !canSubmit}
          style={{
            width: '100%',
            padding: 16,
            background: canSubmit ? '#C8102E' : '#e5e7eb',
            color: canSubmit ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}>
          {saving ? 'Submitting...' : submitted ? 'Update Report' : 'Submit End-of-Shift Report'}
        </button>
      </div>

      <div style={{ marginTop: 32, textAlign: 'center', color: '#ddd', fontSize: 11 }}>
        nVent Hoffman · Molding · Shift {user.shift || shift}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: '#666',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #ddd',
  borderRadius: 8,
  fontSize: 15,
  boxSizing: 'border-box',
  outline: 'none',
};
