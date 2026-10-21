import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, CalendarDays, MapPin, Plus, ShieldAlert } from 'lucide-react';
import { fileUrl } from '../../services/api.js';
import { useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Alert, Badge, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, Tabs } from '../../components/ui.jsx';
import { SaveButton } from '../../components/common.jsx';
import { HOUSING_TYPES, label } from '../../utils/constants.js';
import { formatBDT, formatDate } from '../../utils/format.js';

export function HousingCard({ h }) {
  return (
    <Link to={`/housing/${h._id}`} className="card card-flush card-link">
      {h.photos?.[0] ? (
        <img className="cover" src={fileUrl(h.photos[0])} alt="" loading="lazy" />
      ) : (
        <div className="thumb-placeholder">
          <BedDouble size={36} aria-hidden="true" />
        </div>
      )}
      <div style={{ padding: 16 }} className="stack">
        <div className="row between">
          <strong style={{ fontSize: '1.15rem' }}>
            {formatBDT(h.rent)}
            <span className="small muted" style={{ fontWeight: 500 }}>
              /month
            </span>
          </strong>
          <SaveButton type="housing" id={h._id} saved={h.saved} />
        </div>
        <div className="card-title clamp-2" style={{ margin: 0 }}>
          {h.title}
        </div>
        <div className="row-wrap">
          <Badge tone="primary">{label(HOUSING_TYPES, h.type)}</Badge>
          {h.genderPreference !== 'any' && <Badge>{h.genderPreference === 'female' ? 'Female only' : 'Male only'}</Badge>}
          {h.status !== 'active' && <Badge tone={h.status === 'rented' ? 'success' : 'warning'}>{h.status}</Badge>}
          <SampleBadge show={h.isDemo} />
        </div>
        <div className="meta">
          <span>
            <MapPin size={14} aria-hidden="true" /> {h.area}
          </span>
          <span>
            <CalendarDays size={14} aria-hidden="true" /> From {formatDate(h.availableFrom, { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Housing() {
  useDocumentTitle('Housing');
  const [filters, setFilter] = useQueryFilters({ q: '', type: '', area: '', minRent: '', maxRent: '', gender: '', availableBy: '', sort: 'newest', tab: 'all' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [area, setArea] = useState(filters.area);
  const darea = useDebounce(area, 400);
  useEffect(() => setFilter('area', darea), [darea, setFilter]);
  const params = { ...filters, mine: filters.tab === 'mine' ? '1' : '', tab: undefined };
  const list = usePaginated('/housing', params, { limit: 12 });

  return (
    <>
      <PageHeader icon={BedDouble} tone="pink"
        title="Housing & accommodation"
        subtitle="Mess seats, sublets, hostels, apartments and roommates near campus."
        actions={
          <Link to="/housing/new" className="btn btn-primary">
            <Plus size={17} aria-hidden="true" /> Post a listing
          </Link>
        }
      />
      <Alert tone="warning" icon={ShieldAlert} className="mb-0">
        <b>Stay safe:</b> visit in person before paying anything, never send advance money to strangers, and report suspicious listings. DIU Student Hub does not verify or guarantee listings or transactions.
      </Alert>
      <div style={{ height: 16 }} />
      <Tabs
        tabs={[
          { value: 'all', label: 'Browse' },
          { value: 'mine', label: 'My listings' },
        ]}
        value={filters.tab}
        onChange={(v) => setFilter('tab', v)}
      />
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search listings" label="Search housing" />
        <input className="input" style={{ width: 150 }} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" aria-label="Area" />
        <select className="select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Accommodation type">
          <option value="">All types</option>
          {HOUSING_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input className="input" style={{ width: 120 }} type="number" min="0" inputMode="numeric" value={filters.minRent} onChange={(e) => setFilter('minRent', e.target.value)} placeholder="Min ৳" aria-label="Minimum rent" />
        <input className="input" style={{ width: 120 }} type="number" min="0" inputMode="numeric" value={filters.maxRent} onChange={(e) => setFilter('maxRent', e.target.value)} placeholder="Max ৳" aria-label="Maximum rent" />
        <select className="select" value={filters.gender} onChange={(e) => setFilter('gender', e.target.value)} aria-label="Suitable for">
          <option value="">Anyone</option>
          <option value="female">Suitable for female</option>
          <option value="male">Suitable for male</option>
        </select>
        <label className="row small muted" style={{ gap: 6 }}>
          Available by
          <input className="input" style={{ width: 160 }} type="date" value={filters.availableBy} onChange={(e) => setFilter('availableBy', e.target.value)} />
        </label>
        <select className="select" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="rent_asc">Rent: low to high</option>
          <option value="rent_desc">Rent: high to low</option>
          <option value="available">Available soonest</option>
        </select>
      </div>
      {list.loading ? (
        <GridSkeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={BedDouble} title="No listings match" action={<Link to="/housing/new" className="btn btn-primary">Post a listing</Link>}>
            Try widening your budget or area.
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="small muted">{list.total} listings</p>
          <div className="grid grid-3">
            {list.items.map((h) => (
              <HousingCard key={h._id} h={h} />
            ))}
          </div>
        </>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </>
  );
}
