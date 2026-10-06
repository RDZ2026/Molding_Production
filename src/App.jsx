import { useState, useEffect } from 'react';
import { gasCall } from './api';
import { tx } from './translations';
import { DEFAULT_GOALS, ROLES } from './constants';
import { LanguageScreen, LoginScreen } from './components/Auth';
import { LeadView } from './components/LeadViews';
import { ManagerView } from './components/ManagerView';
import { ViewerView } from './components/ViewerView';

// ── Operator Submit Screen (inline — no separate file needed) ──────────────
function OperatorScreen({ lang, user, operators, parts, shift, onLogout }) {
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
    gasCall('getOperatorSubmission', { operatorName: user.name, shift: user.shift || shift })
      .then(r => {
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredParts = partSearch.length < 2 ? [] : parts.filter(p =>
    p.partNumber.toLowerCase().includes(partSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(partSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!pressNumber || !selectedPart || good === '') return;
    setSaving(true); setErr('');
    try {
      const pl = {
        operatorId: user.id,
        operatorName: user.name,
        operatorStamp: user.stampNumber || '',
        shift: user.shift || shift,
        pressNumber: parseInt(pressNumber),
        partId: selectedPart.id,
        partNumber: selectedPart.partNumber,
        good: parseInt(good) || 0,
        scrap: parseInt(scrap) || 0,
        hasIssue,
        notes: notes.trim(),
      };
      if (submitted) pl.id = submitted.id;
      const r = await gasCall(submitted ? 'updateOperatorSubmission' : 'submitOperatorReport', pl);
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ width: 36, height: 4, background: '#C8102E', margin: '0 auto 16px', borderRadius: 2 }} />
        Loading...
      </div>
    </div>
  );

  const canSubmit = pressNumber && selectedPart && good !== '';
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#666', marginBottom: 6 };
  const inp = { width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 48px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name || user.username}</div>
          <div style={{ color: '#888', fontSize: 13 }}>Shift {user.shift || shift} · Operator</div>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#666' }}>Log Out</button>
      </div>
      <div style={{ height: 4, background: '#C8102E', borderRadius: 2, marginBottom: 24 }} />
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>End-of-Shift Production Report</div>

      {success && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#166534', fontWeight: 600 }}>Report submitted. Your supervisor will review it.</div>}
      {submitted && !success && <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#9a3412', fontSize: 13 }}>Already submitted today (status: <strong>{submitted.status || 'pending'}</strong>). You can update below.</div>}
      {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#991b1b' }}>{err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={lbl}>Press #</label>
          <select value={pressNumber} onChange={e => setPressNumber(e.target.value)} style={inp}>
            <option value="">Select press...</option>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Press {n}</option>)}
          </select>
        </div>

        <div>
          <label style={lbl}>Part Number</label>
          {selectedPart ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1.5px solid #C8102E', borderRadius: 8, background: '#fff5f5' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedPart.partNumber}</div>
                {selectedPart.description && <div style={{ color: '#888', fontSize: 12 }}>{selectedPart.description}</div>}
              </div>
              <button onClick={() => { setSelectedPart(null); setPartSearch(''); }} style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 22, cursor: 'pointer', padding: 0 }}>×</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input type="text" value={partSearch} onChange={e => setPartSearch(e.target.value)} placeholder="Type part number to search..." autoCapitalize="none" style={inp} />
              {filteredParts.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {filteredParts.map(p => (
                    <div key={p.id} onClick={() => { setSelectedPart(p); setPartSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.partNumber}</div>
                      {p.description && <div style={{ color: '#888', fontSize: 12 }}>{p.description}</div>}
                    </div>
                  ))}
                </div>
              )}
              {partSearch.length >= 2 && filteredParts.length === 0 && <div style={{ marginTop: 6, color: '#aaa', fontSize: 13 }}>No matching parts found</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Good Parts</label>
            <input type="number" inputMode="numeric" value={good} onChange={e => setGood(e.target.value)} placeholder="0" style={{ ...inp, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }} />
          </div>
          <div>
            <label style={lbl}>Scrap</label>
            <input type="number" inputMode="numeric" value={scrap} onChange={e => setScrap(e.target.value)} placeholder="0" style={{ ...inp, fontSize: 28, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }} onClick={() => setHasIssue(!hasIssue)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Report an Issue</div>
            <div style={{ color: '#888', fontSize: 12 }}>Machine, material, safety, or quality concern</div>
          </div>
          <div style={{ width: 44, height: 24, borderRadius: 12, background: hasIssue ? '#C8102E' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: hasIssue ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
          </div>
        </div>

        <div>
          <label style={lbl}>Notes {!hasIssue && <span style={{ color: '#ccc', fontWeight: 400, textTransform: 'none', marginLeft: 6, fontSize: 11 }}>(optional)</span>}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={hasIssue ? 'Describe the issue...' : 'Any additional notes...'} style={{ ...inp, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <button onClick={handleSubmit} disabled={saving || !canSubmit} style={{ width: '100%', padding: 16, background: canSubmit ? '#C8102E' : '#e5e7eb', color: canSubmit ? 'white' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default' }}>
          {saving ? 'Submitting...' : submitted ? 'Update Report' : 'Submit End-of-Shift Report'}
        </button>
      </div>
      <div style={{ marginTop: 32, textAlign: 'center', color: '#ddd', fontSize: 11 }}>nVent Hoffman · Molding · Shift {user.shift || shift}</div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('moldingLang') || null);
  const [screen, setScreen] = useState(() => localStorage.getItem('moldingLang') ? 'login' : 'language');
  const [user, setUser] = useState(null);
  const [operators, setOperators] = useState([]);
  const [goals, setGoals] = useState({ ...DEFAULT_GOALS });
  const [lastReport, setLastReport] = useState(null);
  const [parts, setParts] = useState([]);
  const [settings, setSettings] = useState({ ehGoal: 47.5 });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [appLoading, setAppLoading] = useState(false);

  const selectLang = l => { localStorage.setItem('moldingLang', l); setLang(l); setScreen('login'); };
  const toggleLang = () => {
    const nl = lang === 'en' ? 'es' : 'en';
    localStorage.setItem('moldingLang', nl); setLang(nl); setLoginError('');
  };

  const handleLogin = async (username, password) => {
    setLoginError(''); setLoginLoading(true);

    // Retry logic for GAS cold start
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await gasCall('login', { username, password });
        break;
      } catch {
        if (attempt === 0) {
          setLoginError('Connecting to server, please wait...');
          await new Promise(r => setTimeout(r, 2500));
          setLoginError('');
        } else {
          setLoginLoading(false);
          setLoginError(tx(lang || 'en', 'networkErr'));
          return;
        }
      }
    }

    if (!result.success) {
      setLoginError(tx(lang || 'en', 'invalidCreds'));
      setLoginLoading(false);
      return;
    }

    setUser(result.user);
    setLoginLoading(false);

    // Viewer — no extra data needed
    if (result.user.role === ROLES.VIEWER) {
      setScreen('viewer');
      return;
    }

    // Operator — only needs operators list + parts for their shift
    if (result.user.role === 'operator') {
      setAppLoading(true);
      const opShift = result.user.shift || 2;
      const [opR, prR] = await Promise.allSettled([
        gasCall('getOperators', { shift: opShift }),
        gasCall('getParts'),
      ]);
      if (opR.status === 'fulfilled' && opR.value?.success) setOperators(opR.value.operators);
      if (prR.status === 'fulfilled' && prR.value?.success) setParts(prR.value.parts);
      setAppLoading(false);
      setScreen('operator');
      return;
    }

    setAppLoading(true);

    // Shift filter — admin sees all, everyone else sees their shift only
    const shift = result.user.role !== ROLES.ADMIN ? result.user.shift : null;

    const settled = await Promise.allSettled([
      gasCall('getOperators', shift ? { shift } : {}),
      gasCall('getGoals'),
      gasCall('getLastReport', shift ? { shift } : {}),
      gasCall('getParts'),
      gasCall('getSettings'),
    ]);

    const [opR, goR, lrR, prR, stR] = settled;

    if (opR.status === 'fulfilled' && opR.value?.success) setOperators(opR.value.operators);
    if (goR.status === 'fulfilled' && goR.value?.success) {
      setGoals(prev => {
        const m = { ...prev };
        Object.keys(goR.value.goals).forEach(k => { m[parseInt(k, 10)] = parseInt(goR.value.goals[k], 10); });
        return m;
      });
    }
    if (lrR.status === 'fulfilled' && lrR.value?.success) setLastReport(lrR.value.report);
    if (prR.status === 'fulfilled' && prR.value?.success) setParts(prR.value.parts);
    if (stR.status === 'fulfilled' && stR.value?.success) setSettings(stR.value.settings);

    setAppLoading(false);
    setScreen(result.user.role === ROLES.LEAD ? 'lead' : 'manager');
  };

  const handleLogout = () => { setUser(null); setLoginError(''); setScreen('login'); };

  if (appLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'white' }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ width: 36, height: 4, background: '#C8102E', margin: '0 auto 16px', borderRadius: 2 }}></div>
          {tx(lang || 'en', 'loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrap">
      {screen === 'language' && <LanguageScreen onSelect={selectLang} />}
      {screen === 'login' && (
        <LoginScreen lang={lang || 'en'} onLogin={handleLogin} onLangToggle={toggleLang}
          loading={loginLoading} error={loginError} />
      )}
      {screen === 'lead' && user && (
        <LeadView lang={lang} user={user} operators={operators} goals={goals} parts={parts}
          ehGoal={settings.ehGoal || 47.5} lastReport={lastReport} onLogout={handleLogout} />
      )}
      {screen === 'manager' && user && (
        <ManagerView lang={lang} user={user} operators={operators} setOperators={setOperators}
          goals={goals} setGoals={setGoals} parts={parts} setParts={setParts}
          settings={settings} setSettings={setSettings} lastReport={lastReport}
          onLogout={handleLogout} />
      )}
      {screen === 'viewer' && user && (
        <ViewerView lang={lang} user={user} onLogout={handleLogout} />
      )}
      {screen === 'operator' && user && (
        <OperatorScreen lang={lang} user={user} operators={operators} parts={parts}
          shift={user.shift || 2} onLogout={handleLogout} />
      )}
    </div>
  );
}
