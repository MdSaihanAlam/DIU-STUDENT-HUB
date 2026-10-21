import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Hash, MessagesSquare, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Button, CardSkeleton, Chips, EmptyState, ErrorState, LoadMore, SearchInput } from '../../components/ui.jsx';
import Composer from '../../features/posts/Composer.jsx';
import PostCard from '../../features/posts/PostCard.jsx';
import { useState } from 'react';

const FILTERS = [
  ['latest', 'Latest'],
  ['relevant', 'Relevant'],
  ['department', 'My department'],
  ['communities', 'My communities'],
  ['following', 'Connections'],
];

export default function Feed() {
  useDocumentTitle('Home');
  const { user } = useAuth();
  const [filters, setFilter] = useQueryFilters({ filter: 'latest', hashtag: '', type: '', q: '' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);

  const params = { filter: filters.filter, hashtag: filters.hashtag, type: filters.type, q: filters.q };
  const { items, loading, error, hasMore, loadMore, loadingMore, total, updateItem, removeItem, prependItem, reload, extra } = usePaginated('/posts', params, { limit: 10 });

  // Infinite scroll: load the next page when the sentinel becomes visible.
  const sentinel = useRef(null);
  const onIntersect = useCallback(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore();
    },
    [hasMore, loadingMore, loadMore]
  );
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(onIntersect, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onIntersect]);

  return (
    <div className="main-narrow stack">
      <Composer onCreated={(p) => (filters.filter === 'latest' && !filters.hashtag ? prependItem(p) : reload())} />

      <div className="stack" style={{ gap: 10 }}>
        <Chips label="Feed filter" options={FILTERS} value={filters.filter} onChange={(v) => setFilter('filter', v)} />
        <div className="row">
          <div className="grow">
            <SearchInput value={q} onChange={setQ} placeholder="Search posts…" label="Search posts" />
          </div>
          <select className="select" style={{ width: 'auto' }} value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Post type">
            <option value="">All types</option>
            <option value="question">Questions</option>
            <option value="announcement">Announcements</option>
            <option value="research_update">Research updates</option>
            <option value="poll">Polls</option>
          </select>
        </div>
        {filters.hashtag && (
          <div className="row">
            <span className="chip is-active">
              <Hash size={14} aria-hidden="true" />
              {filters.hashtag}
              <button onClick={() => setFilter('hashtag', '')} aria-label="Clear hashtag filter" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}>
                <X size={14} />
              </button>
            </span>
            <span className="small muted">{total} posts</span>
          </div>
        )}
      </div>

      {loading ? (
        <CardSkeleton count={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={MessagesSquare}
            title={filters.q || filters.hashtag ? 'No matching posts' : 'Your feed is quiet'}
            action={
              filters.filter === 'communities' ? (
                <Link to="/communities" className="btn btn-primary">
                  Find communities
                </Link>
              ) : filters.filter === 'following' ? (
                <Link to="/network" className="btn btn-primary">
                  Grow your network
                </Link>
              ) : (
                <Button variant="soft" onClick={() => setFilter('filter', 'latest')}>
                  Show latest posts
                </Button>
              )
            }
          >
            {extra?.hint || (filters.filter === 'department' && !user?.department ? 'Add your department in settings.' : 'Try another filter, or be the first to post.')}
          </EmptyState>
        </div>
      ) : (
        <div className="stack">
          {items.map((p) => (
            <PostCard key={p._id} post={p} onChange={updateItem} onRemove={removeItem} />
          ))}
        </div>
      )}
      <div ref={sentinel} aria-hidden="true" />
      {!loading && <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} total={total} shown={items.length} />}
    </div>
  );
}
