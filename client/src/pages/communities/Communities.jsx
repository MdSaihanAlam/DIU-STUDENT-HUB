import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Plus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Badge, Button, Dialog, LetterTile, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { DepartmentSelect } from '../../components/common.jsx';
import { COMMUNITY_TYPES, label } from '../../utils/constants.js';

function CreateDialog({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', type: 'study_group', description: '', department: '', visibility: 'public', rules: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/communities', form);
      toast.success('Community created');
      navigate(`/communities/${r.community.slug}`);
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
      title="Create a community"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="community-form" loading={busy}>
            Create
          </Button>
        </>
      }
    >
      <form id="community-form" className="stack" onSubmit={submit}>
        <TextField label="Name" required value={form.name} onChange={set('name')} minLength={3} maxLength={80} placeholder="e.g. CSE 213 Study Group" />
        <div className="form-grid">
          <SelectField label="Type" value={form.type} onChange={set('type')} options={COMMUNITY_TYPES} />
          <SelectField
            label="Who can join?"
            value={form.visibility}
            onChange={set('visibility')}
            options={[
              ['public', 'Anyone (public)'],
              ['private', 'By approval (private)'],
            ]}
          />
        </div>
        <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Not department-specific" />
        <TextField as="textarea" label="Description" value={form.description} onChange={set('description')} maxLength={2000} rows={3} />
        <TextField as="textarea" label="Rules (optional)" value={form.rules} onChange={set('rules')} maxLength={2000} rows={2} />
      </form>
    </Dialog>
  );
}

export function CommunityCard({ c }) {
  return (
    <Link to={`/communities/${c.slug}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row">
        <LetterTile name={c.name} size={56} radius={16} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="card-title truncate">{c.name}</div>
          <div className="small muted">
            {c.memberCount} members{c.department?.code && ` · ${c.department.code}`}
          </div>
        </div>
      </div>
      {c.description && <p className="small muted clamp-2 mb-0">{c.description}</p>}
      <div className="row-wrap">
        <Badge>{label(COMMUNITY_TYPES, c.type)}</Badge>
        {c.visibility === 'private' && (
          <Badge icon={Lock} tone="warning">
            Private
          </Badge>
        )}
        {c.membership?.status === 'active' && <Badge tone="success">Joined</Badge>}
        {c.membership?.status === 'pending' && <Badge tone="warning">Requested</Badge>}
        <SampleBadge show={c.isDemo} />
      </div>
    </Link>
  );
}

export default function Communities() {
  useDocumentTitle('Communities');
  const [filters, setFilter] = useQueryFilters({ q: '', type: '', tab: 'all' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [creating, setCreating] = useState(false);
  const list = usePaginated('/communities', { q: filters.q, type: filters.type, mine: filters.tab === 'mine' ? '1' : '' }, { limit: 18 });

  return (
    <>
      <PageHeader icon={Users} tone="violet"
        title="Communities"
        subtitle="Department, batch, course, research and interest groups."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New community
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'all', label: 'Discover' },
          { value: 'mine', label: 'My communities' },
        ]}
        value={filters.tab}
        onChange={(v) => setFilter('tab', v)}
      />
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search communities" label="Search communities" />
        <select className="select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Community type">
          <option value="">All types</option>
          {COMMUNITY_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {list.loading ? (
        <GridSkeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Users} title={filters.tab === 'mine' ? 'You have not joined any communities' : 'No communities found'} action={<Button variant="primary" onClick={() => setCreating(true)}>Create one</Button>} />
        </div>
      ) : (
        <div className="grid grid-3">
          {list.items.map((c) => (
            <CommunityCard key={c._id} c={c} />
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
