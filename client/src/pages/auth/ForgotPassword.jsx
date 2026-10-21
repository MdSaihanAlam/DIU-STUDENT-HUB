import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { Alert, Button, TextField } from '../../components/ui.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell } from './AuthShell.jsx';

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/forgot-password', { email });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Reset your password</h1>
      <p className="muted">Enter your account email and we’ll send you a reset link.</p>
      {done ? (
        <Alert tone="success" icon={CheckCircle2}>
          {done}
        </Alert>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" />
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
