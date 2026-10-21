import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Plus, Video } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Badge, Button, Dialog, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { DepartmentSelect, SaveButton } from '../../components/common.jsx';
import { EVENT_CATEGORIES, label } from '../../utils/constants.js';
import { formatDate, formatTime, toDateTimeInput } from '../../utils/format.js';

export function EventForm({ open, onClose, onSaved, initial }) {
  const toast = useToast();
  const { user } = useAuth();
  const blank = { title: '', description: '', category: 'workshop', startsAt: '', endsAt: '', venue: '', meetingUrl: '', organizer: '', registrationUrl: '', sourceUrl: '', department: '' };
  const [form, setForm] = useState(initial || blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(initial || blank), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const official = user?.role !== 'member' || (user?.affiliation === 'faculty' && user?.affiliationVerified);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '', endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '' };
    try {
      const r = initial?._id ? await api.put(`/events/${initial._id}`, body) : await api.post('/events', body);
      toast.success(r.message || 'Event saved');
      onSaved?.(r.event);
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={initial?._id ? 'Edit event' : 'Submit an event'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" variant="primary" loading={busy}>
            {official ? 'Publish' : 'Submit for review'}
          </Button>
        </>
      }
    >
      <form id="event-form" className="stack" onSubmit={submit}>
        {!official && <p className="small muted mb-0">Community events are reviewed by moderators and labeled “Community”. Official labels are reserved for verified faculty and staff.</p>}
        <TextField label="Title" required value={form.title} onChange={set('title')} maxLength={160} />
        <div className="form-grid">
          <SelectField label="Category" value={form.category} onChange={set('category')} options={EVENT_CATEGORIES} />
          <TextField label="Organizer" required value={form.organizer} onChange={set('organizer')} maxLength={120} />
          <TextField label="Starts" type="datetime-local" required value={form.startsAt} onChange={set('startsAt')} />
          <TextField label="Ends" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />
          <TextField label="Venue" value={form.venue} onChange={set('venue')} maxLength={160} hint="Or add a meeting link" />
          <TextField label="Meeting link" type="url" value={form.meetingUrl} onChange={set('meetingUrl')} />
          <TextField label="Registration link" type="url" value={form.registrationUrl} onChange={set('registrationUrl')} />
          <TextField label="Source link" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} />
        </div>
        <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Not department-specific" />
        <TextField as="textarea" label="Description" required value={form.description} onChange={set('description')} minLength={10} maxLength={5000} rows={4} />
      </form>
    </Dialog>
  );
}

function EventRow({ e }) {
  return (
    <Link to={`/events/${e._id}`} className="card card-link row" style={{ alignItems: 'flex-start', gap: 14 }}>
      <div className="date-tile">
        <b>{new Date(e.startsAt).getDate()}</b>
        <span>{formatDate(e.startsAt, { month: 'short' })}</span>
      </div>
      <div className="grow stack" style={{ gap: 6, minWidth: 0 }}>
        <div className="row-wrap">
          {e.official ? <Badge tone="violet">Official</Badge> : <Badge>Community</Badge>}
          <Badge tone="primary">{label(EVENT_CATEGORIES, e.category)}</Badge>
          {e.reviewStatus && e.reviewStatus !== 'approved' && <Badge tone="warning">{e.reviewStatus}</Badge>}
          <SampleBadge show={e.isDemo} />
        </div>
        <div className="card-title" style={{ margin: 0 }}>
          {e.title}
        </div>
        <div className="meta">
          <span>
            <CalendarDays size={14} aria-hidden="true" /> {formatDate(e.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}, {formatTime(e.startsAt)}
          </span>
          <span>
            {e.venue ? <MapPin size={14} aria-hidden="true" /> : <Video size={14} aria-hidden="true" />} {e.venue || 'Online'}
          </span>
          <span>{e.organizer}</span>
        </div>
      </div>
      <SaveButton type="event" id={e._id} saved={e.saved} />
    </Link>
  );
}

function Calendar({ category, official }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
  const { data, loading } = useApi('/events', { from: from.toISOString(), to: to.toISOString(), limit: 100, category, official });
  const byDay = useMemo(() => {
    const m = {};
    (data?.items || []).forEach((e) => {
      const k = new Date(e.startsAt).toDateString();
      (m[k] ||= []).push(e);
    });
    return m;
  }, [data]);

  const start = new Date(from);
  start.setDate(1 - ((from.getDay() + 6) % 7)); // weeks start on Monday
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = new Date().toDateString();

  return (
    <div className="card stack">
      <div className="row between">
        <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month" />
        <h2 className="mb-0" aria-live="polite">
          {month.toLocaleString('en-GB', { month: 'long', year: 'numeric' })} {loading && <span className="spinner" style={{ width: 14, height: 14 }} />}
        </h2>
        <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month" />
      </div>
      <div className="calendar" role="grid" aria-label="Event calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="cal-head" role="columnheader">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const events = byDay[d.toDateString()] || [];
          return (
            <div key={d.toISOString()} role="gridcell" className={`cal-day ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${d.toDateString() === today ? 'today' : ''}`} aria-label={`${d.toDateString()}${events.length ? `, ${events.length} events` : ''}`}>
              <div className="cal-num">{d.getDate()}</div>
              {events.slice(0, 3).map((e) => (
                <Link key={e._id} to={`/events/${e._id}`} className={`cal-event ${e.official ? 'official' : ''}`} title={e.title}>
                  {formatTime(e.startsAt)} {e.title}
                </Link>
              ))}
              {events.length > 3 && <span className="xs subtle">+{events.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Events() {
  useDocumentTitle('Events');
  const [filters, setFilter] = useQueryFilters({ q: '', category: '', official: '', view: 'list', tab: 'upcoming' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [creating, setCreating] = useState(false);
  const params = { q: filters.q, category: filters.category, official: filters.official, past: filters.tab === 'past' ? '1' : '', mine: filters.tab === 'mine' ? '1' : '' };
  const list = usePaginated('/events', params, { limit: 20 });

  return (
    <>
      <PageHeader icon={CalendarDays} tone="blue"
        title="Events & announcements"
        subtitle="Seminars, workshops, career fairs, club activities, competitions and academic deadlines."
        actions={
          <>
            <div className="row" role="group" aria-label="View">
              <Button variant={filters.view === 'list' ? 'soft' : 'ghost'} icon={List} onClick={() => setFilter('view', 'list')} aria-pressed={filters.view === 'list'} aria-label="List view" />
              <Button variant={filters.view === 'calendar' ? 'soft' : 'ghost'} icon={CalendarDays} onClick={() => setFilter('view', 'calendar')} aria-pressed={filters.view === 'calendar'} aria-label="Calendar view" />
            </div>
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Submit event
            </Button>
          </>
        }
      />
      <div className="filters">
        {filters.view === 'list' && <SearchInput value={q} onChange={setQ} placeholder="Search events" label="Search events" />}
        <select className="select" value={filters.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="select" value={filters.official} onChange={(e) => setFilter('official', e.target.value)} aria-label="Source">
          <option value="">Official & community</option>
          <option value="1">Official only</option>
          <option value="0">Community only</option>
        </select>
      </div>
      {filters.view === 'calendar' ? (
        <Calendar category={filters.category} official={filters.official} />
      ) : (
        <>
          <Tabs
            tabs={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
              { value: 'mine', label: 'My submissions' },
            ]}
            value={filters.tab}
            onChange={(v) => setFilter('tab', v)}
          />
          {list.loading ? (
            <GridSkeleton count={4} />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : list.items.length === 0 ? (
            <div className="card">
              <EmptyState icon={CalendarDays} title="No events found" />
            </div>
          ) : (
            <div className="stack">
              {list.items.map((e) => (
                <EventRow key={e._id} e={e} />
              ))}
            </div>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
        </>
      )}
      <EventForm open={creating} onClose={() => setCreating(false)} onSaved={() => list.reload()} />
    </>
  );
}

export const eventToForm = (e) => ({
  _id: e._id,
  title: e.title,
  description: e.description,
  category: e.category,
  startsAt: toDateTimeInput(e.startsAt),
  endsAt: toDateTimeInput(e.endsAt),
  venue: e.venue || '',
  meetingUrl: e.meetingUrl || '',
  organizer: e.organizer,
  registrationUrl: e.registrationUrl || '',
  sourceUrl: e.sourceUrl || '',
  department: e.department?._id || '',
});
