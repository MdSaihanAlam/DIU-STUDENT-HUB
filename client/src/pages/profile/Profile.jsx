import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, Check, ExternalLink, Flag, GraduationCap, HeartHandshake, Lock, Mail, MessageSquare, MoreHorizontal, Pencil, UserCheck, UserPlus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, CardSkeleton, ConfirmDialog, Dialog, EmptyState, ErrorState, LoadMore, Menu, MenuItem, Tabs, TextField, VerifiedBadge } from '../../components/ui.jsx';
import { MessageDialog, ReportDialog } from '../../components/common.jsx';
import PostCard from '../../features/posts/PostCard.jsx';
import { formatDate, humanize } from '../../utils/format.js';

function PostsTab({ userId }) {
  const list = usePaginated('/posts', { author: userId }, { limit: 10 });
  if (list.loading) return <CardSkeleton count={2} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.items.length)
    return (
      <div className="card">
        <EmptyState title="No posts yet" />
      </div>
    );
  return (
    <div className="stack">
      {list.items.map((p) => (
        <PostCard key={p._id} post={p} onChange={list.updateItem} onRemove={list.removeItem} />
      ))}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </div>
  );
}

function ContentTab({ userId, self }) {
  const { data, loading } = useApi(`/users/${userId}/content`);
  if (loading) return <CardSkeleton count={1} lines={3} />;
  return (
    <div className="stack">
      <section className="card">
        <h3>Uploaded resources</h3>
        <div className="list">
          {data.resources.map((r) => (
            <Link key={r._id} to={`/resources/${r._id}`} className="list-item" style={{ color: 'inherit' }}>
              <span className="grow small bold">{r.title}</span>
              {self && r.status !== 'approved' && <Badge tone="warning">{r.status}</Badge>}
              <span className="xs subtle">{r.downloads} downloads</span>
            </Link>
          ))}
          {!data.resources.length && <p className="small muted mb-0">No resources.</p>}
        </div>
      </section>
      <section className="card">
        <h3>Research projects</h3>
        <div className="list">
          {data.research.map((r) => (
            <Link key={r._id} to={`/research/${r._id}`} className="list-item" style={{ color: 'inherit' }}>
              <span className="grow small bold">{r.title}</span>
              {self && r.reviewStatus !== 'verified' && <Badge tone="warning">{r.reviewStatus}</Badge>}
              <Badge>{humanize(r.status)}</Badge>
            </Link>
          ))}
          {!data.research.length && <p className="small muted mb-0">No projects.</p>}
        </div>
      </section>
      {self && (
        <section className="card">
          <h3>My housing listings</h3>
          <div className="list">
            {data.housing.map((h) => (
              <Link key={h._id} to={`/housing/${h._id}`} className="list-item" style={{ color: 'inherit' }}>
                <span className="grow small bold">{h.title}</span>
                <Badge>{h.status}</Badge>
              </Link>
            ))}
            {!data.housing.length && <p className="small muted mb-0">No listings.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function AboutTab({ u }) {
  const a = u.alumni;
  return (
    <div className="stack">
      <section className="card">
        {u.bio ? <p className="pre-wrap">{u.bio}</p> : <p className="muted">No bio yet.</p>}
        <dl className="kv">
          <dt>Department</dt>
          <dd>{u.department ? <Link to={`/departments/${u.department.slug}`}>{u.department.name}</Link> : '—'}</dd>
          <dt>Program</dt>
          <dd>{u.program || '—'}</dd>
          <dt>Batch</dt>
          <dd>{u.batch || '—'}</dd>
          {u.email && (
            <>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${u.email}`}>{u.email}</a>
              </dd>
            </>
          )}
          <dt>Member since</dt>
          <dd>{formatDate(u.createdAt)}</dd>
        </dl>
        {u.skills?.length > 0 && (
          <div className="row-wrap" style={{ marginTop: 12 }}>
            {u.skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        )}
        {u.links && Object.values(u.links).some(Boolean) && (
          <div className="row-wrap" style={{ marginTop: 12 }}>
            {['linkedin', 'github', 'website'].map(
              (k) =>
                u.links[k] && (
                  <a key={k} className="btn btn-sm" href={u.links[k]} target="_blank" rel="noopener noreferrer">
                    {humanize(k)} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )
            )}
            {u.links.orcid && (
              <a className="btn btn-sm" href={`https://orcid.org/${u.links.orcid}`} target="_blank" rel="noopener noreferrer">
                ORCID <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </section>
      {a && (
        <section className="card stack">
          <h3 className="row mb-0">
            <GraduationCap size={18} aria-hidden="true" /> Alumni profile
          </h3>
          <dl className="kv">
            <dt>Graduated</dt>
            <dd>
              {a.graduationYear || '—'} {a.department?.code && `· ${a.department.code}`}
            </dd>
            <dt>Current role</dt>
            <dd>{[a.jobTitle, a.employer].filter(Boolean).join(' at ') || '—'}</dd>
            <dt>Industry</dt>
            <dd>{a.industry || '—'}</dd>
            {a.location && (
              <>
                <dt>Location</dt>
                <dd>{a.location}</dd>
              </>
            )}
            {a.contactEmail && (
              <>
                <dt>Contact</dt>
                <dd>
                  <a href={`mailto:${a.contactEmail}`}>{a.contactEmail}</a>
                </dd>
              </>
            )}
          </dl>
          {a.careerJourney && (
            <>
              <h4 className="mb-0">Career journey</h4>
              <p className="pre-wrap small mb-0">{a.careerJourney}</p>
            </>
          )}
          {a.achievements?.length > 0 && (
            <ul className="small" style={{ margin: 0 }}>
              {a.achievements.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          {a.advice && (
            <>
              <h4 className="mb-0">Advice for students</h4>
              <p className="pre-wrap small mb-0">{a.advice}</p>
            </>
          )}
          {a.referralsNote && (
            <Alert tone="info" icon={HeartHandshake}>
              {a.referralsNote}
            </Alert>
          )}
          <div className="row-wrap">
            {a.linkedin && (
              <a className="btn btn-sm" href={a.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            {a.website && (
              <a className="btn btn-sm" href={a.website} target="_blank" rel="noopener noreferrer">
                Website <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/users/${id}`);
  useDocumentTitle(data?.user?.name || 'Profile');
  const [tab, setTab] = useState('posts');
  const [messaging, setMessaging] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mentorMsg, setMentorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { user: u, relationship: rel } = data;
  const conn = rel.connection;

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast.success(msg);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const connectBtn = rel.self ? null : conn?.status === 'accepted' ? (
    <Button icon={UserCheck} onClick={() => act(() => api.del(`/users/connections/${conn._id}`), 'Connection removed')} loading={busy} title="Click to remove connection">
      Connected
    </Button>
  ) : conn?.status === 'pending' && conn.outgoing ? (
    <Button icon={Check} onClick={() => act(() => api.del(`/users/connections/${conn._id}`), 'Request withdrawn')} loading={busy}>
      Requested
    </Button>
  ) : conn?.status === 'pending' ? (
    <Button variant="primary" icon={UserPlus} onClick={() => act(() => api.post(`/users/connections/${conn._id}/respond`, { accept: true }), 'Connected')} loading={busy}>
      Accept request
    </Button>
  ) : (
    <Button variant="primary" icon={UserPlus} onClick={() => act(() => api.post(`/users/${u._id}/connect`, { kind: 'connection' }), 'Request sent')} loading={busy} disabled={rel.blocked}>
      Connect
    </Button>
  );

  return (
    <div className="main-narrow stack-lg" style={{ maxWidth: 820 }}>
      <section className="card card-flush">
        <div className="profile-cover" />
        <div className="profile-head">
          <div className="row-wrap" style={{ gap: 16 }}>
            <Avatar user={u} size="xl" />
            <div className="grow" style={{ minWidth: 200, paddingTop: 56 }}>
              <h1 className="mb-0">{u.name}</h1>
              <div className="row-wrap" style={{ marginTop: 4 }}>
                <VerifiedBadge user={u} />
                {u.department && <Badge>{u.department.code}</Badge>}
                {u.batch && <span className="small muted">Batch {u.batch}</span>}
              </div>
            </div>
          </div>
          {u.headline && <p style={{ margin: '12px 0 0' }}>{u.headline}</p>}
          {u.stats && (
            <div className="row-wrap" style={{ gap: 24, margin: '14px 0' }}>
              {[
                ['posts', 'Posts'],
                ['resources', 'Resources'],
                ['research', 'Projects'],
                ['connections', 'Connections'],
              ].map(([k, l]) => (
                <div key={k} className="stat">
                  <strong>{u.stats[k]}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          )}
          <div className="row-wrap">
            {rel.self ? (
              <>
                <Link to="/settings" className="btn btn-primary">
                  <Pencil size={16} aria-hidden="true" /> Edit profile
                </Link>
                {u.affiliation === 'alumni' && (
                  <Link to="/alumni/edit" className="btn">
                    <GraduationCap size={16} aria-hidden="true" /> Alumni profile
                  </Link>
                )}
              </>
            ) : (
              <>
                {connectBtn}
                {rel.canMessage && !rel.blocked && (
                  <Button icon={MessageSquare} onClick={() => setMessaging(true)}>
                    Message
                  </Button>
                )}
                {u.alumni?.mentorshipAvailable && !rel.blocked && (
                  <Button icon={HeartHandshake} onClick={() => setMentorOpen(true)} disabled={!!rel.mentorship}>
                    {rel.mentorship === 'pending' ? 'Mentorship requested' : rel.mentorship === 'accepted' ? 'Your mentor' : 'Request mentorship'}
                  </Button>
                )}
                <Menu label="More profile actions" trigger={({ toggle, ...aria }) => <Button icon={MoreHorizontal} onClick={toggle} {...aria} />}>
                  {rel.blocked ? (
                    <MenuItem icon={Ban} onClick={() => act(() => api.del(`/users/${u._id}/block`), 'Unblocked')}>
                      Unblock
                    </MenuItem>
                  ) : (
                    <MenuItem icon={Ban} danger onClick={() => setBlocking(true)}>
                      Block
                    </MenuItem>
                  )}
                  <MenuItem icon={Flag} onClick={() => setReporting(true)}>
                    Report profile
                  </MenuItem>
                </Menu>
              </>
            )}
          </div>
        </div>
      </section>

      {rel.blocked && <Alert tone="warning">You blocked this member. Unblock them to interact again.</Alert>}

      {u.limited ? (
        <div className="card">
          <EmptyState icon={Lock} title="This profile is private">
            {u.name} only shares their full profile with {conn?.status === 'accepted' ? 'selected people' : 'connections'}.
          </EmptyState>
        </div>
      ) : (
        <>
          <Tabs
            tabs={[
              { value: 'posts', label: 'Posts' },
              { value: 'about', label: 'About' },
              { value: 'content', label: 'Resources & research' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'posts' && <PostsTab userId={u._id} />}
          {tab === 'about' && <AboutTab u={u} />}
          {tab === 'content' && <ContentTab userId={u._id} self={rel.self} />}
        </>
      )}

      <MessageDialog open={messaging} onClose={() => setMessaging(false)} user={u} />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={u._id} />
      <ConfirmDialog
        open={blocking}
        onClose={() => setBlocking(false)}
        onConfirm={() => act(() => api.post(`/users/${u._id}/block`), 'Member blocked').then(() => setBlocking(false))}
        title={`Block ${u.name}?`}
        confirmLabel="Block"
        danger
        busy={busy}
      >
        Their posts will be hidden from your feed and they won’t be able to message or connect with you. Any existing connection is removed.
      </ConfirmDialog>
      <Dialog
        open={mentorOpen}
        onClose={() => setMentorOpen(false)}
        title={`Request mentorship from ${u.name}`}
        footer={
          <>
            <Button onClick={() => setMentorOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={Mail}
              loading={busy}
              onClick={() => act(() => api.post(`/users/${u._id}/connect`, { kind: 'mentorship', message: mentorMsg }), 'Mentorship request sent').then(() => setMentorOpen(false))}
            >
              Send request
            </Button>
          </>
        }
      >
        <TextField as="textarea" label="What would you like guidance on?" value={mentorMsg} onChange={(e) => setMentorMsg(e.target.value)} maxLength={500} placeholder="Introduce yourself and what you hope to learn." />
      </Dialog>
    </div>
  );
}
