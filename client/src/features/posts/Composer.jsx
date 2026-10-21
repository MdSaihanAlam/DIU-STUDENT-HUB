import { useState } from 'react';
import { BarChart3, HelpCircle, Megaphone, Paperclip, FlaskConical, Plus, X } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Avatar, Button } from '../../components/ui.jsx';
import { MentionTextarea } from '../../components/common.jsx';
import { formatBytes } from '../../utils/format.js';

const TYPES = [
  ['post', 'Post', null],
  ['question', 'Question', HelpCircle],
  ['poll', 'Poll', BarChart3],
  ['research_update', 'Research update', FlaskConical],
  ['announcement', 'Announcement', Megaphone],
];

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.pptx,.xlsx,.doc,.ppt,.txt';

export default function Composer({ onCreated, community, placeholder }) {
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('post');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canOfficial = user?.role !== 'member' || (user?.affiliation === 'faculty' && user?.affiliationVerified);

  const reset = () => {
    setContent('');
    setFiles([]);
    setOptions(['', '']);
    setType('post');
    setExpanded(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const pollOptions = options.map((o) => o.trim()).filter(Boolean);
    if (type === 'poll' && pollOptions.length < 2) return toast.error('Add at least two poll options');
    if (!content.trim() && !files.length) return;
    const fd = new FormData();
    fd.append('type', type);
    fd.append('content', content);
    if (community) fd.append('community', community);
    if (type === 'poll') fd.append('pollOptions', JSON.stringify(pollOptions));
    files.forEach((f) => fd.append('files', f));
    setBusy(true);
    try {
      const r = await api.post('/posts', fd);
      onCreated?.(r.post);
      reset();
      toast.success(type === 'announcement' && !r.post.official ? 'Posted as a community announcement' : 'Posted');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (list) => {
    const arr = [...list].filter((f) => {
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 8 MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...arr].slice(0, 4));
    setExpanded(true);
  };

  return (
    <form className="card composer" onSubmit={submit} aria-label="Create a post">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar user={user} />
        <div className="grow">
          {expanded && (
            <div className="composer-types" role="radiogroup" aria-label="Post type">
              {TYPES.map(([v, l, Icon]) => (
                <button key={v} type="button" role="radio" aria-checked={type === v} className="chip" aria-pressed={type === v} onClick={() => setType(v)} style={{ minHeight: 30 }}>
                  {Icon && <Icon size={14} aria-hidden="true" />}
                  {l}
                </button>
              ))}
            </div>
          )}
          <label htmlFor="composer-text" className="sr-only">
            Post content
          </label>
          <MentionTextarea
            id="composer-text"
            value={content}
            onChange={setContent}
            onFocus={() => setExpanded(true)}
            placeholder={placeholder || (type === 'question' ? 'Ask the community a question…' : 'Share something with the DIU community… use #hashtags and @mentions')}
            maxLength={5000}
            rows={expanded ? 4 : 2}
          />
          {type === 'announcement' && !canOfficial && <p className="xs subtle mb-0">Only verified faculty and staff can publish official announcements. Yours will be labeled “community announcement”.</p>}
          {type === 'poll' && (
            <div className="stack" style={{ gap: 6, marginTop: 8 }}>
              {options.map((o, i) => (
                <div key={i} className="row">
                  <input className="input" value={o} onChange={(e) => setOptions((opts) => opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} maxLength={120} aria-label={`Poll option ${i + 1}`} />
                  {options.length > 2 && <Button variant="ghost" size="sm" icon={X} onClick={() => setOptions((opts) => opts.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} />}
                </div>
              ))}
              {options.length < 6 && (
                <Button variant="ghost" size="sm" icon={Plus} onClick={() => setOptions((o) => [...o, ''])} style={{ alignSelf: 'flex-start' }}>
                  Add option
                </Button>
              )}
            </div>
          )}
          {files.length > 0 && (
            <div className="file-pills">
              {files.map((f, i) => (
                <span key={i} className="file-pill">
                  <span className="truncate" style={{ maxWidth: 180 }}>
                    {f.name}
                  </span>
                  <span className="subtle">{formatBytes(f.size)}</span>
                  <Button variant="ghost" size="sm" icon={X} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="composer-tools">
        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
          <Paperclip size={16} aria-hidden="true" /> <span className="hide-mobile">Photo / file</span>
          <input type="file" multiple hidden accept={ACCEPT} onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} aria-label="Attach images or documents" />
        </label>
        <Button variant="ghost" size="sm" icon={BarChart3} onClick={() => (setType('poll'), setExpanded(true))}>
          <span className="hide-mobile">Poll</span>
        </Button>
        <Button variant="ghost" size="sm" icon={HelpCircle} onClick={() => (setType('question'), setExpanded(true))}>
          <span className="hide-mobile">Question</span>
        </Button>
        <span className="grow" />
        {expanded && (
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!content.trim() && !files.length}>
          Post
        </Button>
      </div>
    </form>
  );
}
