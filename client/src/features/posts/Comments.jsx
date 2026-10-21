import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePaginated } from '../../hooks/index.js';
import { Avatar, Button, LoadMore, Skeleton } from '../../components/ui.jsx';
import { MentionTextarea, ReportDialog, RichText } from '../../components/common.jsx';
import { timeAgo } from '../../utils/format.js';

function CommentForm({ postId, parent, onAdded, autoFocus, placeholder = 'Write a comment…' }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/posts/${postId}/comments`, { content: text, parent });
      onAdded(r.comment);
      setText('');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="comment" onSubmit={submit}>
      <Avatar user={user} size="sm" />
      <div className="grow stack" style={{ gap: 6 }}>
        <MentionTextarea
          value={text}
          onChange={setText}
          placeholder={placeholder}
          maxLength={2000}
          rows={1}
          style={{ minHeight: 40 }}
          autoFocus={autoFocus}
          aria-label={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        {text.trim() && (
          <div className="form-actions">
            <Button size="sm" variant="primary" type="submit" loading={busy}>
              {parent ? 'Reply' : 'Comment'}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

function CommentItem({ c, postId, onDelete, onReply, isReply }) {
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { user } = useAuth();
  const isStaff = user?.role !== 'member';
  return (
    <div>
      <div className="comment">
        <Avatar user={c.author} size="sm" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="comment-bubble">
            <Link to={`/u/${c.author?._id}`} className="small bold" style={{ color: 'inherit' }}>
              {c.author?.name || 'Deleted member'}
            </Link>
            {c.removed ? <div className="small subtle">This comment was removed.</div> : <RichText text={c.content} className="pre-wrap" />}
          </div>
          <div className="comment-actions">
            <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
            {!c.removed && !isReply && <button onClick={() => setReplying((r) => !r)}>Reply</button>}
            {!c.removed && (c.mine || isStaff) && <button onClick={() => onDelete(c)}>Delete</button>}
            {!c.removed && !c.mine && <button onClick={() => setReporting(true)}>Report</button>}
          </div>
        </div>
      </div>
      {!isReply && (
        <div className="replies">
          {c.replies?.map((r) => (
            <CommentItem key={r._id} c={r} postId={postId} onDelete={onDelete} isReply />
          ))}
          {replying && (
            <CommentForm
              postId={postId}
              parent={c._id}
              autoFocus
              placeholder={`Reply to ${c.author?.name || 'comment'}…`}
              onAdded={(reply) => {
                onReply(c._id, reply);
                setReplying(false);
              }}
            />
          )}
        </div>
      )}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={c._id} />
    </div>
  );
}

export default function Comments({ postId, onCountChange }) {
  const toast = useToast();
  const { items, setItems, loading, hasMore, loadMore, loadingMore, total, updateItem, prependItem } = usePaginated(`/posts/${postId}/comments`, {});

  const del = async (c) => {
    try {
      await api.del(`/posts/${postId}/comments/${c._id}`);
      const markRemoved = (x) => (x._id === c._id ? { ...x, removed: true, content: '' } : x);
      setItems((list) => list.map((x) => ({ ...markRemoved(x), replies: x.replies?.map(markRemoved) })));
      onCountChange?.(-1);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <section aria-label="Comments" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
      <CommentForm
        postId={postId}
        onAdded={(c) => {
          prependItem(c);
          onCountChange?.(1);
        }}
      />
      {loading ? (
        <div className="stack" style={{ marginTop: 12 }}>
          <Skeleton h={44} />
          <Skeleton h={44} />
        </div>
      ) : (
        items.map((c) => (
          <CommentItem
            key={c._id}
            c={c}
            postId={postId}
            onDelete={del}
            onReply={(parentId, reply) => {
              updateItem(parentId, (p) => ({ replies: [...(p.replies || []), reply] }));
              onCountChange?.(1);
            }}
          />
        ))
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} total={total} shown={items.length} />
    </section>
  );
}
