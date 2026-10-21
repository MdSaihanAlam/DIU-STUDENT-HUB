import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, ClipboardList, Flag, History, LayoutDashboard, Pencil, Plus, Shield, Sparkles, Trash2, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDebounce, useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Alert, Badge, Button, CardSkeleton, Dialog, EmptyState, ErrorState, LoadMore, PageHeader, SearchInput, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { DepartmentSelect, useDepartments } from '../../components/common.jsx';
import { REPORT_REASONS, label } from '../../utils/constants.js';
import { formatDate, humanize, timeAgo } from '../../utils/format.js';

/** Small dialog asking for an optional note before a moderation decision. */
function DecisionDialog({ open, onClose, onConfirm, title, confirmLabel = 'Confirm', danger, requireNote, children }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await onConfirm(note);
    setBusy(false);
    setNote('');
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={go} loading={busy} disabled={requireNote && note.trim().length < 3}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack">
        {children}
        <TextField as="textarea" label={requireNote ? 'Reason (required)' : 'Note to the member (optional)'} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
      </div>
    </Dialog>
  );
}

function Overview({ stats, go }) {
  if (!stats) return <CardSkeleton count={1} lines={2} avatar={false} />;
  const tiles = [
    ['Members', stats.users, null],
    ['Verification requests', stats.pendingVerifications, 'verifications'],
    ['Open reports', stats.openReports, 'reports'],
    ['Pending resources', stats.queue.resources, 'queue'],
    ['Pending research', stats.queue.research, 'queue'],
    ['Pending opportunities', stats.queue.careers, 'queue'],
    ['Pending events', stats.queue.events, 'queue'],
    ['Deletion requests', stats.deletionRequests, 'users'],
  ];
  return (
    <div className="admin-stats">
      {tiles.map(([l, n, tab]) => (
        <button key={l} className="card card-link" style={{ textAlign: 'left', cursor: tab ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }} onClick={() => tab && go(tab)} disabled={!tab}>
          <div className="stat">
            <strong style={{ color: n && tab ? 'var(--primary)' : undefined }}>{n}</strong>
            <span>{l}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function Verifications({ onChange }) {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const list = usePaginated('/admin/verifications', { status });
  const [deciding, setDeciding] = useState(null);
  const decide = async (note) => {
    try {
      await api.post(`/admin/verifications/${deciding.item._id}`, { decision: deciding.decision, note });
      toast.success(deciding.decision === 'approve' ? 'Verified' : 'Rejected');
      list.removeItem(deciding.item._id);
      onChange();
    } catch (err) {
      toast.error(err);
    }
    setDeciding(null);
  };
  return (
    <>
      <Tabs
        tabs={['pending', 'approved', 'rejected'].map((s) => ({ value: s, label: humanize(s) }))}
        value={status}
        onChange={setStatus}
      />
      {list.loading ? (
        <CardSkeleton count={2} lines={2} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={BadgeCheck} title="No requests" />
        </div>
      ) : (
        <div className="stack">
          {list.items.map((r) => (
            <div key={r._id} className="card queue-item">
              <div className="grow" style={{ minWidth: 240 }}>
                <div className="row-wrap">
                  <Link to={`/u/${r.user?._id}`} className="bold">
                    {r.user?.name}
                  </Link>
                  <Badge tone="primary">wants: {r.requestedAffiliation}</Badge>
                  <span className="xs subtle">{timeAgo(r.createdAt)}</span>
                </div>
                <div className="xs muted">
                  {r.user?.email} · {r.user?.department?.code || 'No dept'} · {r.user?.program || ''} {r.user?.batch || ''}
                </div>
                <p className="small pre-wrap" style={{ margin: '8px 0 0', background: 'var(--bg-subtle)', padding: 10, borderRadius: 8 }}>
                  {r.evidence}
                </p>
                {r.reviewer && (
                  <p className="xs subtle mb-0">
                    Reviewed by {r.reviewer.name} {r.reviewNote && `— ${r.reviewNote}`}
                  </p>
                )}
              </div>
              {status === 'pending' && (
                <div className="row">
                  <Button variant="primary" size="sm" onClick={() => setDeciding({ item: r, decision: 'approve' })}>
                    Approve
                  </Button>
                  <Button size="sm" onClick={() => setDeciding({ item: r, decision: 'reject' })}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <DecisionDialog open={!!deciding} onClose={() => setDeciding(null)} onConfirm={decide} title={deciding?.decision === 'approve' ? 'Approve verification' : 'Reject verification'} confirmLabel={deciding?.decision === 'approve' ? 'Approve' : 'Reject'} danger={deciding?.decision === 'reject'}>
        <p className="small muted mb-0">Verify against official sources (e.g. the DIU email domain or published faculty lists) before approving.</p>
      </DecisionDialog>
    </>
  );
}

const TARGET_LINK = { post: (id) => `/posts/${id}`, resource: (id) => `/resources/${id}`, housing: (id) => `/housing/${id}`, research: (id) => `/research/${id}`, career: (id) => `/careers/${id}`, event: (id) => `/events/${id}`, user: (id) => `/u/${id}` };

function Reports({ onChange }) {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [reason, setReason] = useState('');
  const list = usePaginated('/admin/reports', { status, reason });
  const [acting, setActing] = useState(null);
  const act = async (note) => {
    try {
      await api.post(`/admin/reports/${acting.item._id}`, { action: acting.action, note });
      toast.success('Report handled');
      list.reload();
      onChange();
    } catch (err) {
      toast.error(err);
    }
    setActing(null);
  };
  return (
    <>
      <div className="row-wrap between">
        <Tabs tabs={['open', 'actioned', 'dismissed'].map((s) => ({ value: s, label: humanize(s) }))} value={status} onChange={setStatus} />
        <select className="select" style={{ width: 'auto' }} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Filter by reason">
          <option value="">All reasons</option>
          {REPORT_REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {list.loading ? (
        <CardSkeleton count={2} lines={2} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Flag} title="No reports" />
        </div>
      ) : (
        <div className="stack">
          {list.items.map((r) => (
            <div key={r._id} className="card queue-item">
              <div className="grow" style={{ minWidth: 240 }}>
                <div className="row-wrap">
                  <Badge tone="danger">{label(REPORT_REASONS, r.reason)}</Badge>
                  <Badge>{r.targetType}</Badge>
                  {r.preview?.state && <Badge>{r.preview.state}</Badge>}
                  <span className="xs subtle">
                    by {r.reporter?.name} · {timeAgo(r.createdAt)}
                  </span>
                </div>
                <p className="small" style={{ margin: '8px 0 4px' }}>
                  {r.preview ? (
                    TARGET_LINK[r.targetType] ? (
                      <Link to={TARGET_LINK[r.targetType](r.targetId)} target="_blank">
                        “{r.preview.text || '(no text)'}”
                      </Link>
                    ) : (
                      `“${r.preview.text}”`
                    )
                  ) : (
                    <span className="muted">Item no longer exists</span>
                  )}
                </p>
                {r.details && <p className="xs muted mb-0">Reporter: {r.details}</p>}
                {r.takedown?.claimantName && (
                  <p className="xs muted mb-0">
                    Copyright claim by {r.takedown.claimantName} — original: {r.takedown.originalWork} {r.takedown.goodFaith && '(good-faith statement confirmed)'}
                  </p>
                )}
                {r.resolvedBy && (
                  <p className="xs subtle mb-0">
                    Handled by {r.resolvedBy.name} {r.resolutionNote && `— ${r.resolutionNote}`}
                  </p>
                )}
              </div>
              {status === 'open' && (
                <div className="row-wrap">
                  <Button size="sm" onClick={() => setActing({ item: r, action: 'dismiss' })}>
                    Dismiss
                  </Button>
                  {r.targetType !== 'user' && r.targetType !== 'message' && (
                    <Button size="sm" variant="danger" onClick={() => setActing({ item: r, action: 'remove_content' })}>
                      Remove content
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setActing({ item: r, action: 'suspend_user' })}>
                    Suspend author
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <DecisionDialog
        open={!!acting}
        onClose={() => setActing(null)}
        onConfirm={act}
        title={acting?.action === 'dismiss' ? 'Dismiss report' : acting?.action === 'remove_content' ? 'Remove reported content' : 'Suspend the author'}
        confirmLabel={humanize(acting?.action || '')}
        danger={acting?.action !== 'dismiss'}
        requireNote={acting?.action === 'suspend_user'}
      >
        <p className="small muted mb-0">All open reports about the same item are resolved together. This action is recorded in the audit log.</p>
      </DecisionDialog>
    </>
  );
}

const QUEUE_TYPES = [
  ['resources', 'Resources', (d) => `/resources/${d._id}`, 'uploader'],
  ['research', 'Research', (d) => `/research/${d._id}`, 'lead'],
  ['careers', 'Opportunities', (d) => `/careers/${d._id}`, 'postedBy'],
  ['events', 'Events', (d) => `/events/${d._id}`, 'postedBy'],
];

function Queue({ onChange }) {
  const toast = useToast();
  const [type, setType] = useState('resources');
  const cfg = QUEUE_TYPES.find((q) => q[0] === type);
  const list = usePaginated(`/admin/queue/${type}`, {});
  const [deciding, setDeciding] = useState(null);
  const [verified, setVerified] = useState(true);
  const decide = async (note) => {
    try {
      await api.post(`/admin/queue/${type}/${deciding.item._id}`, { decision: deciding.decision, note, verified });
      toast.success(deciding.decision === 'approve' ? 'Approved' : 'Rejected');
      list.removeItem(deciding.item._id);
      onChange();
    } catch (err) {
      toast.error(err);
    }
    setDeciding(null);
  };
  return (
    <>
      <Tabs tabs={QUEUE_TYPES.map(([v, l]) => ({ value: v, label: l }))} value={type} onChange={setType} />
      {list.loading ? (
        <CardSkeleton count={2} lines={2} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={ClipboardList} title="Queue is empty" />
        </div>
      ) : (
        <div className="stack">
          {list.items.map((d) => {
            const owner = d[cfg[3]];
            return (
              <div key={d._id} className="card queue-item">
                <div className="grow" style={{ minWidth: 240 }}>
                  <Link to={cfg[2](d)} target="_blank" className="bold">
                    {d.title}
                  </Link>
                  <div className="xs muted">
                    by {owner?.name} {owner?.affiliationVerified ? '(verified)' : '(unverified)'} · {timeAgo(d.createdAt)}
                  </div>
                  <p className="small muted clamp-3" style={{ margin: '6px 0 0' }}>
                    {d.abstract || d.description || [d.courseCode, d.courseTitle, d.attribution && `Attribution: ${d.attribution}`].filter(Boolean).join(' · ')}
                  </p>
                  {(d.sourceUrl || d.applyUrl) && (
                    <p className="xs mb-0">
                      Source:{' '}
                      <a href={d.sourceUrl || d.applyUrl} target="_blank" rel="noopener noreferrer">
                        {d.sourceUrl || d.applyUrl}
                      </a>
                    </p>
                  )}
                </div>
                <div className="row">
                  <Button variant="primary" size="sm" onClick={() => setDeciding({ item: d, decision: 'approve' })}>
                    Approve
                  </Button>
                  <Button size="sm" onClick={() => setDeciding({ item: d, decision: 'reject' })}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <DecisionDialog open={!!deciding} onClose={() => setDeciding(null)} onConfirm={decide} title={deciding?.decision === 'approve' ? 'Approve submission' : 'Reject submission'} confirmLabel={deciding?.decision === 'approve' ? 'Approve' : 'Reject'} danger={deciding?.decision === 'reject'}>
        {type === 'careers' && deciding?.decision === 'approve' && (
          <label className="check">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            <span>I checked the source — mark as verified</span>
          </label>
        )}
        {type === 'resources' && <p className="small muted mb-0">Check for copyright problems, live exam papers and broken files before approving.</p>}
      </DecisionDialog>
    </>
  );
}

function UsersTab({ onChange }) {
  const toast = useToast();
  const { isAdmin, user: me } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const list = usePaginated('/admin/users', { q: dq, status, role }, { limit: 25 });
  const [suspending, setSuspending] = useState(null);
  const run = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      list.reload();
      onChange();
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or email" label="Search users" />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deletion_requested">Deletion requested</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">Any role</option>
          <option value="member">Member</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Affiliation</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((u) => (
              <tr key={u._id}>
                <td>
                  <Link to={`/u/${u._id}`} className="bold">
                    {u.name}
                  </Link>
                  <div className="xs muted">{u.email}</div>
                </td>
                <td>
                  {u.affiliation} {u.affiliationVerified && <BadgeCheck size={14} style={{ display: 'inline', color: 'var(--primary)' }} aria-label="verified" />}
                  <div className="xs muted">{u.department?.code}</div>
                </td>
                <td>
                  {isAdmin && u._id !== me._id ? (
                    <select className="select" style={{ minHeight: 32, padding: '4px 30px 4px 8px', width: 'auto' }} value={u.role} onChange={(e) => run(() => api.patch(`/admin/users/${u._id}/role`, { role: e.target.value }), 'Role updated')} aria-label={`Role for ${u.name}`}>
                      <option value="member">member</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    u.role
                  )}
                </td>
                <td>
                  <Badge tone={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'danger' : 'warning'}>{humanize(u.status)}</Badge>
                  {u.suspendedReason && <div className="xs muted">{u.suspendedReason}</div>}
                </td>
                <td className="small">{formatDate(u.createdAt)}</td>
                <td>
                  <div className="row">
                    {u.status === 'active' && u._id !== me._id && u.role !== 'admin' && (
                      <Button size="sm" variant="ghost" onClick={() => setSuspending(u)}>
                        Suspend
                      </Button>
                    )}
                    {u.status === 'suspended' && (
                      <Button size="sm" onClick={() => run(() => api.post(`/admin/users/${u._id}/restore`), 'Account restored')}>
                        Restore
                      </Button>
                    )}
                    {u.status === 'deletion_requested' && isAdmin && (
                      <Button size="sm" variant="danger" onClick={() => run(() => api.post(`/admin/users/${u._id}/process-deletion`), 'Account erased')}>
                        Erase now
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <DecisionDialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        title={`Suspend ${suspending?.name}?`}
        confirmLabel="Suspend"
        danger
        requireNote
        onConfirm={async (reason) => {
          await run(() => api.post(`/admin/users/${suspending._id}/suspend`, { reason }), 'Account suspended');
          setSuspending(null);
        }}
      >
        <p className="small muted mb-0">They will be signed out immediately and cannot sign in until restored.</p>
      </DecisionDialog>
    </>
  );
}

function Featured() {
  const toast = useToast();
  const { data, reload, loading } = useApi('/admin/featured');
  const toggle = async (type, id) => {
    try {
      await api.post(`/admin/feature/${type}/${id}`);
      reload();
    } catch (err) {
      toast.error(err);
    }
  };
  if (loading) return <CardSkeleton count={1} lines={4} avatar={false} />;
  return (
    <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
      <section className="card">
        <h3>Verified research</h3>
        <div className="list">
          {data.research.map((r) => (
            <div key={r._id} className="list-item">
              <span className="grow small">{r.title}</span>
              <Button size="sm" variant={r.featured ? 'soft' : 'ghost'} icon={Sparkles} onClick={() => toggle('research', r._id)}>
                {r.featured ? 'Featured' : 'Feature'}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>Alumni success stories</h3>
        <div className="list">
          {data.stories.map((s) => (
            <div key={s._id} className="list-item">
              <span className="grow small">
                {s.successStory?.title || 'Untitled'} <span className="muted">— {s.user?.name}</span>
              </span>
              <Button size="sm" variant={s.successStory?.featured ? 'soft' : 'ghost'} icon={Sparkles} onClick={() => toggle('story', s._id)}>
                {s.successStory?.featured ? 'Featured' : 'Feature'}
              </Button>
            </div>
          ))}
          {!data.stories.length && <p className="small muted mb-0">No stories yet.</p>}
        </div>
      </section>
    </div>
  );
}

function DepartmentDialog({ open, onClose, initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    code: initial?.code || '',
    faculty: initial?.faculty || '',
    overview: initial?.overview || '',
    researchAreas: (initial?.researchAreas || []).join(', '),
    officialUrl: initial?.officialUrl || '',
    curriculumUrl: initial?.curriculumUrl || '',
    programs: (initial?.programs || []).map((p) => `${p.level}: ${p.name}`).join('\n'),
    isDemo: initial?.isDemo ?? false,
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    setBusy(true);
    const programs = form.programs
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(undergraduate|graduate|diploma)\s*:\s*(.+)$/i);
        return m ? { level: m[1].toLowerCase(), name: m[2] } : { level: 'undergraduate', name: l };
      });
    try {
      if (initial?._id) await api.put(`/admin/departments/${initial._id}`, { ...form, programs });
      else await api.post('/admin/departments', { ...form, programs });
      toast.success('Department saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={initial?._id ? 'Edit department' : 'Add department'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} loading={busy}>Save</Button></>}>
      <div className="stack">
        <div className="form-grid">
          <TextField label="Name" required value={form.name} onChange={set('name')} />
          <TextField label="Code" required value={form.code} onChange={set('code')} maxLength={12} />
          <TextField label="Faculty" value={form.faculty} onChange={set('faculty')} />
          <TextField label="Official page URL" type="url" value={form.officialUrl} onChange={set('officialUrl')} />
          <TextField label="Curriculum URL" type="url" value={form.curriculumUrl} onChange={set('curriculumUrl')} />
        </div>
        <TextField as="textarea" label="Overview" value={form.overview} onChange={set('overview')} maxLength={3000} />
        <TextField label="Research areas" value={form.researchAreas} onChange={set('researchAreas')} hint="Comma-separated" />
        <TextField as="textarea" label="Programs" value={form.programs} onChange={set('programs')} hint="One per line, e.g. 'undergraduate: B.Sc. in CSE'" />
        <label className="check">
          <input type="checkbox" checked={form.isDemo} onChange={set('isDemo')} />
          <span>Contains sample (unverified) information</span>
        </label>
      </div>
    </Dialog>
  );
}

function FacultyDialog({ open, onClose, initial, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    designation: initial?.designation || '',
    designationVerified: !!initial?.designationVerified,
    department: initial?.department?._id || initial?.department || '',
    qualifications: (initial?.qualifications || []).join(', '),
    researchInterests: (initial?.researchInterests || []).join(', '),
    website: initial?.website || '',
    orcid: initial?.orcid || '',
    publicContact: initial?.publicContact || '',
    publications: (initial?.publications || []).map((p) => [p.title, p.venue, p.year, p.url].filter(Boolean).join(' | ')).join('\n'),
    verified: !!initial?.verified,
    isDemo: initial?.isDemo ?? false,
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const save = async () => {
    setBusy(true);
    const publications = form.publications
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title, venue, year, url] = l.split('|').map((s) => s.trim());
        return { title, venue, year: year ? Number(year) : undefined, url: url || undefined };
      });
    try {
      if (initial?._id) await api.put(`/admin/faculty/${initial._id}`, { ...form, publications });
      else await api.post('/admin/faculty', { ...form, publications });
      toast.success('Faculty profile saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={initial?._id ? 'Edit faculty profile' : 'Add faculty profile'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} loading={busy}>Save</Button></>}>
      <div className="stack">
        <Alert tone="warning">Only enter verified public information, or details the person has agreed to share.</Alert>
        <div className="form-grid">
          <TextField label="Name" required value={form.name} onChange={set('name')} />
          <TextField label="Designation" value={form.designation} onChange={set('designation')} />
          <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select department" required />
          <TextField label="Website" type="url" value={form.website} onChange={set('website')} />
          <TextField label="ORCID" value={form.orcid} onChange={set('orcid')} />
          <TextField label="Public contact" value={form.publicContact} onChange={set('publicContact')} hint="Officially published only" />
        </div>
        <TextField label="Qualifications" value={form.qualifications} onChange={set('qualifications')} hint="Comma-separated" />
        <TextField label="Research interests" value={form.researchInterests} onChange={set('researchInterests')} hint="Comma-separated" />
        <TextField as="textarea" label="Publications" value={form.publications} onChange={set('publications')} hint="One per line: Title | Venue | Year | URL" />
        <label className="check">
          <input type="checkbox" checked={form.designationVerified} onChange={set('designationVerified')} />
          <span>Designation verified against an official source</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.verified} onChange={set('verified')} />
          <span>Profile verified</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.isDemo} onChange={set('isDemo')} />
          <span>Sample / demonstration profile</span>
        </label>
      </div>
    </Dialog>
  );
}

function Directory() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const departments = useApi('/departments');
  const [dept, setDept] = useState('');
  const faculty = usePaginated('/faculty', { department: dept }, { limit: 30 });
  const [editDept, setEditDept] = useState(null);
  const [editFac, setEditFac] = useState(null);
  useDepartments();
  const delDept = async (d) => {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    try {
      await api.del(`/admin/departments/${d._id}`);
      departments.reload();
    } catch (err) {
      toast.error(err);
    }
  };
  const delFac = async (f) => {
    if (!window.confirm(`Delete ${f.name}?`)) return;
    try {
      await api.del(`/admin/faculty/${f._id}`);
      faculty.removeItem(f._id);
    } catch (err) {
      toast.error(err);
    }
  };
  const openFaculty = async (f) => {
    try {
      const { profile } = await api.get(`/faculty/${f._id}`);
      setEditFac(profile);
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <div className="stack-lg">
      <section className="card">
        <div className="section-title">
          <h3>Departments</h3>
          {isAdmin && (
            <Button size="sm" variant="soft" icon={Plus} onClick={() => setEditDept({})}>
              Add
            </Button>
          )}
        </div>
        <div className="list">
          {departments.data?.items.map((d) => (
            <div key={d._id} className="list-item">
              <Badge tone="primary">{d.code}</Badge>
              <span className="grow small bold">{d.name}</span>
              {d.isDemo && <Badge tone="warning">sample</Badge>}
              {isAdmin && (
                <>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditDept(d)} aria-label={`Edit ${d.name}`} />
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => delDept(d)} aria-label={`Delete ${d.name}`} />
                </>
              )}
            </div>
          ))}
        </div>
        {!isAdmin && <p className="xs subtle mb-0">Only administrators can edit departments.</p>}
      </section>
      <section className="card">
        <div className="section-title">
          <h3>Faculty directory</h3>
          <div className="row">
            <select className="select" style={{ width: 'auto' }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              <option value="">All</option>
              {departments.data?.items.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.code}
                </option>
              ))}
            </select>
            <Button size="sm" variant="soft" icon={Plus} onClick={() => setEditFac({})}>
              Add
            </Button>
          </div>
        </div>
        <div className="list">
          {faculty.items.map((f) => (
            <div key={f._id} className="list-item">
              <span className="grow small">
                <b>{f.name}</b> <span className="muted">· {f.designation} · {f.department?.code}</span>
              </span>
              {f.verified ? <Badge tone="success">verified</Badge> : <Badge>unverified</Badge>}
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openFaculty(f)} aria-label={`Edit ${f.name}`} />
              {isAdmin && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => delFac(f)} aria-label={`Delete ${f.name}`} />}
            </div>
          ))}
        </div>
        <LoadMore hasMore={faculty.hasMore} loading={faculty.loadingMore} onClick={faculty.loadMore} total={faculty.total} shown={faculty.items.length} />
      </section>
      {editDept && <DepartmentDialog open onClose={() => setEditDept(null)} initial={editDept} onSaved={departments.reload} />}
      {editFac && <FacultyDialog open onClose={() => setEditFac(null)} initial={editFac} onSaved={faculty.reload} />}
    </div>
  );
}

function Audit() {
  const list = usePaginated('/admin/audit', {}, { limit: 30 });
  if (list.loading) return <CardSkeleton count={1} lines={5} avatar={false} />;
  if (list.error) return <ErrorState error={list.error} />;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((a) => (
              <tr key={a._id}>
                <td className="small">{new Date(a.createdAt).toLocaleString('en-GB')}</td>
                <td className="small">
                  {a.actor?.name} <span className="muted">({a.actor?.role})</span>
                </td>
                <td>
                  <code className="small">{a.action}</code>
                  {a.meta && <div className="xs muted">{JSON.stringify(a.meta)}</div>}
                </td>
                <td className="xs muted">
                  {a.targetType} {a.targetId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.items.length && <EmptyState icon={History} title="No actions recorded yet" />}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </>
  );
}

export default function Admin() {
  useDocumentTitle('Admin & moderation');
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('overview');
  const stats = useApi('/admin/stats');
  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'verifications', label: 'Verification', icon: BadgeCheck, count: stats.data?.pendingVerifications },
    { value: 'reports', label: 'Reports', icon: Flag, count: stats.data?.openReports },
    { value: 'queue', label: 'Review queue', icon: ClipboardList, count: stats.data ? Object.values(stats.data.queue).reduce((a, b) => a + b, 0) : 0 },
    { value: 'users', label: 'Users', icon: Users },
    { value: 'featured', label: 'Featured', icon: Sparkles },
    { value: 'directory', label: 'Directory', icon: Building2 },
    ...(isAdmin ? [{ value: 'audit', label: 'Audit log', icon: History }] : []),
  ];
  return (
    <>
      <PageHeader icon={Shield} tone="violet" title="Admin & moderation" subtitle="All actions are permission-checked on the server and recorded in the audit log." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Admin sections" />
      {stats.error && <ErrorState error={stats.error} onRetry={stats.reload} />}
      {tab === 'overview' && <Overview stats={stats.data} go={setTab} />}
      {tab === 'verifications' && <Verifications onChange={stats.reload} />}
      {tab === 'reports' && <Reports onChange={stats.reload} />}
      {tab === 'queue' && <Queue onChange={stats.reload} />}
      {tab === 'users' && <UsersTab onChange={stats.reload} />}
      {tab === 'featured' && <Featured />}
      {tab === 'directory' && <Directory />}
      {tab === 'audit' && isAdmin && <Audit />}
    </>
  );
}
