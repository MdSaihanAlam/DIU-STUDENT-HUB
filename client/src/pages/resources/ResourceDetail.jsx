import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Trash2 } from 'lucide-react';
import { api, resourceDownloadUrl, resourcePreviewUrl } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, SampleBadge, StarInput, Stars, TextField } from '../../components/ui.jsx';
import { ReportButton, SaveButton, UserLine } from '../../components/common.jsx';
import { RESOURCE_TYPES, label } from '../../utils/constants.js';
import { formatBytes, formatDate, timeAgo } from '../../utils/format.js';

export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
  const { data, error, loading, reload, setData } = useApi(`/resources/${id}`);
  const r = data?.resource;
  useDocumentTitle(r?.title || 'Resource');
  const [preview, setPreview] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const rate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/resources/${id}/rate`, { value: rating || r.myRating?.value, comment });
      setData((d) => ({ resource: { ...d.resource, ratingAvg: res.ratingAvg, ratingCount: res.ratingCount, myRating: { value: rating, comment } } }));
      toast.success('Thanks for your feedback!');
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/resources/${id}`);
      toast.success('Resource removed');
      navigate('/resources');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <Link to="/resources" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> All resources
        </Link>
      </div>
      {r.status !== 'approved' && (
        <Alert tone="warning">
          This resource is <b>{r.status}</b>
          {r.status === 'pending' ? ' and visible only to you and moderators until approved.' : '.'}
          {r.reviewNote && ` Moderator note: ${r.reviewNote}`}
        </Alert>
      )}
      <div className="card stack">
        <div className="row-wrap">
          {r.courseCode && <Badge tone="primary">{r.courseCode}</Badge>}
          <Badge>{label(RESOURCE_TYPES, r.resourceType)}</Badge>
          {r.semester && <Badge>{r.semester}</Badge>}
          <SampleBadge show={r.isDemo} />
        </div>
        <h1 style={{ marginBottom: 0 }}>{r.title}</h1>
        {r.courseTitle && <p className="muted mb-0">{r.courseTitle}</p>}
        <div className="row-wrap">
          <a className="btn btn-primary" href={resourceDownloadUrl(id)} download>
            <Download size={17} aria-hidden="true" /> Download <span style={{ opacity: 0.8 }}>({formatBytes(r.file.size)})</span>
          </a>
          {r.previewable && (
            <Button icon={Eye} onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
              {preview ? 'Hide preview' : 'Preview'}
            </Button>
          )}
          <SaveButton type="resource" id={r._id} saved={r.saved} size="" withLabel />
          {!r.mine && <ReportButton targetType="resource" targetId={r._id} size="" withLabel />}
          {(r.mine || isStaff) && (
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
        </div>
        {preview && <iframe className="preview-frame" src={resourcePreviewUrl(id)} title={`Preview of ${r.title}`} />}
        {r.description && <p className="pre-wrap mb-0">{r.description}</p>}
        <dl className="kv">
          <dt>Department</dt>
          <dd>{r.department ? <Link to={`/departments/${r.department.slug}`}>{r.department.name}</Link> : '—'}</dd>
          <dt>Topic</dt>
          <dd>{r.topic || '—'}</dd>
          <dt>File</dt>
          <dd>
            {r.file.originalName} · {r.file.ext?.toUpperCase()} · {formatBytes(r.file.size)}
          </dd>
          <dt>Uploaded</dt>
          <dd>{formatDate(r.createdAt)}</dd>
          <dt>Downloads</dt>
          <dd>{r.downloads}</dd>
          <dt>Attribution</dt>
          <dd>{r.attribution || 'Not provided'}</dd>
        </dl>
        <UserLine user={r.uploader} meta="Uploader" />
      </div>

      <section className="card stack">
        <div className="section-title">
          <h2>Ratings & feedback</h2>
          <span className="row small muted">
            <Stars value={r.ratingAvg} /> {r.ratingAvg || '—'} ({r.ratingCount})
          </span>
        </div>
        {!r.mine && r.status === 'approved' && (
          <form className="stack" onSubmit={rate}>
            <StarInput value={rating || r.myRating?.value || 0} onChange={setRating} />
            <TextField as="textarea" label={r.myRating ? 'Update your feedback' : 'Feedback (optional)'} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Was it accurate and useful?" rows={2} />
            <div className="form-actions">
              <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!(rating || r.myRating?.value)}>
                {r.myRating ? 'Update rating' : 'Submit rating'}
              </Button>
            </div>
          </form>
        )}
        <div className="list">
          {r.ratings.length === 0 && <p className="muted small mb-0">No feedback yet.</p>}
          {r.ratings.map((x) => (
            <div key={x._id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <Avatar user={x.user} size="sm" />
              <div className="grow">
                <div className="row small">
                  <b>{x.user?.name || 'Member'}</b>
                  <Stars value={x.value} size={12} />
                  <span className="xs subtle">{timeAgo(x.createdAt)}</span>
                </div>
                {x.comment && <p className="small mb-0">{x.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Delete this resource?" confirmLabel="Delete" danger busy={busy}>
        The file will be permanently removed from storage.
      </ConfirmDialog>
    </div>
  );
}
