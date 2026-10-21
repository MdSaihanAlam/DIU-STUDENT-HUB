import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Button, Chips, Field, PasswordStrength, TextField } from '../../components/ui.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell, PasswordField } from './AuthShell.jsx';

const passwordIssues = (p) => (p.length < 10 ? ['at least 10 characters'] : []);

export default function Register() {
  useDocumentTitle('Join');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', affiliation: 'student', acceptTerms: false });
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  const issues = passwordIssues(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (issues.length) return;
    if (!form.acceptTerms) return setError('Please accept the terms and community guidelines.');
    setBusy(true);
    try {
      await register(form);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <span className="eyebrow-label">Join free</span>
      <h1 style={{ marginTop: 6 }}>Create your account</h1>
      <p className="muted">Join the DIU community in less than a minute.</p>
      <form className="stack" onSubmit={submit}>
        {error && (
          <Alert tone="danger" icon={AlertCircle}>
            {error}
          </Alert>
        )}
        <TextField label="Full name" value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} maxLength={80} autoFocus />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required hint="Your DIU email makes verification easier, but any email works." />
        <PasswordField label="Password" value={form.password} onChange={set('password')} autoComplete="new-password" id="new-password" hint="At least 10 characters. A short phrase is easiest to remember." error={touched && issues.length ? `Password needs ${issues.join(', ')}` : ''} />
        <PasswordStrength value={form.password} />
        <Field label="I am a">
          <Chips
            label="Affiliation"
            value={form.affiliation}
            onChange={set('affiliation')}
            options={[
              ['student', 'Student'],
              ['faculty', 'Faculty member'],
              ['alumni', 'Alumni'],
            ]}
          />
        </Field>
        {form.affiliation !== 'student' && (
          <Alert tone="info" icon={Info}>
            Faculty and alumni status is shown as <b>unverified</b> until a moderator approves your verification request (you can submit one in the next step).
          </Alert>
        )}
        <label className="check">
          <input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} required />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank">
              Terms
            </Link>
            ,{' '}
            <Link to="/privacy" target="_blank">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/guidelines" target="_blank">
              Community Guidelines
            </Link>
            .
          </span>
        </label>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Create account
        </Button>
      </form>
      <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
