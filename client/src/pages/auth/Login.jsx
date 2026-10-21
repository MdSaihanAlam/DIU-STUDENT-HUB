import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Button, TextField } from '../../components/ui.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell, PasswordField } from './AuthShell.jsx';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/feed');

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.onboarded ? safeNext(sp.get('next')) : '/onboarding', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Welcome back</h1>
      <p className="muted">Sign in to your DIU Student Hub account.</p>
      <form className="stack" onSubmit={submit} noValidate={false}>
        {error && (
          <Alert tone="danger" icon={AlertCircle}>
            {error}
          </Alert>
        )}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        <PasswordField value={password} onChange={setPassword} />
        <div className="row between">
          <span />
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Sign in
        </Button>
      </form>
      <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>
        New here? <Link to="/register">Create an account</Link>
      </p>
      {import.meta.env.DEV && (
        <div className="card card-tight stack" style={{ marginTop: 16, gap: 8 }}>
          <div className="xs subtle">Development only — fill in a seeded demo account:</div>
          <div className="row-wrap" style={{ gap: 6 }}>
            {['student', 'faculty', 'alumni', 'moderator', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                className="chip"
                style={{ minHeight: 28 }}
                onClick={() => {
                  setEmail(`${r}@demo.diuhub.test`);
                  setPassword('DemoPass123');
                  setError('');
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
