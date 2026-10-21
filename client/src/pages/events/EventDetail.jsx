import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Clock, ExternalLink, MapPin, Pencil, Trash2, Video } from 'lucide-react';
import { api, eventIcsUrl } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, SampleBadge } from '../../components/ui.jsx';
import { ReportButton, SaveButton } from '../../components/common.jsx';
import { EVENT_CATEGORIES, label } from '../../utils/constants.js';
import { formatDate, formatTime } from '../../utils/format.js';
import { EventForm, eventToForm } from './Events.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
  const { data, error, loading, reload } = useApi(`/events/${id}`);
  const e = data?.event;
  useDocumentTitle(e?.title || 'Event');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/events/${id}`);
      toast.success('Event deleted');
      navigate('/events');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };
  const past = new Date(e.endsAt || e.startsAt) < new Date();

  return (
    <div className="stack-lg" style={{ maxWidth: 900 }}>
      <div>
        <Link to="/events" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> All events
        </Link>
      </div>
      {e.reviewStatus !== 'approved' && <Alert tone="warning">This event is {e.reviewStatus} and visible only to you and moderators.</Alert>}
      <section className="card stack">
        <div className="row-wrap">
          {e.official ? <Badge tone="violet">Official</Badge> : <Badge>Community submitted</Badge>}
          <Badge tone="primary">{label(EVENT_CATEGORIES, e.category)}</Badge>
          {past && <Badge>Past event</Badge>}
          <SampleBadge show={e.isDemo} />
        </div>
        <h1 className="mb-0">{e.title}</h1>
        <div className="meta" style={{ fontSize: '0.95rem' }}>
          <span>
            <Clock size={16} aria-hidden="true" /> {formatDate(e.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {formatTime(e.startsAt)}
            {e.endsAt && ` – ${formatTime(e.endsAt)}`}
          </span>
          {e.venue && (
            <span>
              <MapPin size={16} aria-hidden="true" /> {e.venue}
            </span>
          )}
          {e.meetingUrl && (
            <span>
              <Video size={16} aria-hidden="true" /> Online
            </span>
          )}
        </div>
        <div className="row-wrap">
          {e.registrationUrl && !past && (
            <a className="btn btn-primary" href={e.registrationUrl} target="_blank" rel="noopener noreferrer">
              Register <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
          {e.meetingUrl && (
            <a className="btn" href={e.meetingUrl} target="_blank" rel="noopener noreferrer">
              Join link <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
          {e.reviewStatus === 'approved' && (
            <a className="btn" href={eventIcsUrl(e._id)} download>
              <CalendarPlus size={16} aria-hidden="true" /> Add to calendar
            </a>
          )}
          <SaveButton type="event" id={e._id} saved={e.saved} size="" withLabel />
          {e.mine || isStaff ? (
            <>
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </>
          ) : (
            <ReportButton targetType="event" targetId={e._id} size="" withLabel />
          )}
        </div>
        <p className="small muted mb-0">Saving this event sends you a reminder notification 24 hours before it starts.</p>
      </section>
      <section className="card">
        <h2>About this event</h2>
        <p className="pre-wrap">{e.description}</p>
        <dl className="kv">
          <dt>Organizer</dt>
          <dd>{e.organizer}</dd>
          {e.department && (
            <>
              <dt>Department</dt>
              <dd>
                <Link to={`/departments/${e.department.slug}`}>{e.department.name}</Link>
              </dd>
            </>
          )}
          <dt>Source</dt>
          <dd>
            {e.sourceUrl ? (
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                {e.sourceUrl}
              </a>
            ) : (
              'Not provided'
            )}
          </dd>
          <dt>Submitted by</dt>
          <dd>{e.postedBy?.name}</dd>
        </dl>
      </section>
      <EventForm open={editing} onClose={() => setEditing(false)} onSaved={reload} initial={eventToForm(e)} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Delete this event?" confirmLabel="Delete" danger busy={busy} />
    </div>
  );
}
