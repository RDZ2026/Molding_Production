import { useState } from 'react';
import { tx } from '../translations';

export function LanguageScreen({ onSelect }) {
  return (
    <div className="lang-screen">
      <div>
        <div className="lang-logo-accent"></div>
        <div className="lang-logo">nVent Hoffman</div>
        <div className="lang-dept">Molding Department</div>
      </div>
      <div style={{ fontSize: 15, color: '#555', textAlign: 'center' }}>Choose Language / Elige tu idioma</div>
      <div className="lang-btns">
        <button className="lang-btn" onClick={() => onSelect('en')}>English</button>
        <button className="lang-btn" onClick={() => onSelect('es')}>Español</button>
      </div>
    </div>
  );
}

export function LoginScreen({ lang, onLogin, onLangToggle, loading, error }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const submit = () => { if (!u.trim() || !p) return; onLogin(u.trim(), p); };
  return (
    <div className="login-screen">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="lang-logo-accent"></div>
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>nVent Hoffman</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 5 }}>Molding Report App</div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card">
          <div className="field">
            <label className="field-label" htmlFor="un">{tx(lang, 'username')}</label>
            <input id="un" type="text" autoCapitalize="none" autoCorrect="off" value={u} onChange={e => setU(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pw">{tx(lang, 'password')}</label>
            <input id="pw" type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <button className="btn btn-red" onClick={submit} disabled={loading}>
            {loading ? tx(lang, 'loading') : tx(lang, 'signIn')}
          </button>
        </div>
        <button className="lang-switch-btn" onClick={onLangToggle}>
          {lang === 'en' ? tx(lang, 'switchToEs') : tx(lang, 'switchToEn')}
        </button>
      </div>
    </div>
  );
}
