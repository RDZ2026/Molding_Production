import { useState, useEffect } from 'react';
import { gasCall } from '../api';

const PRESS_NUMBERS = [452, 454, 462, 455, 300, 501, 502, 1000, 1200];

const getShiftDate = (shiftNum) => {
  const now = new Date();
  if (shiftNum === 2 && now.getHours() < 10) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  }
  return now.toLocaleDateString('en-CA');
};

export function OperatorSubmit({ lang, user, operators, parts, shift, onLogout }) {
  const shiftNum = user.shift || shift;
  const [reportDate, setReportDate] = useState(getShiftDate(shiftNum));
  const [selectedPresses, setSelectedPresses] = useState([]);
  const [pressData, setPressData] = useState({});
  const [submittedMap, setSubmittedMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await gasCall('getOperatorSubmission', {
          operatorName: user.name,
          shift: shiftNum,
        });
        if (r.success && r.submission) {
          const s = r.submission;
          const pn = Number(s.pressNumber);
          const key = String(pn);
          setSelectedPresses([pn]);
          setPressData({
            [key]: {
              partSearch: '',
              selectedPart: s.partId ? { id: s.partId, partNumber: s.partNumber, description: '' } : null,
              good: String(s.good ?? ''),
              scrap: String(s.scrap ?? ''),
              hasIssue: !!s.hasIssue,
              notes: s.notes || '',
            }
          });
          setSubmittedMap({ [key]: s.id });
          if (s.date) setReportDate(s.date);
        }
      } catch {}
      setLoading(false);
    };
    check();
  }, []);

  const togglePress = (num) => {
    const key = String(num);
    setSelectedPresses(prev => {
      if (prev.includes(num)) {
        setPressData(pd => { const c = { ...pd }; delete c[key]; return c; });
        return prev.filter(p => p !== num);
      }
      if (prev.length >= 2) return prev;
      setPressData(pd => ({
        ...pd,
        [key]: pd[key] || { partSearch: '', selectedPart: null, good: '', scrap: '', hasIssue: false, notes: '' }
      }));
      return [...prev, num];
    });
  };

  const updatePressData = (pressNum, field, value) => {
    const key = String(pressNum);
    setPressData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const handleSubmit = async () => {
    const valid = selectedPresses.filter(pn => {
      const d = pressData[String(pn)];
      return d && d.selectedPart && d.good !== '';
    });
    if (valid.length === 0) return;
    setSaving(true); setErr('');
    try {
      for (const pn of valid) {
        const d = pressData[String(pn)];
        const pl = {
          date: reportDate,
          operatorId: user.id,
          operatorName: user.name,
          operatorStamp: user.stampNumber || '',
          shift: shiftNum,
          pressNumber: pn,
          partId: d.selectedPart.id,
          partNumber: d.selectedPart.partNumber,
          good: parseInt(d.good) || 0,
          scrap: parseInt(d.scrap) || 0,
          hasIssue: d.hasIssue,
          notes: (d.notes || '').trim(),
        };
        const existingId = submittedMap[String(pn)];
        const action = existingId ? 'updateOperatorSubmission' : 'submitOperatorReport';
        if (existingId) pl.id = existingId;
        const r = await gasCall(action, pl);
        if (!r.success) {
          setErr(r.error || 'Error saving. Try again.');
          setSaving(false);
          return;
        }
        if (!existingId && r.id) {
          setSubmittedMap(prev => ({ ...prev, [String(pn)]: r.id }));
        }
      }
      setSuccess(true);
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

  const canSubmit = selectedPresses.some(pn => {
    const d = pressData[String(pn)];
    return d && d.selectedPart && d.good !== '';
  });
  const hasExisting = Object.keys(submittedMap).length > 0;
  const runningLabel = selectedPresses.length > 0 ? 'Running: ' + selectedPresses.join(' + ') : '';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name || user.username}</div>
          <div style={{ color: '#888', fontSize: 13 }}>
            Shift {shiftNum} · Operator
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

      {hasExisting && !success && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#9a3412', fontSize: 13 }}>
          You already submitted a report today. You can update it below.
        </div>
      )}

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#991b1b' }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Report Date */}
        <div>
          <label style={labelStyle}>Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Press chip selector */}
        <div>
          <label style={labelStyle}>
            Press #{'  '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
              tap to select · up to 2
            </span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESS_NUMBERS.map(n => {
              const isSelected = selectedPresses.includes(n);
              const isDisabled = !isSelected && selectedPresses.length >= 2;
              return (
                <button
                  key={n}
                  onClick={() => togglePress(n)}
                  disabled={isDisabled}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: isSelected ? '2px solid #C8102E' : '1px solid #ddd',
                    background: isSelected ? '#fff0f0' : 'white',
                    color: isSelected ? '#C8102E' : '#444',
                    fontWeight: isSelected ? 700 : 400,
                    fontSize: 14,
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {runningLabel && (
            <div style={{ color: '#C8102E', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
              {runningLabel}
            </div>
          )}
        </div>

        {/* Per-press cards */}
        {selectedPresses.map(pn => {
          const d = pressData[String(pn)] || { partSearch: '', selectedPart: null, good: '', scrap: '', hasIssue: false, notes: '' };
          const filteredParts = d.partSearch.length < 2 ? [] : parts.filter(p =>
            p.partNumber.toLowerCase().includes(d.partSearch.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(d.partSearch.toLowerCase())
          );
          return (
            <div key={pn} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 14px', background: '#fafafa' }}>

              <div style={{ color: '#C8102E', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
                Press {pn}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Part Number */}
                <div>
                  <label style={labelStyle}>Part Number</label>
                  {d.selectedPart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px solid #C8102E', borderRadius: 8, background: '#fff5f5' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{d.selectedPart.partNumber}</div>
                        {d.selectedPart.description && (
                          <div style={{ color: '#888', fontSize: 12 }}>{d.selectedPart.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => { updatePressData(pn, 'selectedPart', null); updatePressData(pn, 'partSearch', ''); }}
                        style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={d.partSearch}
                        onChange={e => updatePressData(pn, 'partSearch', e.target.value)}
                        placeholder="Type part number to search..."
                        autoCapitalize="none"
                        style={inputStyle}
                      />
                      {filteredParts.length > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {filteredParts.map(p => (
                            <div key={p.id}
                              onClick={() => { updatePressData(pn, 'selectedPart', p); updatePressData(pn, 'partSearch', ''); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                              onTouchStart={e => e.currentTarget.style.background = '#f9fafb'}
                              onTouchEnd={e => e.currentTarget.style.background = ''}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.partNumber}</div>
                              {p.description && <div style={{ color: '#888', fontSize: 12 }}>{p.description}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {d.partSearch.length >= 2 && filteredParts.length === 0 && (
                        <div style={{ marginTop: 6, color: '#aaa', fontSize: 13 }}>No matching parts found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Good / Scrap */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Good Parts</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.good}
                      onChange={e => updatePressData(pn, 'good', e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Scrap</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.scrap}
                      onChange={e => updatePressData(pn, 'scrap', e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
                    />
                  </div>
                </div>

                {/* Issue toggle — per press */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', background: 'white' }}
                  onClick={() => updatePressData(pn, 'hasIssue', !d.hasIssue)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Report an Issue</div>
                    <div style={{ color: '#888', fontSize: 12 }}>Machine, material, safety, or quality concern</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: d.hasIssue ? '#C8102E' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: d.hasIssue ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                  </div>
                </div>

                {/* Notes — per press */}
                <div>
                  <label style={labelStyle}>
                    Notes
                    {!d.hasIssue && <span style={{ color: '#ccc', fontWeight: 400, textTransform: 'none', marginLeft: 6, fontSize: 11 }}>(optional)</span>}
                  </label>
                  <textarea
                    value={d.notes}
                    onChange={e => updatePressData(pn, 'notes', e.target.value)}
                    placeholder={d.hasIssue ? 'Describe the issue...' : 'Any additional notes...'}
                    style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

              </div>
            </div>
          );
        })}

        {/* Submit */}
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
          {saving ? 'Submitting...' : hasExisting ? 'Update Report' : 'Submit End-of-Shift Report'}
        </button>

      </div>

      <div style={{ marginTop: 32, textAlign: 'center', color: '#ddd', fontSize: 11 }}>
        nVent Hoffman · Molding · Shift {shiftNum}
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
