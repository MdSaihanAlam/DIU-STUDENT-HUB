import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ExternalLink, Info, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, SampleBadge } from '../../components/ui.jsx';
import { ReportButton, SaveButton } from '../../components/common.jsx';
import { OPPORTUNITY_TYPES, label } from '../../utils/constants.js';
import { deadlineLabel, formatDate, humanize, toDateInput } from '../../utils/format.js';
import { OpportunityForm } from './Careers.jsx';

export default function CareerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
  const { data, error, loading, reload } = useApi(`/careers/${id}`);
  const o = data?.opportunity;
  useDocumentTitle(o?.title || 'Opportunity');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/careers/${id}`);
      toast.success('Removed');
      navigate('/careers');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <div>
        <Link to="/careers" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> All opportunities
        </Link>
      </div>
      {o.reviewStatus !== 'approved' && <Alert tone="warning">This submission is {o.reviewStatus} and visible only to you and moderators.</Alert>}
      <section className="card stack">
        <div className="row-wrap">
          <Badge tone="primary">{label(OPPORTUNITY_TYPES, o.type)}</Badge>
          {o.verified ? (
            <Badge tone="success" icon={BadgeCheck}>
              Verified by moderators
            </Badge>
          ) : (
            <Badge>Community submitted</Badge>
          )}
          <SampleBadge show={o.isDemo} />
        </div>
        <h1 className="mb-0">{o.title}</h1>
        <p className="muted mb-0">
          {o.organization}
          {o.location && ` · ${o.location}`} · {humanize(o.mode)}
        </p>
        <div className="row-wrap">
          {o.applyUrl && (
            <a className="btn btn-primary" href={o.applyUrl} target="_blank" rel="noopener noreferrer">
              Apply <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
          <SaveButton type="career" id={o._id} saved={o.saved} size="" withLabel />
          {o.mine || isStaff ? (
            <>
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </>
          ) : (
            <ReportButton targetType="career" targetId={o._id} size="" withLabel />
          )}
        </div>
        <dl className="kv">
          <dt>Deadline</dt>
          <dd>
            {o.deadline ? formatDate(o.deadline) : 'Rolling'} <span className="muted">({deadlineLabel(o.deadline)})</span>
          </dd>
          <dt>Source</dt>
          <dd>
            {o.sourceUrl ? (
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                {o.sourceUrl}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>
          <dt>Posted by</dt>
          <dd>{o.postedBy?.name}</dd>
          {o.tags?.length > 0 && (
            <>
              <dt>Tags</dt>
              <dd>
                <div className="row-wrap">
                  {o.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </dd>
            </>
          )}
        </dl>
      </section>
      <section className="card">
        <h2>Description</h2>
        <p className="pre-wrap">{o.description}</p>
        {o.eligibility && (
          <>
            <h2>Eligibility</h2>
            <p className="pre-wrap mb-0">{o.eligibility}</p>
          </>
        )}
      </section>
      <Alert tone="info" icon={Info}>
        Always confirm details on the organiser’s official website. Never pay a fee to apply for a job.
      </Alert>
      <OpportunityForm
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={reload}
        initial={{ ...o, deadline: toDateInput(o.deadline), tags: (o.tags || []).join(', '), applyUrl: o.applyUrl || '', sourceUrl: o.sourceUrl || '', location: o.location || '', eligibility: o.eligibility || '' }}
      />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Delete this opportunity?" confirmLabel="Delete" danger busy={busy} />
    </div>
  );
}
