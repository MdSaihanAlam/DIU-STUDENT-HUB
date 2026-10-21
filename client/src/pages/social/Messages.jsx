import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Info, MessageSquare, Send } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDocumentTitle, useInterval } from '../../hooks/index.js';
import { Alert, Avatar, Badge, Button, ConfirmDialog, EmptyState, Skeleton, Spinner } from '../../components/ui.jsx';
import { ReportDialog } from '../../components/common.jsx';
import { formatTime, timeAgo } from '../../utils/format.js';

function ConversationList({ items, loading, activeId }) {
  if (loading)
    return (
      <div className="stack" style={{ padding: 12 }}>
        <Skeleton h={48} />
        <Skeleton h={48} />
        <Skeleton h={48} />
      </div>
    );
  if (!items.length)
    return (
      <EmptyState icon={MessageSquare} title="No conversations">
        Message someone from their profile, a housing listing or a research project.
      </EmptyState>
    );
  return (
    <nav aria-label="Conversations">
      {items.map((c) => (
        <Link key={c._id} to={`/messages/${c._id}`} className={`convo-item ${c._id === activeId ? 'active' : ''}`} aria-current={c._id === activeId ? 'page' : undefined}>
          <Avatar user={c.other} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row between">
              <span className={`truncate ${c.unread ? 'bold' : ''}`}>{c.other?.name}</span>
              <span className="xs subtle" style={{ flexShrink: 0 }}>
                {timeAgo(c.lastMessageAt)}
              </span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {c.isRequest && <Badge tone="warning">Request</Badge>}
              <span className={`small truncate ${c.unread ? '' : 'muted'}`}>{c.lastMessagePreview}</span>
              {c.unread > 0 && <span className="nav-count" style={{ background: 'var(--primary)', color: '#fff', borderRadius: 9, padding: '0 6px', fontSize: '0.7rem', marginLeft: 'auto' }}>{c.unread}</span>}
            </div>
          </div>
        </Link>
      ))}
    </nav>
  );
}

function Thread({ id, onActivity }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const bottom = useRef(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/conversations/${id}/messages`);
      setData(d);
      setError(null);
      if (d.items.length !== lastCount.current) {
        lastCount.current = d.items.length;
        onActivity?.();
      }
    } catch (e) {
      setError(e);
    }
  }, [id, onActivity]);

  useEffect(() => {
    setData(null);
    lastCount.current = 0;
    load();
  }, [load]);
  // Poll for new messages while the thread is open (no websocket server needed).
  useInterval(load, 5000, !!data);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [data?.items.length]);

  const send = async (e) => {
    e?.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const r = await api.post(`/conversations/${id}/messages`, { body });
      setData((d) => ({ ...d, items: [...d.items, r.message], conversation: { ...d.conversation, isRequest: false } }));
      lastCount.current += 1;
      setBody('');
      onActivity?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setSending(false);
    }
  };

  const accept = async () => {
    try {
      await api.post(`/conversations/${id}/accept`);
      load();
      onActivity?.();
    } catch (err) {
      toast.error(err);
    }
  };
  const decline = async () => {
    try {
      await api.post(`/conversations/${id}/decline`);
      onActivity?.();
      navigate('/messages');
    } catch (err) {
      toast.error(err);
    }
  };
  const block = async () => {
    try {
      await api.post(`/users/${data.conversation.other._id}/block`);
      toast.success('Member blocked');
      onActivity?.();
      navigate('/messages');
    } catch (err) {
      toast.error(err);
    }
  };

  if (error)
    return (
      <div className="thread" style={{ padding: 16 }}>
        <Alert tone="danger">{error.message}</Alert>
      </div>
    );
  if (!data)
    return (
      <div className="thread" style={{ display: 'grid', placeItems: 'center' }}>
        <Spinner />
      </div>
    );
  const { conversation: c, items } = data;

  return (
    <section className="thread" aria-label={`Conversation with ${c.other?.name}`}>
      <header className="thread-head">
        <Link to="/messages" className="btn btn-ghost btn-icon btn-sm show-mobile" aria-label="Back to conversations">
          <ArrowLeft size={18} />
        </Link>
        <Avatar user={c.other} size="sm" />
        <div className="grow" style={{ minWidth: 0 }}>
          {c.other?._id ? (
            <Link to={`/u/${c.other._id}`} className="bold" style={{ color: 'inherit' }}>
              {c.other.name}
            </Link>
          ) : (
            <span className="bold">{c.other?.name}</span>
          )}
          {c.context && <div className="xs muted truncate">{c.context}</div>}
        </div>
        {c.other?._id && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
              Report
            </Button>
            <Button variant="ghost" size="sm" icon={Ban} onClick={() => setConfirmBlock(true)}>
              <span className="hide-mobile">Block</span>
            </Button>
          </>
        )}
      </header>
      {c.isRequest && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <Alert tone="info" icon={Info}>
            <div className="row-wrap between">
              <span>{c.other?.name} wants to message you. They won’t know you’ve read it until you reply or accept.</span>
              <span className="row">
                <Button size="sm" variant="primary" onClick={accept}>
                  Accept
                </Button>
                <Button size="sm" onClick={decline}>
                  Decline
                </Button>
              </span>
            </div>
          </Alert>
        </div>
      )}
      <div className="thread-body" aria-live="polite">
        {items.map((m, i) => {
          const showDay = i === 0 || new Date(items[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m._id} style={{ display: 'contents' }}>
              {showDay && (
                <div className="xs subtle" style={{ textAlign: 'center', margin: '8px 0' }}>
                  {new Date(m.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
              )}
              <div className={`bubble ${m.mine ? 'mine' : ''}`}>
                {m.body}
                <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {c.status !== 'blocked' && (
        <form className="thread-input" onSubmit={send}>
          <label htmlFor="msg" className="sr-only">
            Message
          </label>
          <textarea
            id="msg"
            className="textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            maxLength={4000}
          />
          <Button type="submit" variant="primary" icon={Send} loading={sending} disabled={!body.trim()} aria-label="Send message" />
        </form>
      )}
      <ConfirmDialog open={confirmBlock} onClose={() => setConfirmBlock(false)} onConfirm={block} title={`Block ${c.other?.name}?`} confirmLabel="Block" danger>
        They won’t be able to message you, see your posts in their feed, or connect with you. You can unblock them in Settings.
      </ConfirmDialog>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={c.other?._id} />
    </section>
  );
}

export default function Messages() {
  const { id } = useParams();
  useDocumentTitle('Messages');
  const list = useApi('/conversations');
  const refresh = useCallback(() => {
    list.reload();
    window.dispatchEvent(new Event('hub:counts-changed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload]);
  useInterval(list.reload, 20000);

  return (
    <div className={`card card-flush messenger ${id ? 'has-thread' : ''}`}>
      <div className="convo-list">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Messages</h1>
          <p className="xs subtle mb-0">Updates every few seconds · not end-to-end encrypted</p>
        </div>
        <ConversationList items={list.data?.items || []} loading={list.loading && !list.data} activeId={id} />
      </div>
      {id ? (
        <Thread key={id} id={id} onActivity={refresh} />
      ) : (
        <div className="thread" style={{ display: 'grid', placeItems: 'center' }}>
          <EmptyState icon={MessageSquare} title="Select a conversation" />
        </div>
      )}
    </div>
  );
}
