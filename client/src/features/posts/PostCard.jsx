import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Flag, Link2, MessageCircle, MoreHorizontal, Pencil, Pin, Repeat2, Trash2 } from 'lucide-react';
import { api, fileUrl } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar, Badge, Button, ConfirmDialog, Dialog, Menu, MenuItem, TextField, VerifiedBadge } from '../../components/ui.jsx';
import { MentionTextarea, ReportDialog, RichText, SaveButton } from '../../components/common.jsx';
import { REACTIONS, label, POST_TYPES } from '../../utils/constants.js';
import { formatBytes, timeAgo } from '../../utils/format.js';
import Comments from './Comments.jsx';

function Attachments({ attachments = [] }) {
  const images = attachments.filter((a) => a.kind === 'image');
  const docs = attachments.filter((a) => a.kind !== 'image');
  return (
    <>
      {images.length > 0 && (
        <div className={`post-images n${Math.min(images.length, 4)}`}>
          {images.map((img) => (
            <a key={img.url} href={fileUrl(img.url)} target="_blank" rel="noopener noreferrer">
              <img src={fileUrl(img.url)} alt={img.name || 'Post image'} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="post-docs">
          {docs.map((d) => (
            <a key={d.url} className="doc-link" href={fileUrl(d.url)} target="_blank" rel="noopener noreferrer" download>
              <FileText size={18} className="subtle" aria-hidden="true" />
              <span className="grow truncate">{d.name}</span>
              <span className="xs subtle">{formatBytes(d.size)}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Poll({ post, onUpdate }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const voted = post.poll.myVote !== null && post.poll.myVote !== undefined;
  const vote = async (i) => {
    setBusy(true);
    try {
      const r = await api.post(`/posts/${post._id}/vote`, { option: i });
      onUpdate(r.post);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginBottom: 12 }} role="group" aria-label="Poll">
      {post.poll.options.map((o, i) => {
        const pct = post.poll.total ? Math.round((o.votes / post.poll.total) * 100) : 0;
        return (
          <button key={i} type="button" className={`poll-option ${post.poll.myVote === i ? 'mine' : ''}`} disabled={voted || busy} onClick={() => vote(i)} aria-label={voted ? `${o.text}: ${pct}%` : `Vote for ${o.text}`}>
            {voted && <span className="bar" style={{ width: `${pct}%` }} />}
            <span>{o.text}</span>
            {voted && <span className="small bold">{pct}%</span>}
          </button>
        );
      })}
      <div className="xs subtle">
        {post.poll.total} vote{post.poll.total === 1 ? '' : 's'}
        {!voted && ' · Vote to see results'}
      </div>
    </div>
  );
}

function ReactionButton({ post, onUpdate }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const timer = useRef();
  const current = REACTIONS.find(([v]) => v === post.myReaction);
  useEffect(() => () => clearTimeout(timer.current), []);

  const react = async (type) => {
    setOpen(false);
    const prev = { myReaction: post.myReaction, reactionCount: post.reactionCount };
    const removing = post.myReaction === type || (!type && post.myReaction);
    // Optimistic update
    onUpdate({ myReaction: removing ? null : type || 'like', reactionCount: post.reactionCount + (removing ? -1 : post.myReaction ? 0 : 1) });
    try {
      const r = removing ? await api.del(`/posts/${post._id}/react`) : await api.post(`/posts/${post._id}/react`, { type: type || 'like' });
      onUpdate(r);
    } catch (err) {
      onUpdate(prev);
      toast.error(err);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex' }} onMouseEnter={() => (timer.current = setTimeout(() => setOpen(true), 450))} onMouseLeave={() => (clearTimeout(timer.current), setOpen(false))}>
      {open && (
        <div className="reaction-picker" role="menu" aria-label="Choose a reaction">
          {REACTIONS.map(([v, emoji, l]) => (
            <button key={v} type="button" role="menuitem" onClick={() => react(v)} aria-label={l} title={l}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" className={current ? 'is-active' : ''} onClick={() => react(post.myReaction || null)} aria-pressed={!!current} onContextMenu={(e) => (e.preventDefault(), setOpen(true))} style={{ flex: 1 }}>
        <span aria-hidden="true">{current ? current[1] : '👍'}</span>
        <span className="label">{current ? current[2] : 'Like'}</span>
      </Button>
    </div>
  );
}

function PostCard({ post, onChange, onRemove, showComments = false, canPin = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [commentsOpen, setCommentsOpen] = useState(showComments);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareText, setShareText] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (patch) => onChange?.(post._id, patch);
  const author = post.author;
  const isStaff = user?.role !== 'member';

  const saveEdit = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/posts/${post._id}`, { content: draft });
      update(r.post);
      setEditing(false);
      toast.success('Post updated');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/posts/${post._id}`);
      onRemove?.(post._id);
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      await api.post(`/posts/${post._id}/share`, { content: shareText });
      update({ shareCount: (post.shareCount || 0) + 1 });
      setSharing(false);
      setShareText('');
      toast.success('Shared to your feed');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/posts/${post._id}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const togglePin = async () => {
    try {
      const r = await api.post(`/posts/${post._id}/pin`);
      update({ pinned: r.pinned });
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <article className="card post-card" aria-labelledby={`post-${post._id}-author`}>
      <header className="post-head">
        <Link to={`/u/${author?._id}`} aria-hidden="true" tabIndex={-1}>
          <Avatar user={author} />
        </Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row-wrap" style={{ gap: 6 }}>
            <Link id={`post-${post._id}-author`} to={`/u/${author?._id}`} className="post-author">
              {author?.name || 'Deleted member'}
            </Link>
            <VerifiedBadge user={author} compact />
            {post.type !== 'post' && <Badge tone={post.type === 'question' ? 'accent' : post.type === 'research_update' ? 'violet' : 'primary'}>{label(POST_TYPES, post.type)}</Badge>}
            {post.type === 'announcement' && (post.official ? <Badge tone="violet">Official</Badge> : <Badge>Community</Badge>)}
            {post.pinned && <Badge icon={Pin}>Pinned</Badge>}
          </div>
          <div className="xs muted">
            {[author?.department?.code, author?.affiliation].filter(Boolean).join(' · ')}
            {' · '}
            <Link to={`/posts/${post._id}`} className="subtle">
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
            </Link>
            {post.editedAt && ' · edited'}
            {post.community && (
              <>
                {' · in '}
                <Link to={`/communities/${post.community.slug}`}>{post.community.name}</Link>
              </>
            )}
          </div>
        </div>
        <Menu label="Post options" trigger={({ toggle, ...aria }) => <Button variant="ghost" size="sm" icon={MoreHorizontal} onClick={toggle} {...aria} />}>
          <MenuItem icon={Link2} onClick={copyLink}>
            Copy link
          </MenuItem>
          {post.mine && (
            <MenuItem icon={Pencil} onClick={() => (setDraft(post.content), setEditing(true))}>
              Edit post
            </MenuItem>
          )}
          {canPin && (
            <MenuItem icon={Pin} onClick={togglePin}>
              {post.pinned ? 'Unpin' : 'Pin to community'}
            </MenuItem>
          )}
          {(post.mine || isStaff) && (
            <MenuItem icon={Trash2} danger onClick={() => setConfirmDelete(true)}>
              {post.mine ? 'Delete post' : 'Remove (moderator)'}
            </MenuItem>
          )}
          {!post.mine && (
            <MenuItem icon={Flag} onClick={() => setReporting(true)}>
              Report post
            </MenuItem>
          )}
        </Menu>
      </header>

      {editing ? (
        <div className="stack" style={{ margin: '12px 0' }}>
          <MentionTextarea value={draft} onChange={setDraft} maxLength={5000} aria-label="Edit post" />
          <div className="form-actions">
            <Button size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={saveEdit} loading={busy} disabled={!draft.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        post.content && <RichText text={post.content} />
      )}

      {post.sharedFrom &&
        (post.sharedFrom.removed ? (
          <div className="shared-post muted small">The original post is no longer available.</div>
        ) : (
          <div className="shared-post">
            <div className="row small">
              <Avatar user={post.sharedFrom.author} size="xs" />
              <Link to={`/u/${post.sharedFrom.author?._id}`} className="bold" style={{ color: 'inherit' }}>
                {post.sharedFrom.author?.name}
              </Link>
              <span className="subtle xs">{timeAgo(post.sharedFrom.createdAt)}</span>
            </div>
            <RichText text={post.sharedFrom.content} className="post-body small" />
            <Attachments attachments={post.sharedFrom.attachments} />
            <Link to={`/posts/${post.sharedFrom._id}`} className="xs">
              View original
            </Link>
          </div>
        ))}

      <Attachments attachments={post.attachments} />
      {post.poll && <Poll post={post} onUpdate={(p) => update(p)} />}

      <div className="post-stats">
        <span>{post.reactionCount > 0 && `${post.reactionCount} reaction${post.reactionCount === 1 ? '' : 's'}`}</span>
        <span>
          {post.commentCount > 0 && (
            <button className="btn-ghost" style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => setCommentsOpen(true)}>
              {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
            </button>
          )}
          {post.shareCount > 0 && ` · ${post.shareCount} share${post.shareCount === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="post-actions">
        <ReactionButton post={post} onUpdate={update} />
        <Button variant="ghost" size="sm" icon={MessageCircle} onClick={() => setCommentsOpen((o) => !o)} aria-expanded={commentsOpen}>
          <span className="label">Comment</span>
        </Button>
        <Button variant="ghost" size="sm" icon={Repeat2} onClick={() => setSharing(true)}>
          <span className="label">Share</span>
        </Button>
        <SaveButton type="post" id={post._id} saved={post.saved} onChange={(saved) => update({ saved })} />
      </div>

      {commentsOpen && <Comments postId={post._id} onCountChange={(d) => update({ commentCount: Math.max(0, (post.commentCount || 0) + d) })} />}

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} title="Delete this post?" confirmLabel="Delete" danger busy={busy}>
        This removes the post and its comments from the feed. This cannot be undone.
      </ConfirmDialog>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post._id} />
      <Dialog
        open={sharing}
        onClose={() => setSharing(false)}
        title="Share to your feed"
        footer={
          <>
            <Button onClick={() => setSharing(false)}>Cancel</Button>
            <Button variant="primary" onClick={share} loading={busy}>
              Share
            </Button>
          </>
        }
      >
        <TextField as="textarea" label="Add a comment (optional)" value={shareText} onChange={(e) => setShareText(e.target.value)} maxLength={2000} />
      </Dialog>
    </article>
  );
}

export default memo(PostCard);
