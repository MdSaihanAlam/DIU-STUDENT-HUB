import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Info } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Avatar, Button, TextField } from '../../components/ui.jsx';
import { DepartmentSelect } from '../../components/common.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { AuthShell } from './AuthShell.jsx';

export default function Onboarding() {
  useDocumentTitle('Set up your profile');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    department: user?.department?._id || '',
    program: user?.program || '',
    batch: user?.batch || '',
    headline: user?.headline || '',
  });
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const needsVerification = user?.affiliation !== 'student' && !user?.affiliationVerified && !user?.pendingVerification;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const uploadAvatar = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      const r = await api.post('/users/me/avatar', fd);
      setUser(r.user);
    } catch (err) {
      toast.error(err);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsVerification && evidence.trim().length >= 10) {
        await api.post('/verification', { requestedAffiliation: user.affiliation, evidence });
      }
      const r = await api.patch('/users/me', { ...form, onboarded: true });
      setUser(r.user);
      toast.success('Welcome to DIU Student Hub!');
      navigate('/feed', { replace: true });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1>Set up your profile</h1>
      <p className="muted">This helps classmates find you and personalises your feed. You can change it later.</p>
      <form className="stack" onSubmit={submit}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar user={user} size="lg" />
          <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
            {uploading ? <span className="spinner" /> : <Camera size={15} aria-hidden="true" />}
            {user?.avatarUrl ? 'Change photo' : 'Add a photo (optional)'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => uploadAvatar(e.target.files[0])} />
          </label>
        </div>
        <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select your department" required />
        <div className="form-grid">
          <TextField label={user?.affiliation === 'faculty' ? 'Designation' : 'Program / degree'} value={form.program} onChange={set('program')} maxLength={80} placeholder={user?.affiliation === 'faculty' ? 'e.g. Lecturer' : 'e.g. B.Sc. in CSE'} />
          <TextField label={user?.affiliation === 'alumni' ? 'Graduation year' : 'Batch / intake year'} value={form.batch} onChange={set('batch')} maxLength={30} placeholder="e.g. 2023" />
        </div>
        <TextField label="Headline" value={form.headline} onChange={set('headline')} maxLength={140} placeholder="e.g. CSE student interested in AI and web development" />

        {needsVerification && (
          <>
            <Alert tone="info" icon={Info}>
              You registered as <b>{user.affiliation}</b>. Moderators verify faculty and alumni before showing a verified badge or granting publishing privileges.
            </Alert>
            <TextField
              as="textarea"
              label="Verification details (optional now)"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={1000}
              hint="E.g. your official DIU email, designation, or graduation year and department. Do not upload national ID or passport details."
            />
          </>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!form.department}>
          Continue to the hub
        </Button>
      </form>
    </AuthShell>
  );
}
