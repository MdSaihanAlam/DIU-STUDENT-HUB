import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Badge, CardSkeleton, ErrorState, SampleBadge } from '../../components/ui.jsx';
import { plainText } from '../../components/common.jsx';
import { formatDateTime, humanize, timeAgo } from '../../utils/format.js';
import { FacultyCard } from './Departments.jsx';

export default function DepartmentDetail() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useApi(`/departments/${slug}`);
  useDocumentTitle(data?.department?.name || 'Department');
  if (loading) return <CardSkeleton count={2} lines={5} avatar={false} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { department: d, faculty, communities, research, announcements, events } = data;

  return (
    <div className="stack-lg">
      <div>
        <Link to="/departments" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> All departments
        </Link>
      </div>
      <section className="card stack">
        <div className="row-wrap">
          <Badge tone="primary">{d.code}</Badge>
          {d.faculty && <Badge>{d.faculty}</Badge>}
          <SampleBadge show={d.isDemo} />
        </div>
        <h1 className="mb-0">{d.name}</h1>
        {d.isDemo && (
          <Alert tone="warning" icon={Info}>
            This department description is sample data for development. Administrators should replace it with information from official DIU sources.
          </Alert>
        )}
        {d.overview && <p className="pre-wrap mb-0">{d.overview}</p>}
        <div className="row-wrap">
          {d.officialUrl && (
            <a className="btn btn-sm" href={d.officialUrl} target="_blank" rel="noopener noreferrer">
              Official page <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {d.curriculumUrl && (
            <a className="btn btn-sm" href={d.curriculumUrl} target="_blank" rel="noopener noreferrer">
              Curriculum <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          <Link className="btn btn-sm btn-soft" to={`/resources?department=${d._id}`}>
            Course resources
          </Link>
        </div>
      </section>

      <div className="detail-grid">
        <div className="stack-lg">
          <section className="card">
            <h2>Programs offered</h2>
            {d.programs?.length ? (
              <ul className="list" style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }}>
                {d.programs.map((p) => (
                  <li key={p.name} className="list-item between">
                    <span>{p.name}</span>
                    <Badge>{humanize(p.level)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted mb-0">No programs listed.</p>
            )}
          </section>

          <section>
            <div className="section-title">
              <h2>Faculty ({faculty.length})</h2>
            </div>
            <div className="grid grid-2">
              {faculty.map((f) => (
                <FacultyCard key={f._id} f={{ ...f, department: { code: d.code } }} />
              ))}
              {!faculty.length && <p className="muted">No faculty profiles yet.</p>}
            </div>
          </section>

          <section className="card">
            <div className="section-title">
              <h2>Research projects</h2>
              <Link to={`/research?department=${d._id}`} className="small">
                View all
              </Link>
            </div>
            <div className="list">
              {research.map((r) => (
                <Link key={r._id} to={`/research/${r._id}`} className="list-item" style={{ color: 'inherit' }}>
                  <span className="grow bold small">{r.title}</span>
                  <Badge tone="accent">{r.domain}</Badge>
                </Link>
              ))}
              {!research.length && <p className="muted small mb-0">No verified projects yet.</p>}
            </div>
          </section>
        </div>

        <aside className="stack-lg">
          <section className="card">
            <h3>Research areas</h3>
            <div className="row-wrap">
              {d.researchAreas.map((a) => (
                <Badge key={a}>{a}</Badge>
              ))}
            </div>
          </section>
          <section className="card">
            <h3>Announcements</h3>
            <div className="list">
              {announcements.map((a) => (
                <div key={a._id} className="list-item" style={{ display: 'block' }}>
                  <div className="row-wrap" style={{ marginBottom: 4 }}>
                    {a.official ? <Badge tone="violet">Official</Badge> : <Badge>Community</Badge>}
                    <span className="xs subtle">{timeAgo(a.createdAt)}</span>
                  </div>
                  <Link to={`/posts/${a._id}`} className="small clamp-3" style={{ color: 'inherit' }}>
                    {plainText(a.content)}
                  </Link>
                </div>
              ))}
              {!announcements.length && <p className="muted small mb-0">No announcements.</p>}
            </div>
          </section>
          <section className="card">
            <h3>Upcoming events</h3>
            <div className="list">
              {events.map((e) => (
                <Link key={e._id} to={`/events/${e._id}`} className="list-item" style={{ display: 'block', color: 'inherit' }}>
                  <div className="small bold">{e.title}</div>
                  <div className="xs muted">{formatDateTime(e.startsAt)}</div>
                </Link>
              ))}
              {!events.length && <p className="muted small mb-0">No upcoming events.</p>}
            </div>
          </section>
          <section className="card">
            <h3>Student communities</h3>
            <div className="list">
              {communities.map((c) => (
                <Link key={c._id} to={`/communities/${c.slug}`} className="list-item" style={{ color: 'inherit' }}>
                  <span className="grow small bold">{c.name}</span>
                  <span className="xs subtle">{c.memberCount} members</span>
                </Link>
              ))}
              {!communities.length && <p className="muted small mb-0">No communities yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
