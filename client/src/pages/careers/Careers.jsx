import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, Building, Clock, MapPin, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Alert, Badge, Button, Dialog, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { SaveButton } from '../../components/common.jsx';
import { OPPORTUNITY_TYPES, label } from '../../utils/constants.js';
import { daysUntil, deadlineLabel, formatDate } from '../../utils/format.js';

export function OpportunityForm({ open, onClose, onSaved, initial }) {
  const toast = useToast();
  const blank = { title: '', type: 'internship', organization: '', location: '', mode: 'onsite', description: '', eligibility: '', deadline: '', applyUrl: '', sourceUrl: '', tags: '' };
  const [form, setForm] = useState(initial || blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(initial || blank), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = initial?._id ? await api.patch(`/careers/${initial._id}`, form) : await api.post('/careers', form);
      toast.success(r.message || 'Saved');
      onSaved?.(r.opportunity);
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
      title={initial?._id ? 'Edit opportunity' : 'Share an opportunity'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="opp-form" variant="primary" loading={busy}>
            {initial?._id ? 'Save' : 'Submit for review'}
          </Button>
        </>
      }
    >
      <form id="opp-form" className="stack" onSubmit={submit}>
        <TextField label="Title" required value={form.title} onChange={set('title')} maxLength={160} />
        <div className="form-grid">
          <SelectField label="Type" value={form.type} onChange={set('type')} options={OPPORTUNITY_TYPES} />
          <TextField label="Organization" required value={form.organization} onChange={set('organization')} maxLength={120} />
          <TextField label="Location" value={form.location} onChange={set('location')} maxLength={100} />
          <SelectField
            label="Mode"
            value={form.mode}
            onChange={set('mode')}
            options={[
              ['onsite', 'On-site'],
              ['remote', 'Remote'],
              ['hybrid', 'Hybrid'],
            ]}
          />
          <TextField label="Deadline" type="date" value={form.deadline} onChange={set('deadline')} />
          <TextField label="Tags" value={form.tags} onChange={set('tags')} hint="Comma-separated" />
        </div>
        <TextField as="textarea" label="Description" required value={form.description} onChange={set('description')} minLength={20} maxLength={5000} rows={4} />
        <TextField as="textarea" label="Eligibility" value={form.eligibility} onChange={set('eligibility')} maxLength={2000} rows={2} />
        <div className="form-grid">
          <TextField label="Application link" type="url" value={form.applyUrl} onChange={set('applyUrl')} placeholder="https://" />
          <TextField label="Source link" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="Where did you find this?" hint="Required for moderators to verify." />
        </div>
      </form>
    </Dialog>
  );
}

function OpportunityCard({ o }) {
  const left = daysUntil(o.deadline);
  return (
    <Link to={`/careers/${o._id}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row between">
        <div className="row-wrap">
          <Badge tone="primary">{label(OPPORTUNITY_TYPES, o.type)}</Badge>
          {o.verified ? (
            <Badge tone="success" icon={BadgeCheck}>
              Verified
            </Badge>
          ) : (
            <Badge>Community submitted</Badge>
          )}
          {o.reviewStatus && o.reviewStatus !== 'approved' && <Badge tone="warning">{o.reviewStatus}</Badge>}
          <SampleBadge show={o.isDemo} />
        </div>
        <SaveButton type="career" id={o._id} saved={o.saved} />
      </div>
      <div className="card-title clamp-2">{o.title}</div>
      <div className="meta">
        <span>
          <Building size={14} aria-hidden="true" /> {o.organization}
        </span>
        {o.location && (
          <span>
            <MapPin size={14} aria-hidden="true" /> {o.location}
          </span>
        )}
      </div>
      <div className="row between">
        <span className={`small bold`} style={{ color: left !== null && left <= 3 ? 'var(--danger)' : 'var(--text-muted)' }}>
          <Clock size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> {deadlineLabel(o.deadline)}
        </span>
        {o.deadline && <span className="xs subtle">{formatDate(o.deadline)}</span>}
      </div>
    </Link>
  );
}

export default function Careers() {
  useDocumentTitle('Careers');
  const { user } = useAuth();
  const [filters, setFilter] = useQueryFilters({ q: '', type: '', mode: '', verified: '', sort: 'deadline', tab: 'open' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [creating, setCreating] = useState(false);
  const canSubmit = user?.affiliationVerified || user?.role !== 'member';
  const params = { q: filters.q, type: filters.type, mode: filters.mode, verified: filters.verified, sort: filters.sort, mine: filters.tab === 'mine' ? '1' : '', include: filters.tab === 'all' ? 'expired' : '' };
  const list = usePaginated('/careers', params, { limit: 12 });

  return (
    <>
      <PageHeader icon={Briefcase} tone="amber"
        title="Careers & opportunities"
        subtitle="Jobs, internships, scholarships, research assistantships, competitions and hackathons."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)} disabled={!canSubmit} title={canSubmit ? undefined : 'Verified members can submit opportunities'}>
            Share opportunity
          </Button>
        }
      />
      {!canSubmit && (
        <Alert tone="info" className="mb-0">
          Only verified members can submit opportunities. <Link to="/settings?tab=verification">Request verification</Link>.
        </Alert>
      )}
      <div style={{ height: 12 }} />
      <Tabs
        tabs={[
          { value: 'open', label: 'Open now' },
          { value: 'all', label: 'Including closed' },
          { value: 'mine', label: 'My submissions' },
        ]}
        value={filters.tab}
        onChange={(v) => setFilter('tab', v)}
      />
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search title, organisation or tag" label="Search opportunities" />
        <select className="select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Opportunity type">
          <option value="">All types</option>
          {OPPORTUNITY_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="select" value={filters.mode} onChange={(e) => setFilter('mode', e.target.value)} aria-label="Work mode">
          <option value="">Any mode</option>
          <option value="onsite">On-site</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select className="select" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="deadline">Deadline soonest</option>
          <option value="newest">Newest</option>
        </select>
        <label className="check" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={filters.verified === '1'} onChange={(e) => setFilter('verified', e.target.checked ? '1' : '')} />
          Verified only
        </label>
      </div>
      {list.loading ? (
        <GridSkeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Briefcase} title="No opportunities found">
            Save opportunities to get deadline reminders in your notifications.
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-3">
          {list.items.map((o) => (
            <OpportunityCard key={o._id} o={o} />
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <OpportunityForm open={creating} onClose={() => setCreating(false)} onSaved={() => filters.tab === 'mine' && list.reload()} />
    </>
  );
}
