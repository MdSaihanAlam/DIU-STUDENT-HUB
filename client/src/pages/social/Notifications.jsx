import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Avatar, Button, CardSkeleton, EmptyState, ErrorState, LoadMore, PageHeader, Tabs } from '../../components/ui.jsx';
import { timeAgo } from '../../utils/format.js';

export default function Notifications() {
  useDocumentTitle('Notifications');
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const list = usePaginated('/notifications', { unread: tab === 'unread' ? '1' : '' }, { limit: 20 });

  const open = async (n) => {
    if (!n.read) {
      list.updateItem(n._id, { read: true });
      api.post(`/notifications/${n._id}/read`).then(() => window.dispatchEvent(new Event('hub:counts-changed')));
    }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    try {
      await api.post('/notifications/read-all');
      list.reload();
      window.dispatchEvent(new Event('hub:counts-changed'));
      toast.success('All caught up');
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="main-narrow">
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="ghost" icon={CheckCheck} onClick={readAll}>
            Mark all as read
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {list.loading ? (
        <CardSkeleton count={3} lines={1} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Bell} title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}>
            Reactions, comments, messages and reminders will appear here.
          </EmptyState>
        </div>
      ) : (
        <div className="card card-flush">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.items.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="list-item"
                  style={{ width: '100%', padding: '14px 18px', border: 0, borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--primary-softer)', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
                >
                  {n.actor ? (
                    <Avatar user={n.actor} size="sm" />
                  ) : (
                    <span className="avatar avatar-sm" aria-hidden="true">
                      <Bell size={15} />
                    </span>
                  )}
                  <span className="grow">
                    <span className={`small ${n.read ? '' : 'bold'}`}>{n.message}</span>
                    <span className="xs subtle" style={{ display: 'block' }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--primary)' }} aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </div>
  );
}
