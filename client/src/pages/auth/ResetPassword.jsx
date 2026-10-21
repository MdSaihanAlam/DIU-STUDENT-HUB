import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { Alert, Button } from '../../components/ui.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell, PasswordField } from './AuthShell.jsx';

export default function ResetPassword() {
  useDocumentTitle('Choose a new password');
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Choose a new password</h1>
      {!token ? (
        <Alert tone="danger">This reset link is incomplete. Request a new one from the forgot-password page.</Alert>
      ) : done ? (
        <Alert tone="success" icon={CheckCircle2}>
          Password updated. <Link to="/login">Sign in</Link> with your new password.
        </Alert>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <Alert tone="danger">{error}</Alert>}
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" id="np" hint="At least 8 characters with letters and numbers." />
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" id="np2" />
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            Update password
          </Button>
        </form>
      )}
      <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>
        <Link to="/forgot-password">Request a new link</Link>
      </p>
    </AuthShell>
  );
}
