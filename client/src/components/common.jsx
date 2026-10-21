import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ShieldAlert } from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { REPORT_REASONS } from '../utils/constants.js';
import { Avatar, Button, Dialog, SelectField, TextField, VerifiedBadge } from './ui.jsx';
import { useDebounce } from '../hooks/index.js';

/** Toggle a bookmark on any supported item. */
export function SaveButton({ type, id, saved: initial, size = 'sm', withLabel = false, onChange }) {
  const [saved, setSaved] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setSaved(!!initial), [initial]);
  const toggle = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setBusy(true);
    try {
      const r = await api.post('/bookmarks/toggle', { targetType: type, targetId: id });
      setSaved(r.saved);
      onChange?.(r.saved);
      toast.success(r.saved ? 'Saved to your list' : 'Removed from saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={saved ? 'soft' : 'ghost'} size={size} icon={saved ? BookmarkCheck : Bookmark} onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'}>
      {withLabel ? (saved ? 'Saved' : 'Save') : null}
    </Button>
  );
}

/** Report dialog for any content type. Copyright reports collect takedown details. */
export function ReportDialog({ open, onClose, targetType, targetId }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [claimant, setClaimant] = useState('');
  const [work, setWork] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (reason === 'copyright' && !goodFaith) return toast.error('Please confirm the good-faith statement');
    setBusy(true);
    try {
      const r = await api.post('/reports', {
        targetType,
        targetId,
        reason,
        details,
        takedown: reason === 'copyright' ? { claimantName: claimant, originalWork: work, goodFaith } : undefined,
      });
      toast.success(r.message);
      onClose();
      setReason('');
      setDetails('');
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
      title="Report content"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" type="submit" form="report-form" loading={busy} disabled={!reason}>
            Submit report
          </Button>
        </>
      }
    >
      <form id="report-form" className="stack" onSubmit={submit}>
        <p className="muted small mb-0">Reports are confidential. Moderators review every report against the community guidelines.</p>
        <SelectField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} options={REPORT_REASONS} placeholder="Choose a reason" />
        {reason === 'copyright' && (
          <>
            <TextField label="Your name (rights holder or authorised agent)" required value={claimant} onChange={(e) => setClaimant(e.target.value)} maxLength={120} />
            <TextField label="Original work being infringed" required value={work} onChange={(e) => setWork(e.target.value)} maxLength={300} placeholder="Title, author, publisher or link" />
            <label className="check">
              <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
              <span>I believe in good faith that this use is not authorised by the rights holder.</span>
            </label>
          </>
        )}
        <TextField as="textarea" label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="Anything that helps moderators understand the problem" />
      </form>
    </Dialog>
  );
}

/** Small button + dialog combo. */
export function ReportButton({ targetType, targetId, size = 'sm', withLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={size} icon={ShieldAlert} onClick={() => setOpen(true)} aria-label="Report">
        {withLabel ? 'Report' : null}
      </Button>
      <ReportDialog open={open} onClose={() => setOpen(false)} targetType={targetType} targetId={targetId} />
    </>
  );
}

export function UserLine({ user, meta, size = '', link = true }) {
  if (!user) return <span className="muted">Deleted member</span>;
  const name = (
    <span className="row" style={{ gap: 5 }}>
      <span className="bold truncate">{user.name}</span>
      <VerifiedBadge user={user} compact />
    </span>
  );
  return (
    <div className="row" style={{ minWidth: 0 }}>
      <Avatar user={user} size={size} />
      <div className="grow" style={{ lineHeight: 1.3 }}>
        {link && user._id ? (
          <Link to={`/u/${user._id}`} style={{ color: 'inherit' }}>
            {name}
          </Link>
        ) : (
          name
        )}
        {meta && <div className="small muted truncate">{meta}</div>}
      </div>
    </div>
  );
}

const TOKEN_RE = /(@\[[^\]]{1,80}\]\([a-f\d]{24}\)|#[\p{L}\p{N}_]{2,40}|https?:\/\/[^\s<]+)/gu;

/** Render post text with mentions, hashtags and links. Text is never injected as HTML. */
export function RichText({ text = '', className = 'post-body' }) {
  const parts = text.split(TOKEN_RE);
  return (
    <div className={className}>
      {parts.map((p, i) => {
        if (!p) return null;
        const mention = p.match(/^@\[([^\]]+)\]\(([a-f\d]{24})\)$/);
        if (mention)
          return (
            <Link key={i} className="mention" to={`/u/${mention[2]}`}>
              @{mention[1]}
            </Link>
          );
        if (/^#[\p{L}\p{N}_]{2,40}$/u.test(p))
          return (
            <Link key={i} className="tag" to={`/feed?hashtag=${encodeURIComponent(p.slice(1).toLowerCase())}`}>
              {p}
            </Link>
          );
        if (/^https?:\/\//.test(p))
          return (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow ugc">
              {p.length > 60 ? `${p.slice(0, 57)}…` : p}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </div>
  );
}

export const plainText = (t = '') => t.replace(/@\[([^\]]+)\]\([a-f\d]{24}\)/g, '@$1');

/**
 * Textarea with "@" mention autocomplete. Inserts tokens in the form @[Name](userId),
 * which the server turns into notifications and the client renders as profile links.
 */
export function MentionTextarea({ value, onChange, className = 'textarea', ...rest }) {
  const ref = useRef(null);
  const [query, setQuery] = useState(null);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const q = useDebounce(query, 200);

  useEffect(() => {
    if (!q || q.length < 2) return setResults([]);
    let cancelled = false;
    api
      .get('/users', { q, limit: 5 })
      .then((d) => !cancelled && setResults(d.items))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q]);

  const detect = (text, caret) => {
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\p{L}\p{N}_ .]{0,30})$/u);
    setQuery(m ? m[1] : null);
    setActive(0);
  };

  const pick = (u) => {
    const el = ref.current;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([\p{L}\p{N}_ .]{0,30})$/u, `@[${u.name}](${u._id}) `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    setResults([]);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const onKeyDown = (e) => {
    if (!results.length || query === null) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setQuery(null);
    }
  };

  return (
    <div className="mention-box">
      <textarea
        ref={ref}
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        {...rest}
      />
      {query !== null && results.length > 0 && (
        <div className="mention-list" role="listbox" aria-label="Mention suggestions">
          {results.map((u, i) => (
            <button key={u._id} type="button" role="option" aria-selected={i === active} className="menu-item" style={i === active ? { background: 'var(--bg-hover)' } : undefined} onMouseDown={(e) => (e.preventDefault(), pick(u))}>
              <Avatar user={u} size="xs" />
              <span className="truncate">{u.name}</span>
              <span className="subtle xs">{u.department?.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

let departmentsCache = null;
export function useDepartments() {
  const [departments, setDepartments] = useState(departmentsCache || []);
  useEffect(() => {
    if (departmentsCache) return;
    api
      .get('/public/departments')
      .then((d) => {
        departmentsCache = d.items;
        setDepartments(d.items);
      })
      .catch(() => {});
  }, []);
  return departments;
}

export function DepartmentSelect({ value, onChange, label = 'Department', placeholder = 'All departments', ...rest }) {
  const departments = useDepartments();
  return <SelectField label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} options={departments.map((d) => [d._id, `${d.code} — ${d.name}`])} placeholder={placeholder} {...rest} />;
}

/** Inline department filter used in filter bars (no label). */
export function DepartmentFilter({ value, onChange }) {
  const departments = useDepartments();
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Filter by department">
      <option value="">All departments</option>
      {departments.map((d) => (
        <option key={d._id} value={d._id}>
          {d.code}
        </option>
      ))}
    </select>
  );
}

/** Start a conversation with someone (opens messages afterwards). */
export function MessageDialog({ open, onClose, user, context, endpoint, title }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = endpoint ? await api.post(endpoint, { message: body }) : await api.post('/conversations', { userId: user._id, message: body, context });
      toast.success('Message sent');
      onClose();
      setBody('');
      navigate(`/messages/${r.conversationId}`);
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
      title={title || `Message ${user?.name || ''}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="msg-form" loading={busy} disabled={body.trim().length < 2}>
            Send
          </Button>
        </>
      }
    >
      <form id="msg-form" onSubmit={send} className="stack">
        {context && <p className="small muted mb-0">{context}</p>}
        <TextField as="textarea" label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required autoFocus placeholder="Introduce yourself and say why you're reaching out" />
        <p className="xs subtle mb-0">Be respectful. Never share passwords, OTPs or payment details in messages.</p>
      </form>
    </Dialog>
  );
}
