import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Dialog } from './ui.jsx';

/** Shown when an API call returns 401 while the user believed they were signed in. */
export default function SessionExpiredDialog() {
  const { sessionExpired, clearExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goLogin = () => {
    clearExpired();
    navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
  };
  return (
    <Dialog
      open={sessionExpired}
      onClose={goLogin}
      title="Session expired"
      footer={
        <Button variant="primary" onClick={goLogin}>
          Sign in again
        </Button>
      }
    >
      <p className="muted mb-0">For your security you were signed out. Please sign in again to continue.</p>
    </Dialog>
  );
}
