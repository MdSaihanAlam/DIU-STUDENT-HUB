import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, UserPlus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Badge, Button, CardSkeleton, EmptyState, ErrorState, PageHeader, Tabs } from '../../components/ui.jsx';
import { UserLine } from '../../components/common.jsx';
import { timeAgo } from '../../utils/format.js';

export default function Network() {
  useDocumentTitle('My network');
  const toast = useToast();
  const [tab, setTab] = useState('requests');
  const { data, error, loading, reload } = useApi('/users/me/connections');
  const suggested = useApi('/users/suggested');

  const respond = async (id, accept) => {
    try {
      await api.post(`/users/connections/${id}/respond`, { accept });
      toast.success(accept ? 'Request accepted' : 'Request declined');
      reload();
    } catch (err) {
      toast.error(err);
    }
  };
  const remove = async (id) => {
    try {
      await api.del(`/users/connections/${id}`);
      reload();
    } catch (err) {
      toast.error(err);
    }
  };
  const connect = async (userId) => {
    try {
      await api.post(`/users/${userId}/connect`, { kind: 'connection' });
      toast.success('Request sent');
      suggested.reload();
      reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const lists = data || { connections: [], incoming: [], outgoing: [], mentorships: [] };

  return (
    <div className="main-narrow">
      <PageHeader title="My network" subtitle="Connections, requests and mentorships." />
      <Tabs
        tabs={[
          { value: 'requests', label: 'Requests', count: lists.incoming.length },
          { value: 'connections', label: 'Connections', count: lists.connections.length },
          { value: 'mentorships', label: 'Mentorships', count: lists.mentorships.length },
          { value: 'sent', label: 'Sent', count: lists.outgoing.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {loading ? (
        <CardSkeleton count={2} lines={1} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="card">
          {tab === 'requests' &&
            (lists.incoming.length ? (
              <div className="list">
                {lists.incoming.map((c) => (
                  <div key={c._id} className="list-item" style={{ flexWrap: 'wrap' }}>
                    <div className="grow">
                      <UserLine user={c.user} meta={`${c.kind === 'mentorship' ? 'Mentorship request' : 'Wants to connect'} · ${timeAgo(c.createdAt)}`} />
                      {c.message && (
                        <p className="small muted" style={{ margin: '6px 0 0 52px' }}>
                          “{c.message}”
                        </p>
                      )}
                    </div>
                    <div className="row">
                      <Button size="sm" variant="primary" onClick={() => respond(c._id, true)}>
                        Accept
                      </Button>
                      <Button size="sm" onClick={() => respond(c._id, false)}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={UserPlus} title="No pending requests" />
            ))}
          {tab === 'connections' &&
            (lists.connections.length ? (
              <div className="list">
                {lists.connections.map((c) => (
                  <div key={c._id} className="list-item">
                    <div className="grow">
                      <UserLine user={c.user} meta={c.user?.headline} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(c._id)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No connections yet" action={<Link to="/search?type=people&q=cse" className="btn btn-soft">Find people</Link>} />
            ))}
          {tab === 'mentorships' &&
            (lists.mentorships.length ? (
              <div className="list">
                {lists.mentorships.map((c) => (
                  <div key={c._id} className="list-item">
                    <div className="grow">
                      <UserLine user={c.user} meta={c.incoming ? 'You mentor them' : 'Your mentor'} />
                    </div>
                    <Badge tone="success" icon={HeartHandshake}>
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={HeartHandshake} title="No mentorships yet" action={<Link to="/alumni?mentorship=1" className="btn btn-soft">Find a mentor</Link>}>
                Alumni who are open to mentoring can be found in the alumni network.
              </EmptyState>
            ))}
          {tab === 'sent' &&
            (lists.outgoing.length ? (
              <div className="list">
                {lists.outgoing.map((c) => (
                  <div key={c._id} className="list-item">
                    <div className="grow">
                      <UserLine user={c.user} meta={`${c.kind === 'mentorship' ? 'Mentorship' : 'Connection'} request · ${timeAgo(c.createdAt)}`} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(c._id)}>
                      Withdraw
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No pending sent requests" />
            ))}
        </div>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <h2>People you may know</h2>
        {suggested.loading ? (
          <CardSkeleton count={1} lines={1} />
        ) : suggested.data?.items.length ? (
          <div className="list">
            {suggested.data.items.map((u) => (
              <div key={u._id} className="list-item">
                <div className="grow">
                  <UserLine user={u} meta={u.headline || u.department?.name} />
                </div>
                <Button size="sm" variant="soft" icon={UserPlus} onClick={() => connect(u._id)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small mb-0">No suggestions right now.</p>
        )}
      </section>
    </div>
  );
}
