import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, ExternalLink, FileText, Handshake, Info, Pencil, Trash2, Upload } from 'lucide-react';
import { api, fileUrl } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, SampleBadge, TextField } from '../../components/ui.jsx';
import { MessageDialog, ReportButton, SaveButton, UserLine } from '../../components/common.jsx';
import { formatDate, humanize, timeAgo } from '../../utils/format.js';

const LINKS = [
  ['repo', 'Code repository'],
  ['dataset', 'Dataset'],
  ['paper', 'Paper'],
  ['preprint', 'Preprint'],
];

export default function ResearchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
  const { data, error, loading, reload, setData } = useApi(`/research/${id}`);
  const p = data?.project;
  useDocumentTitle(p?.title || 'Research');
  const [update, setUpdate] = useState('');
  const [busy, setBusy] = useState(false);
  const [collab, setCollab] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={8} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const patch = (x) => setData((d) => ({ project: { ...d.project, ...x } }));

  const follow = async () => {
    try {
      const r = await api.post(`/research/${id}/follow`);
      patch(r);
    } catch (err) {
      toast.error(err);
    }
  };

  const postUpdate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/research/${id}/updates`, { content: update });
      setUpdate('');
      toast.success('Update posted. Followers were notified.');
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.post(`/research/${id}/files`, fd);
      patch({ files: r.files });
      toast.success('File attached');
    } catch (err) {
      toast.error(err);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/research/${id}`);
      toast.success('Project deleted');
      navigate('/research');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <Link to="/research" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> Research hub
        </Link>
      </div>
      {p.reviewStatus !== 'verified' && (
        <Alert tone={p.reviewStatus === 'rejected' ? 'danger' : 'warning'} icon={Info}>
          {p.reviewStatus === 'pending'
            ? 'Unverified community submission: moderators have not yet reviewed this project. Treat its claims with care.'
            : `This project was not approved${p.reviewNote ? `: ${p.reviewNote}` : '.'}`}
        </Alert>
      )}
      {p.isDemo && (
        <Alert tone="warning" icon={Info}>
          Sample project for development. The people, results and publications are fictional.
        </Alert>
      )}

      <div className="detail-grid">
        <div className="stack-lg">
          <section className="card stack">
            <div className="row-wrap">
              <Badge tone="accent">{p.domain}</Badge>
              <Badge>{humanize(p.status)}</Badge>
              {p.reviewStatus === 'verified' && <Badge tone="success">Verified</Badge>}
              {p.featured && <Badge tone="violet">Featured</Badge>}
              <SampleBadge show={p.isDemo} />
            </div>
            <h1 className="mb-0">{p.title}</h1>
            <p className="pre-wrap mb-0">{p.abstract}</p>
            <div className="row-wrap">
              <Button variant={p.following ? 'soft' : 'primary'} icon={p.following ? BellOff : Bell} onClick={follow}>
                {p.following ? 'Following' : 'Follow'} · {p.followerCount}
              </Button>
              {p.collaborationOpen && !p.isLead && (
                <Button icon={Handshake} onClick={() => setCollab(true)}>
                  Request to collaborate
                </Button>
              )}
              <SaveButton type="research" id={p._id} saved={p.saved} size="" withLabel />
              {p.editable && (
                <Link to={`/research/${id}/edit`} className="btn">
                  <Pencil size={16} aria-hidden="true" /> Edit
                </Link>
              )}
              {(p.isLead || isStaff) && (
                <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                  Delete
                </Button>
              )}
              {!p.editable && <ReportButton targetType="research" targetId={p._id} size="" withLabel />}
            </div>
          </section>

          {(p.methodology || p.progress) && (
            <section className="card">
              {p.methodology && (
                <>
                  <h2>Methodology</h2>
                  <p className="pre-wrap">{p.methodology}</p>
                </>
              )}
              {p.progress && (
                <>
                  <h2>Results & current progress</h2>
                  <p className="pre-wrap mb-0">{p.progress}</p>
                </>
              )}
            </section>
          )}

          <section className="card stack">
            <h2 className="mb-0">Project updates</h2>
            {p.editable && (
              <form className="stack" onSubmit={postUpdate}>
                <TextField as="textarea" label="Post an update for followers" value={update} onChange={(e) => setUpdate(e.target.value)} maxLength={2000} rows={2} />
                <div className="form-actions">
                  <Button type="submit" variant="primary" size="sm" loading={busy} disabled={update.trim().length < 2}>
                    Post update
                  </Button>
                </div>
              </form>
            )}
            {p.updates.length === 0 && <p className="muted small mb-0">No updates yet.</p>}
            {p.updates.map((u) => (
              <div key={u._id} className="row" style={{ alignItems: 'flex-start' }}>
                <Avatar user={u.author} size="sm" />
                <div className="grow">
                  <div className="small">
                    <b>{u.author?.name}</b> <span className="subtle xs">{timeAgo(u.createdAt)}</span>
                  </div>
                  <p className="pre-wrap small mb-0">{u.content}</p>
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside className="stack-lg">
          <section className="card stack">
            <UserLine user={p.lead} meta="Project lead" />
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
              <dt>Department</dt>
              <dd>{p.department ? <Link to={`/departments/${p.department.slug}`}>{p.department.code}</Link> : '—'}</dd>
              <dt>Affiliation</dt>
              <dd>{humanize(p.affiliation)}</dd>
              <dt>Supervisor</dt>
              <dd>{p.supervisor ? <Link to={`/faculty/${p.supervisor._id}`}>{p.supervisor.name}</Link> : p.supervisorName || '—'}</dd>
              <dt>Started</dt>
              <dd>{formatDate(p.startDate) || '—'}</dd>
              {p.endDate && (
                <>
                  <dt>Completed</dt>
                  <dd>{formatDate(p.endDate)}</dd>
                </>
              )}
            </dl>
          </section>
          <section className="card">
            <h3>Team</h3>
            <div className="list">
              {p.contributors.map((c, i) => (
                <div key={i} className="list-item">
                  <Avatar user={c.user} name={c.name} size="sm" />
                  <div className="grow">
                    {c.user ? (
                      <Link to={`/u/${c.user._id}`} className="small bold" style={{ color: 'inherit' }}>
                        {c.user.name}
                      </Link>
                    ) : (
                      <span className="small bold">{c.name}</span>
                    )}
                    <div className="xs muted">{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {p.technologies?.length > 0 && (
            <section className="card">
              <h3>Technologies</h3>
              <div className="row-wrap">
                {p.technologies.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </section>
          )}
          <section className="card stack">
            <h3 className="mb-0">Links & files</h3>
            {LINKS.filter(([k]) => p.links?.[k]).map(([k, l]) => (
              <a key={k} className="doc-link" href={p.links[k]} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> {l}
              </a>
            ))}
            {p.links?.doi && (
              <a className="doc-link" href={`https://doi.org/${p.links.doi.replace(/^https?:\/\/doi.org\//, '')}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> DOI: {p.links.doi}
              </a>
            )}
            {p.files?.map((f) => (
              <a key={f.url} className="doc-link" href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer">
                <FileText size={16} aria-hidden="true" /> <span className="truncate">{f.name}</span>
              </a>
            ))}
            {!Object.values(p.links || {}).some(Boolean) && !p.files?.length && <p className="muted small mb-0">No links yet.</p>}
            {p.editable && (p.files?.length || 0) < 5 && (
              <label className="btn btn-sm btn-soft" style={{ cursor: 'pointer' }}>
                <Upload size={15} aria-hidden="true" /> Attach poster or file
                <input type="file" hidden accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => (uploadFile(e.target.files[0]), (e.target.value = ''))} />
              </label>
            )}
          </section>
          {p.collaborationOpen && (
            <section className="card" style={{ background: 'var(--primary-softer)' }}>
              <h3>Looking for collaborators</h3>
              <p className="small mb-0">{p.collaborationNote || 'The team welcomes collaborators.'}</p>
            </section>
          )}
        </aside>
      </div>

      <MessageDialog open={collab} onClose={() => setCollab(false)} user={p.lead} endpoint={`/research/${id}/collaborate`} title="Request to collaborate" context={`Research: ${p.title}`} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Delete this project?" confirmLabel="Delete" danger busy={busy}>
        All updates and attached files will be removed.
      </ConfirmDialog>
    </div>
  );
}
