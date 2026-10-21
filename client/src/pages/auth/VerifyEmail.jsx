import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Spinner } from '../../components/ui.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell } from './AuthShell.jsx';

export default function VerifyEmail() {
  useDocumentTitle('Verify email');
  const [sp] = useSearchParams();
  const { refresh, isAuthenticated } = useAuth();
  const [state, setState] = useState({ status: 'loading', message: '' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // tokens are single-use; avoid StrictMode double submit
    ran.current = true;
    const token = sp.get('token');
    if (!token) return setState({ status: 'error', message: 'This verification link is incomplete.' });
    api
      .post('/auth/verify-email', { token })
      .then((r) => {
        setState({ status: 'ok', message: r.message });
        refresh();
      })
      .catch((e) => setState({ status: 'error', message: e.message }));
  }, [sp, refresh]);

  return (
    <AuthShell>
      <h1>Email verification</h1>
      {state.status === 'loading' && <Spinner />}
      {state.status === 'ok' && (
        <Alert tone="success" icon={CheckCircle2}>
          {state.message}
        </Alert>
      )}
      {state.status === 'error' && <Alert tone="danger">{state.message}</Alert>}
      <p style={{ marginTop: 20 }}>
        <Link to={isAuthenticated ? '/feed' : '/login'} className="btn btn-primary">
          Continue
        </Link>
      </p>
    </AuthShell>
  );
}
