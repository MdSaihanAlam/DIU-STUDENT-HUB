import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Briefcase, Eye, EyeOff, FlaskConical, Home, Users } from 'lucide-react';
import { BrandMark } from '../../layouts/PublicLayout.jsx';
import { Field } from '../../components/ui.jsx';

export function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="brand">
          <BrandMark />
          <span>DIU Student Hub</span>
        </Link>
        <div>
          <h2>Your campus, connected.</h2>
          <p style={{ maxWidth: 420 }}>Notes, people, research, housing and careers — built by and for the Dhaka International University community.</p>
          <ul className="auth-points">
            <li>
              <BookOpen size={18} aria-hidden="true" /> Share and find course notes and slides
            </li>
            <li>
              <Users size={18} aria-hidden="true" /> Join department, batch and study communities
            </li>
            <li>
              <FlaskConical size={18} aria-hidden="true" /> Discover research and find collaborators
            </li>
            <li>
              <Home size={18} aria-hidden="true" /> Find mess seats, sublets and roommates
            </li>
            <li>
              <Briefcase size={18} aria-hidden="true" /> Internships, jobs and alumni mentors
            </li>
          </ul>
        </div>
        <p className="xs" style={{ opacity: 0.7 }}>
          Independent community project — not officially operated or endorsed by Dhaka International University.
        </p>
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
