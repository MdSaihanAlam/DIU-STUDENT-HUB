import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Bell, Camera, KeyRound, LogOut, MonitorSmartphone, Settings2, Shield, Trash2, User, UserX } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, ConfirmDialog, PageHeader, PasswordStrength, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { DepartmentSelect } from '../../components/common.jsx';
import { PasswordField } from '../auth/AuthShell.jsx';
import { formatDate } from '../../utils/format.js';

function ProfileSection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    department: user.department?._id || '',
    program: user.program || '',
    batch: user.batch || '',
    headline: user.headline || '',
    bio: user.bio || '',
    skills: (user.skills || []).join(', '),
    links: { linkedin: user.links?.linkedin || '', github: user.links?.github || '', website: user.links?.website || '', orcid: user.links?.orcid || '' },
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setLink = (k) => (e) => setForm((f) => ({ ...f, links: { ...f.links, [k]: e.target.value } }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.patch('/users/me', form);
      setUser(r.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error('Photo must be under 3 MB');
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      const r = await api.post('/users/me/avatar', fd);
      setUser(r.user);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err);
    } finally {
      setUploading(false);
    }
  };
  const removePhoto = async () => {
    try {
      const r = await api.del('/users/me/avatar');
      setUser(r.user);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <div className="row" style={{ gap: 16 }}>
        <Avatar user={user} size="lg" />
        <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
          {uploading ? <span className="spinner" /> : <Camera size={15} aria-hidden="true" />} Change photo
          <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => (upload(e.target.files[0]), (e.target.value = ''))} />
        </label>
        {user.avatarUrl && (
          <Button size="sm" variant="ghost" onClick={removePhoto}>
            Remove
          </Button>
        )}
      </div>
      <div className="form-grid">
        <TextField label="Full name" required value={form.name} onChange={set('name')} minLength={2} maxLength={80} />
        <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select department" />
        <TextField label="Program / designation" value={form.program} onChange={set('program')} maxLength={80} />
        <TextField label="Batch / year" value={form.batch} onChange={set('batch')} maxLength={30} />
      </div>
      <TextField label="Headline" value={form.headline} onChange={set('headline')} maxLength={140} />
      <TextField as="textarea" label="Bio" value={form.bio} onChange={set('bio')} maxLength={1000} />
      <TextField label="Skills" value={form.skills} onChange={set('skills')} hint="Comma-separated" />
      <div className="form-grid">
        <TextField label="LinkedIn" type="url" value={form.links.linkedin} onChange={setLink('linkedin')} />
        <TextField label="GitHub" type="url" value={form.links.github} onChange={setLink('github')} />
        <TextField label="Website" type="url" value={form.links.website} onChange={setLink('website')} />
        <TextField label="ORCID iD" value={form.links.orcid} onChange={setLink('orcid')} placeholder="0000-0000-0000-0000" />
      </div>
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={busy}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PrivacySection() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [privacy, setPrivacy] = useState(user.privacy);
  const [prefs, setPrefs] = useState(user.notificationPrefs);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.patch('/users/me/settings', { privacy, notificationPrefs: prefs });
      setUser(r.user);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="row mb-0">
          <Shield size={18} aria-hidden="true" /> Privacy
        </h2>
        <SelectField
          label="Who can see your full profile?"
          value={privacy.profileVisibility}
          onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
          options={[
            ['members', 'All signed-in members'],
            ['connections', 'Only my connections'],
            ['private', 'Only me (others see name and photo only)'],
          ]}
        />
        <SelectField
          label="Who can message you?"
          value={privacy.allowMessagesFrom}
          onChange={(e) => setPrivacy({ ...privacy, allowMessagesFrom: e.target.value })}
          options={[
            ['everyone', 'Everyone (non-connections arrive as requests)'],
            ['connections', 'Only my connections'],
            ['nobody', 'Nobody'],
          ]}
          hint="People you contact about housing or research can still reply."
        />
        <label className="check">
          <input type="checkbox" checked={privacy.showEmail} onChange={(e) => setPrivacy({ ...privacy, showEmail: e.target.checked })} />
          <span>Show my email address on my profile</span>
        </label>
      </section>
      <section className="card stack">
        <h2 className="row mb-0">
          <Bell size={18} aria-hidden="true" /> Notifications
        </h2>
        {[
          ['social', 'Reactions, comments, replies, mentions and connection requests'],
          ['messages', 'New messages and housing or research enquiries'],
          ['moderation', 'Review results for my uploads, submissions and verification'],
          ['events', 'Reminders for saved events'],
          ['careers', 'Deadline reminders for saved opportunities'],
        ].map(([k, l]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={prefs[k] !== false} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />
            <span>{l}</span>
          </label>
        ))}
      </section>
      <div className="form-actions">
        <Button variant="primary" onClick={save} loading={busy}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

function SecuritySection() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success(r.message);
      setCurrent('');
      setNext('');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 className="row mb-0">
        <KeyRound size={18} aria-hidden="true" /> Change password
      </h2>
      <PasswordField label="Current password" value={current} onChange={setCurrent} id="cur-pw" />
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" id="new-pw" hint="At least 10 characters. Other sessions will be signed out." />
      <PasswordStrength value={next} />
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={busy} disabled={!current || next.length < 10}>
          Update password
        </Button>
      </div>
    </form>
  );
}

function SessionsSection() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const signOutAll = async () => {
    setBusy(true);
    try {
      await api.post('/auth/logout-all');
      await logout().catch(() => {});
      toast.success('Signed out on all devices');
      navigate('/login');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };
  return (
    <section className="card stack">
      <h2 className="row mb-0">
        <MonitorSmartphone size={18} aria-hidden="true" /> Sessions
      </h2>
      <dl className="kv">
        <dt>Last sign-in</dt>
        <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-GB') : '—'}</dd>
        <dt>Password changed</dt>
        <dd>{user.passwordChangedAt ? formatDate(user.passwordChangedAt) : '—'}</dd>
      </dl>
      <p className="small muted mb-0">If you used a shared or lost device, sign out everywhere. You will need to sign in again on every device, including this one.</p>
      <div>
        <Button icon={LogOut} onClick={signOutAll} loading={busy}>
          Sign out of all devices
        </Button>
      </div>
    </section>
  );
}

function VerificationSection() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi('/verification');
  const [affiliation, setAffiliation] = useState(user.affiliation);
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = data?.items.find((r) => r.status === 'pending');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/verification', { requestedAffiliation: affiliation, evidence });
      toast.success(r.message);
      setEvidence('');
      reload();
      refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="row mb-0">
          <BadgeCheck size={18} aria-hidden="true" /> Verification status
        </h2>
        <p className="mb-0">
          You are registered as <b>{user.affiliation}</b> —{' '}
          {user.affiliationVerified ? <Badge tone="primary">Verified</Badge> : <Badge>Not verified</Badge>}
        </p>
        <p className="small muted mb-0">Verified members get a badge, can submit career opportunities, and verified faculty can publish official announcements and events.</p>
      </section>
      {pending ? (
        <Alert tone="info">Your {pending.requestedAffiliation} verification request from {formatDate(pending.createdAt)} is waiting for review.</Alert>
      ) : (
        <form className="card stack" onSubmit={submit}>
          <h3 className="mb-0">Request verification</h3>
          <SelectField
            label="Affiliation to verify"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            options={[
              ['student', 'Current student'],
              ['faculty', 'Faculty member'],
              ['alumni', 'Alumni'],
            ]}
          />
          <TextField
            as="textarea"
            label="Evidence"
            required
            minLength={10}
            maxLength={1000}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            hint="Your official DIU email, student ID number, designation, or graduation year and department. Never share passwords, national ID or passport details."
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={busy} disabled={evidence.trim().length < 10}>
              Submit request
            </Button>
          </div>
        </form>
      )}
      {data?.items.filter((r) => r.status !== 'pending').length > 0 && (
        <section className="card">
          <h3>History</h3>
          <div className="list">
            {data.items
              .filter((r) => r.status !== 'pending')
              .map((r) => (
                <div key={r._id} className="list-item">
                  <span className="grow small">
                    {r.requestedAffiliation} · {formatDate(r.createdAt)}
                    {r.reviewNote && <span className="muted"> — {r.reviewNote}</span>}
                  </span>
                  <Badge tone={r.status === 'approved' ? 'success' : 'danger'}>{r.status}</Badge>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountSection() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const blocked = useApi('/users/me/blocked');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const unblock = async (id) => {
    try {
      await api.del(`/users/${id}/block`);
      blocked.reload();
    } catch (err) {
      toast.error(err);
    }
  };
  const requestDeletion = async () => {
    setBusy(true);
    try {
      const r = await api.post('/users/me/delete-request', { password: pw });
      toast.info(r.message);
      await logout().catch(() => {});
      navigate('/');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="card">
        <h2 className="row">
          <UserX size={18} aria-hidden="true" /> Blocked members
        </h2>
        <div className="list">
          {blocked.data?.items.map((u) => (
            <div key={u._id} className="list-item">
              <Avatar user={u} size="sm" />
              <span className="grow small bold">{u.name}</span>
              <Button size="sm" onClick={() => unblock(u._id)}>
                Unblock
              </Button>
            </div>
          ))}
          {blocked.data?.items.length === 0 && <p className="small muted mb-0">You haven’t blocked anyone.</p>}
        </div>
      </section>
      <section className="card stack" style={{ borderColor: 'var(--danger-soft)' }}>
        <h2 className="row mb-0" style={{ color: 'var(--danger)' }}>
          <Trash2 size={18} aria-hidden="true" /> Delete account
        </h2>
        <p className="small muted mb-0">Your account is deactivated immediately. After a 14-day grace period, your personal data is erased and your posts, listings and uploads are removed. Sign in within 14 days to cancel.</p>
        <div>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Request account deletion
          </Button>
        </div>
      </section>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={requestDeletion} title="Delete your account?" confirmLabel="Yes, delete my account" danger busy={busy}>
        <p className="mt-0">You will be signed out now. This can be cancelled by signing in again within 14 days.</p>
        <PasswordField label="Confirm with your password" value={pw} onChange={setPw} id="del-pw" />
      </ConfirmDialog>
    </div>
  );
}

export default function Settings() {
  useDocumentTitle('Settings');
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'profile';
  return (
    <div className="main-narrow" style={{ maxWidth: 820 }}>
      <PageHeader icon={Settings2} tone="blue" title="Settings" subtitle="Manage your profile, privacy, notifications and account." />
      <Tabs
        tabs={[
          { value: 'profile', label: 'Profile', icon: User },
          { value: 'privacy', label: 'Privacy & notifications', icon: Shield },
          { value: 'security', label: 'Security', icon: KeyRound },
          { value: 'verification', label: 'Verification', icon: BadgeCheck },
          { value: 'account', label: 'Account', icon: UserX },
        ]}
        value={tab}
        onChange={(v) => setSp({ tab: v }, { replace: true })}
      />
      {tab === 'profile' && <ProfileSection />}
      {tab === 'privacy' && <PrivacySection />}
      {tab === 'security' && (
        <div className="stack">
          <SecuritySection />
          <SessionsSection />
        </div>
      )}
      {tab === 'verification' && <VerificationSection />}
      {tab === 'account' && <AccountSection />}
    </div>
  );
}
