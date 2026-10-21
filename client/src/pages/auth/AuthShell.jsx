import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, FlaskConical, ShieldCheck, Users } from 'lucide-react';
import { BrandMark } from '../../layouts/PublicLayout.jsx';
import { Field, IconTile } from '../../components/ui.jsx';

export function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="brand">
          <BrandMark />
          <span>DIU Student Hub</span>
        </Link>
        <div>
          <h2>
            Your campus,
            <br />
            <span className="gradient-text">connected.</span>
          </h2>
          <p style={{ maxWidth: 440, fontSize: '1.05rem', marginBottom: 32 }}>Notes, people, research, housing and careers — built by and for the Dhaka International University community.</p>
          <div className="auth-float" aria-hidden="true">
            <div className="glass row">
              <IconTile icon={BookOpen} size="sm" />
              <div>
                <div className="small bold" style={{ color: '#fff' }}>
                  CSE 221 · DP slides
                </div>
                <div className="xs">1.2k downloads · ★ 4.8</div>
              </div>
            </div>
            <div className="glass row">
              <IconTile icon={FlaskConical} size="sm" tone="violet" />
              <div>
                <div className="small bold" style={{ color: '#fff' }}>
                  Looking for collaborators
                </div>
                <div className="xs">Bangla NLP research</div>
              </div>
            </div>
            <div className="glass row">
              <IconTile icon={Users} size="sm" tone="cyan" />
              <div>
                <div className="small bold" style={{ color: '#fff' }}>
                  ML Study Group
                </div>
                <div className="xs">Thursday · Library</div>
              </div>
            </div>
          </div>
        </div>
        <ul className="auth-points" style={{ marginTop: 0 }}>
          <li>
            <ShieldCheck size={18} aria-hidden="true" /> Private by default · moderated · independent community project
          </li>
        </ul>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}

export function PasswordField({ label = 'Password', value, onChange, autoComplete = 'current-password', hint, error, id = 'password' }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} required>
      <div className="input-group">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required aria-invalid={error ? 'true' : undefined} />
        <button type="button" className="btn btn-ghost btn-icon btn-sm input-addon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </Field>
  );
}
