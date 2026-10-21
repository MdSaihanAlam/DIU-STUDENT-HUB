import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, Lock, Plus, Settings2, Trash2, Users, X } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, CardSkeleton, Dialog, EmptyState, ErrorState, LoadMore, SampleBadge, SelectField, Tabs, TextField } from '../../components/ui.jsx';
import { ReportButton, UserLine } from '../../components/common.jsx';
import Composer from '../../features/posts/Composer.jsx';
import PostCard from '../../features/posts/PostCard.jsx';
import { COMMUNITY_TYPES, label } from '../../utils/constants.js';

function Posts({ community, canPost, canModerate }) {
  const list = usePaginated('/posts', { community: community._id }, { limit: 10 });
  return (
    <div className="stack">
      {canPost && <Composer community={community._id} onCreated={list.prependItem} placeholder={`Post in ${community.name}…`} />}
      {list.loading ? (
        <CardSkeleton count={2} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState title="No posts yet">{canPost ? 'Start the first discussion.' : 'Join to start posting.'}</EmptyState>
        </div>
      ) : (
        list.items.map((p) => <PostCard key={p._id} post={p} onChange={list.updateItem} onRemove={list.removeItem} canPin={canModerate} />)
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </div>
  );
}

function Members({ slug, canModerate, onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState('active');
  const list = usePaginated(`/communities/${slug}/members`, { status }, { limit: 30 });
  const act = async (userId, action) => {
    try {
      await api.post(`/communities/${slug}/members/${userId}`, { action });
      toast.success('Done');
      list.reload();
      onChanged?.();
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <div className="card">
      {canModerate && (
        <Tabs
          tabs={[
            { value: 'active', label: 'Members' },
            { value: 'pending', label: 'Join requests' },
          ]}
          value={status}
          onChange={setStatus}
        />
      )}
      {list.loading ? (
        <CardSkeleton count={2} lines={1} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={Users} title={status === 'pending' ? 'No pending requests' : 'No members'} />
      ) : (
        <div className="list">
          {list.items.map((m) => (
            <div key={m._id} className="list-item">
              <div className="grow">
                <UserLine user={m.user} meta={m.role !== 'member' ? m.role : m.user?.department?.code} />
              </div>
              {canModerate && m.role !== 'owner' && (
                <div className="row">
                  {status === 'pending' ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => act(m.user._id, 'approve')}>
                        Approve
                      </Button>
                      <Button size="sm" onClick={() => act(m.user._id, 'remove')}>
                        Decline
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => act(m.user._id, m.role === 'moderator' ? 'demote' : 'promote')}>
                        {m.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
                      </Button>
                      <Button size="sm" variant="ghost" icon={X} onClick={() => act(m.user._id, 'remove')} aria-label={`Remove ${m.user.name}`} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </div>
  );
}

function SettingsDialog({ open, onClose, community, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    description: community.description || '',
    rules: community.rules || '',
    visibility: community.visibility,
    pinnedResources: community.pinnedResources?.map(({ title, url }) => ({ title, url })) || [],
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/communities/${community.slug}`, { ...form, pinnedResources: form.pinnedResources.filter((p) => p.title && p.url) });
      toast.success('Community updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  const setPin = (i, k, v) => setForm((f) => ({ ...f, pinnedResources: f.pinnedResources.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Community settings"
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField as="textarea" label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
        <TextField as="textarea" label="Rules" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} maxLength={2000} />
        <SelectField
          label="Who can join?"
          value={form.visibility}
          onChange={(e) => setForm({ ...form, visibility: e.target.value })}
          options={[
            ['public', 'Anyone (public)'],
            ['private', 'By approval (private)'],
          ]}
        />
        <div className="label">Pinned resources</div>
        {form.pinnedResources.map((p, i) => (
          <div key={i} className="row">
            <input className="input" value={p.title} onChange={(e) => setPin(i, 'title', e.target.value)} placeholder="Title" aria-label="Resource title" maxLength={120} />
            <input className="input" value={p.url} onChange={(e) => setPin(i, 'url', e.target.value)} placeholder="https:// or /resources/…" aria-label="Resource link" />
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setForm((f) => ({ ...f, pinnedResources: f.pinnedResources.filter((_, j) => j !== i) }))} aria-label="Remove pinned resource" />
          </div>
        ))}
        {form.pinnedResources.length < 10 && (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, pinnedResources: [...f.pinnedResources, { title: '', url: '' }] }))} style={{ alignSelf: 'flex-start' }}>
            Add link
          </Button>
        )}
      </div>
    </Dialog>
  );
}

export default function CommunityDetail() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'posts';
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/communities/${slug}`);
  useDocumentTitle(data?.community?.name || 'Community');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { community: c, membership, canModerate, canSeePosts, moderators, pendingCount } = data;
  const isMember = membership?.status === 'active';

  const join = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/communities/${slug}/join`);
      toast.success(r.membership.status === 'pending' ? 'Join request sent' : `Welcome to ${c.name}!`);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    setBusy(true);
    try {
      await api.post(`/communities/${slug}/leave`);
      toast.info(membership?.status === 'pending' ? 'Request cancelled' : `You left ${c.name}`);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <Link to="/communities" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> Communities
        </Link>
      </div>
      <section className="card card-flush">
        <div className="profile-cover" style={{ height: 110 }} />
        <div className="profile-head" style={{ marginTop: -36 }}>
          <div className="row-wrap" style={{ gap: 16 }}>
            <span className="avatar avatar-xl" style={{ borderRadius: 22, '--size': '84px' }} aria-hidden="true">
              {c.name[0]}
            </span>
            <div className="grow" style={{ minWidth: 200 }}>
              <h1 className="mb-0">{c.name}</h1>
              <div className="row-wrap small muted">
                <span>{c.memberCount} members</span>
                <Badge>{label(COMMUNITY_TYPES, c.type)}</Badge>
                {c.visibility === 'private' && (
                  <Badge icon={Lock} tone="warning">
                    Private
                  </Badge>
                )}
                {c.department && <Link to={`/departments/${c.department.slug}`}>{c.department.name}</Link>}
                <SampleBadge show={c.isDemo} />
              </div>
            </div>
            <div className="row">
              {isMember ? (
                <Button onClick={leave} loading={busy}>
                  Leave
                </Button>
              ) : membership?.status === 'pending' ? (
                <Button onClick={leave} loading={busy}>
                  Cancel request
                </Button>
              ) : (
                <Button variant="primary" onClick={join} loading={busy}>
                  {c.visibility === 'private' ? 'Request to join' : 'Join'}
                </Button>
              )}
              {canModerate && <Button icon={Settings2} onClick={() => setSettings(true)} aria-label="Community settings" />}
              <ReportButton targetType="community" targetId={c._id} size="" />
            </div>
          </div>
          {c.description && <p style={{ marginTop: 12 }} className="pre-wrap mb-0">{c.description}</p>}
        </div>
      </section>

      <div className="detail-grid">
        <div>
          <Tabs
            tabs={[
              { value: 'posts', label: 'Posts' },
              { value: 'members', label: 'Members', count: canModerate ? pendingCount : 0 },
            ]}
            value={tab}
            onChange={(v) => setSp({ tab: v }, { replace: true })}
          />
          {tab === 'members' ? (
            <Members slug={slug} canModerate={canModerate} onChanged={reload} />
          ) : canSeePosts ? (
            <Posts community={c} canPost={isMember} canModerate={canModerate} />
          ) : (
            <Alert tone="info" icon={Lock}>
              This is a private community. Request to join to see posts.
            </Alert>
          )}
        </div>
        <aside className="stack-lg">
          {c.pinnedResources?.length > 0 && (
            <section className="card">
              <h3>Pinned resources</h3>
              <div className="list">
                {c.pinnedResources.map((p) => (
                  <a key={p._id || p.url} className="list-item" href={p.url} {...(p.url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ color: 'inherit' }}>
                    <Link2 size={15} className="subtle" aria-hidden="true" />
                    <span className="small bold">{p.title}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
          {c.rules && (
            <section className="card">
              <h3>Rules</h3>
              <p className="small pre-wrap mb-0">{c.rules}</p>
            </section>
          )}
          <section className="card">
            <h3>Moderators</h3>
            <div className="list">
              {moderators.map((m) => (
                <Link key={m._id} to={`/u/${m._id}`} className="list-item" style={{ color: 'inherit' }}>
                  <Avatar user={m} size="sm" />
                  <span className="small bold grow">{m.name}</span>
                  <Badge>{m.role}</Badge>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {canModerate && settings && <SettingsDialog open={settings} onClose={() => setSettings(false)} community={c} onSaved={reload} />}
    </div>
  );
}
