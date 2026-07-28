import { useState } from 'react';
import { gasCall } from './api';
import { tx } from './translations';
import { DEFAULT_GOALS, ROLES } from './constants';
import { LanguageScreen, LoginScreen } from './components/Auth';
import { LeadView } from './components/LeadViews';
import { ManagerView } from './components/ManagerView';
import { ViewerView } from './components/ViewerView';

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

    // Retry logic for GAS cold start — first call can timeout after idle period
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

    // Viewer only needs basic data
    if (result.user.role === ROLES.VIEWER) {
      setScreen('viewer');
      return;
    }

    setAppLoading(true);

    // Shift filter — admin sees all, everyone else sees their shift only
    const shift = result.user.role !== ROLES.ADMIN ? result.user.shift : null;

    // Load all data independently — one failure won't block the rest
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
    </div>
  );
}
