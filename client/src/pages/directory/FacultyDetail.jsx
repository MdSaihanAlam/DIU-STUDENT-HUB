import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Avatar, Badge, CardSkeleton, ErrorState, SampleBadge } from '../../components/ui.jsx';
import { humanize } from '../../utils/format.js';

export default function FacultyDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/faculty/${id}`);
  useDocumentTitle(data?.profile?.name || 'Faculty');
  if (loading) return <CardSkeleton count={1} lines={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { profile: f, supervised } = data;

  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <div>
        <Link to={f.department ? `/departments/${f.department.slug}` : '/departments'} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> {f.department?.name || 'Directory'}
        </Link>
      </div>
      <section className="card">
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          <Avatar src={f.photoUrl || f.user?.avatarUrl} name={f.name} size="xl" />
          <div className="grow stack" style={{ gap: 8 }}>
            <h1 className="mb-0">{f.name}</h1>
            <div className="row-wrap">
              <span className="muted">{f.designation || 'Faculty member'}</span>
              {f.designationVerified && <Badge tone="primary">Designation verified</Badge>}
              {f.verified ? <Badge tone="success">Verified profile</Badge> : <Badge>Unverified profile</Badge>}
              <SampleBadge show={f.isDemo} />
            </div>
            <div className="row-wrap">
              {f.website && (
                <a className="btn btn-sm" href={f.website} target="_blank" rel="noopener noreferrer">
                  Website <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {f.orcid && (
                <a className="btn btn-sm" href={`https://orcid.org/${f.orcid}`} target="_blank" rel="noopener noreferrer">
                  ORCID <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {f.user && (
                <Link className="btn btn-sm btn-soft" to={`/u/${f.user._id}`}>
                  View member profile
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      {f.isDemo && (
        <Alert tone="warning" icon={Info}>
          This is a fictional sample profile for development. It does not describe a real DIU faculty member.
        </Alert>
      )}
      <section className="card">
        <dl className="kv">
          <dt>Department</dt>
          <dd>{f.department?.name}</dd>
          <dt>Qualifications</dt>
          <dd>{f.qualifications?.length ? f.qualifications.join('; ') : '—'}</dd>
          <dt>Research interests</dt>
          <dd>
            <div className="row-wrap">{f.researchInterests?.map((r) => <Badge key={r}>{r}</Badge>) || '—'}</div>
          </dd>
          <dt>Contact</dt>
          <dd>{f.publicContact || 'Not published'}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Publications</h2>
        {f.publications?.length ? (
          <ol style={{ paddingLeft: 18, margin: 0 }} className="stack">
            {f.publications.map((p, i) => (
              <li key={i}>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.title}
                  </a>
                ) : (
                  <span className="bold">{p.title}</span>
                )}
                <div className="small muted">{[p.venue, p.year].filter(Boolean).join(', ')}</div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted mb-0">No publications listed.</p>
        )}
      </section>
      {(f.projects?.length > 0 || supervised.length > 0) && (
        <section className="card">
          <h2>Projects & supervision</h2>
          <ul style={{ paddingLeft: 18 }}>
            {f.projects?.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {supervised.length > 0 && (
            <div className="list">
              {supervised.map((r) => (
                <Link key={r._id} to={`/research/${r._id}`} className="list-item" style={{ color: 'inherit' }}>
                  <span className="grow small bold">{r.title}</span>
                  <Badge>{humanize(r.status)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
