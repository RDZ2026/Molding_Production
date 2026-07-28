import { useState } from 'react';
import { gasCall } from './api';
import { tx } from './translations';
import { DEFAULT_GOALS } from './constants';
import { LanguageScreen, LoginScreen } from './components/Auth';
import { LeadView } from './components/LeadViews';
import { ManagerView } from './components/ManagerView';

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
  const toggleLang = () => { const nl = lang === 'en' ? 'es' : 'en'; localStorage.setItem('moldingLang', nl); setLang(nl); setLoginError(''); };

  const handleLogin = async (username, password) => {
    setLoginError(''); setLoginLoading(true);
    try {
      const result = await gasCall('login', { username, password });
      if (result.success) {
        setUser(result.user); setLoginLoading(false); setAppLoading(true);
        const [opR, goR, lrR, prR, stR] = await Promise.all([
          gasCall('getOperators'), gasCall('getGoals'), gasCall('getLastReport'),
          gasCall('getParts'), gasCall('getSettings'),
        ]);
        if (opR.success) setOperators(opR.operators);
        if (goR.success) setGoals(prev => { const m = { ...prev }; Object.keys(goR.goals).forEach(k => { m[parseInt(k, 10)] = parseInt(goR.goals[k], 10); }); return m; });
        if (lrR.success) setLastReport(lrR.report);
        if (prR.success) setParts(prR.parts);
        if (stR.success) setSettings(stR.settings);
        setAppLoading(false);
        setScreen(result.user.role === 'manager' ? 'manager' : 'lead');
      } else { setLoginError(tx(lang || 'en', 'invalidCreds')); setLoginLoading(false); }
    } catch { setLoginError(tx(lang || 'en', 'networkErr')); setLoginLoading(false); }
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
        <LoginScreen lang={lang || 'en'} onLogin={handleLogin} onLangToggle={toggleLang} loading={loginLoading} error={loginError} />
      )}
      {screen === 'lead' && user && (
        <LeadView lang={lang} user={user} operators={operators} goals={goals} parts={parts}
          ehGoal={settings.ehGoal || 47.5} lastReport={lastReport} onLogout={handleLogout} />
      )}
      {screen === 'manager' && user && (
        <ManagerView lang={lang} user={user} operators={operators} setOperators={setOperators}
          goals={goals} setGoals={setGoals} parts={parts} setParts={setParts}
          settings={settings} setSettings={setSettings} lastReport={lastReport} onLogout={handleLogout} />
      )}
    </div>
  );
}
