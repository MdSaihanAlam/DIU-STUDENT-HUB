import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Badge, CardSkeleton, EmptyState, ErrorState, LoadMore, PageHeader, Tabs } from '../../components/ui.jsx';
import { SaveButton, plainText } from '../../components/common.jsx';
import { formatBDT, formatDate, humanize, timeAgo } from '../../utils/format.js';

const TABS = [
  { value: '', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'resource', label: 'Notes' },
  { value: 'housing', label: 'Housing' },
  { value: 'research', label: 'Research' },
  { value: 'career', label: 'Careers' },
  { value: 'event', label: 'Events' },
];

const describe = (type, it) => {
  switch (type) {
    case 'post':
      return { to: `/posts/${it._id}`, title: plainText(it.content).slice(0, 120) || 'Post', meta: `${it.author?.name || ''} · ${timeAgo(it.createdAt)}` };
    case 'resource':
      return { to: `/resources/${it._id}`, title: it.title, meta: `${it.courseCode || ''} · ${humanize(it.resourceType)}` };
    case 'housing':
      return { to: `/housing/${it._id}`, title: it.title, meta: `${formatBDT(it.rent)} · ${it.area} · ${it.status}` };
    case 'research':
      return { to: `/research/${it._id}`, title: it.title, meta: `${it.domain} · ${humanize(it.status)}` };
    case 'career':
      return { to: `/careers/${it._id}`, title: it.title, meta: `${it.organization} · ${it.deadline ? `Deadline ${formatDate(it.deadline)}` : 'Rolling'}` };
    case 'event':
      return { to: `/events/${it._id}`, title: it.title, meta: `${formatDate(it.startsAt)} · ${it.venue || 'Online'}` };
    default:
      return { to: '#', title: 'Item', meta: '' };
  }
};

export default function Saved() {
  useDocumentTitle('Saved items');
  const [type, setType] = useState('');
  const list = usePaginated('/bookmarks', { type }, { limit: 20 });

  return (
    <div className="main-narrow">
      <PageHeader icon={Bookmark} tone="pink" title="Saved items" subtitle="Posts, notes, listings and opportunities you bookmarked. Saved events and deadlines send reminders." />
      <Tabs tabs={TABS} value={type} onChange={setType} />
      {list.loading ? (
        <CardSkeleton count={3} lines={1} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Bookmark} title="Nothing saved yet">
            Use the bookmark icon on posts, notes, listings and events to find them here later.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="list">
            {list.items.map((b) => {
              if (!b.item)
                return (
                  <div key={b._id} className="list-item muted small">
                    <span className="grow">This {b.targetType} is no longer available.</span>
                  </div>
                );
              const d = describe(b.targetType, b.item);
              return (
                <div key={b._id} className="list-item">
                  <Link to={d.to} className="grow" style={{ color: 'inherit', minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge>{humanize(b.targetType)}</Badge>
                      <span className="small bold truncate">{d.title}</span>
                    </div>
                    <div className="xs muted truncate">{d.meta}</div>
                  </Link>
                  <SaveButton type={b.targetType} id={b.item._id} saved onChange={(saved) => !saved && list.removeItem(b._id)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </div>
  );
}
