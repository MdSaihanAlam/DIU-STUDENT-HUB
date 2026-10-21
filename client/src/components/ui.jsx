import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, FlaskConical, Inbox, Search, Star, UploadCloud, X } from 'lucide-react';
import { fileUrl } from '../services/api.js';
import { formatBytes, initials } from '../utils/format.js';

export function Spinner({ label = 'Loading' }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner />
    </div>
  );
}

export const Button = forwardRef(function Button({ variant = 'default', size, loading, icon: Icon, children, className = '', block, ...rest }, ref) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', !children && Icon && 'btn-icon', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type="button" className={cls} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export function Field({ label, hint, error, children, className = '', required, htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--danger)' }}> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="error-text" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

/** Input with its own label wiring. */
export function TextField({ label, hint, error, required, className, as = 'input', children, ...props }) {
  const id = useId();
  const Comp = as;
  const cls = as === 'textarea' ? 'textarea' : as === 'select' ? 'select' : 'input';
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Comp id={id} className={cls} aria-invalid={error ? 'true' : undefined} required={required} {...props}>
        {children}
      </Comp>
    </Field>
  );
}

export function SelectField({ options, placeholder, ...props }) {
  return (
    <TextField as="select" {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </TextField>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', ...rest }) {
  return (
    <div className="input-icon">
      <Search size={17} aria-hidden="true" />
      <input type="search" className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} {...rest} />
    </div>
  );
}

// Curated gradient pairs; each name always gets the same one so people are recognisable.
const AVATAR_GRADIENTS = [
  ['#3d63ff', '#6b4dff'],
  ['#0891b2', '#22d3ee'],
  ['#7c3aed', '#c084fc'],
  ['#db2777', '#f472b6'],
  ['#ea580c', '#fbbf24'],
  ['#059669', '#34d399'],
  ['#1d3166', '#3d63ff'],
  ['#9333ea', '#3d63ff'],
];
const gradientFor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
};

export function Avatar({ user, src, name, size = '', className = '', style }) {
  const n = name || user?.name || '?';
  const url = src || user?.avatarUrl;
  const [failed, setFailed] = useState(false);
  const cls = `avatar ${size ? `avatar-${size}` : ''} ${className}`;
  if (url && !failed) return <img className={cls} src={fileUrl(url)} alt="" loading="lazy" onError={() => setFailed(true)} style={style} />;
  return (
    <span className={cls} aria-hidden="true" style={{ '--avatar-bg': gradientFor(n), ...style }}>
      {initials(n)}
    </span>
  );
}

/** Square tile showing a "logo" letter for communities/departments, coloured by name. */
export function LetterTile({ name = '?', size = 48, radius = 14, children }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ '--size': `${size}px`, borderRadius: radius, '--avatar-bg': gradientFor(name), boxShadow: 'none' }}>
      {children || name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Colour-coded icon tile. tone: blue | cyan | violet | pink | amber | emerald */
export function IconTile({ icon: Icon, tone = 'blue', size = '' }) {
  return (
    <span className={`icon-tile tone-${tone} ${size}`} aria-hidden="true">
      <Icon size={size === 'lg' ? 24 : size === 'sm' ? 17 : 20} />
    </span>
  );
}

/** 0–4 password strength score (length, variety, no obvious patterns). */
export function scorePassword(p = '') {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  if (/^(.)\1+$/.test(p) || /^(password|12345678|qwerty)/i.test(p)) s = 1;
  return Math.max(1, Math.min(4, s));
}

export function PasswordStrength({ value }) {
  const score = scorePassword(value);
  if (!value) return null;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="stack" style={{ gap: 4 }} aria-live="polite">
      <div className="strength" data-score={score} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="xs subtle">Password strength: {labels[score]}</span>
    </div>
  );
}

export function Badge({ tone, children, icon: Icon, title }) {
  return (
    <span className={`badge ${tone ? `badge-${tone}` : ''}`} title={title}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function VerifiedBadge({ user, compact }) {
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'moderator') {
    return <Badge tone="violet" icon={BadgeCheck} title="Platform staff">{compact ? '' : user.role === 'admin' ? 'Admin' : 'Moderator'}</Badge>;
  }
  if (user.affiliationVerified) {
    return compact ? (
      <BadgeCheck size={15} style={{ color: 'var(--primary)', display: 'inline' }} aria-label={`Verified ${user.affiliation}`} />
    ) : (
      <Badge tone="primary" icon={BadgeCheck}>
        Verified {user.affiliation}
      </Badge>
    );
  }
  return compact ? null : <Badge>Unverified {user.affiliation}</Badge>;
}

export function SampleBadge({ show }) {
  if (!show) return null;
  return (
    <Badge tone="warning" icon={FlaskConical} title="Fictional demonstration data — not real information about DIU">
      Sample data
    </Badge>
  );
}

export function Skeleton({ h = 16, w = '100%', r, style }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 3, count = 3, avatar = true }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="row" style={{ marginBottom: 14 }}>
            {avatar && <Skeleton h={40} w={40} r="50%" />}
            <div className="grow stack" style={{ gap: 6 }}>
              <Skeleton h={12} w="40%" />
              <Skeleton h={10} w="25%" />
            </div>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {Array.from({ length: lines }).map((__, j) => (
              <Skeleton key={j} h={12} w={j === lines - 1 ? '60%' : '100%'} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card stack" style={{ gap: 10 }}>
          <Skeleton h={110} r={10} />
          <Skeleton h={14} w="80%" />
          <Skeleton h={10} w="50%" />
        </div>
      ))}
    </div>
  );
}

/** Small layered illustration used in empty states: a floating card stack with the feature icon. */
function EmptyArt({ Icon }) {
  return (
    <div className="empty-art" aria-hidden="true" style={{ position: 'relative' }}>
      <svg viewBox="0 0 132 104" width="132" height="104" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="ea-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3d63ff" stopOpacity=".18" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <ellipse cx="66" cy="96" rx="44" ry="6" fill="currentColor" opacity=".06" />
        <rect x="22" y="22" width="88" height="62" rx="14" fill="url(#ea-g)" transform="rotate(-6 66 53)" />
        <rect x="26" y="16" width="80" height="64" rx="14" fill="var(--bg-elevated)" stroke="var(--border-strong)" />
        <rect x="40" y="56" width="52" height="6" rx="3" fill="var(--bg-subtle)" />
        <rect x="48" y="66" width="36" height="6" rx="3" fill="var(--bg-subtle)" />
        <circle cx="112" cy="20" r="4" fill="#22d3ee" opacity=".7" />
        <circle cx="16" cy="40" r="3" fill="#a78bfa" opacity=".8" />
        <path d="M118 52l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#3d63ff" opacity=".55" />
      </svg>
      <div className="empty-icon" style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)', width: 44, height: 44, borderRadius: 14, margin: 0 }}>
        <Icon size={22} />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty">
      <EmptyArt Icon={Icon} />
      <h3>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: 420, margin: '0 auto 12px' }}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          <AlertTriangle size={26} aria-hidden="true" />
        </div>
        <h3>{error?.status === 404 ? 'Not found' : error?.status === 403 ? 'Access restricted' : title}</h3>
        <p className="muted">{error?.message || 'Please try again.'}</p>
        {onRetry && error?.status !== 404 && error?.status !== 403 && (
          <Button onClick={onRetry} variant="soft">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function Alert({ tone = 'info', icon: Icon = AlertTriangle, children, className = '' }) {
  return (
    <div className={`alert alert-${tone} ${className}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={18} aria-hidden="true" />
      <div className="grow">{children}</div>
    </div>
  );
}

export function LoadMore({ hasMore, loading, onClick, total, shown }) {
  if (!hasMore) {
    return shown > 0 && total > 10 ? <p className="subtle small" style={{ textAlign: 'center', margin: '16px 0' }}>You’ve reached the end</p> : null;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
      <Button onClick={onClick} loading={loading} variant="soft">
        Load more {total ? <span className="subtle">({shown} of {total})</span> : null}
      </Button>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].value);
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          className="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon && <t.icon size={16} aria-hidden="true" />}
          {t.label}
          {t.count ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Accessible modal dialog: focus trap, Escape to close, restores focus on close. */
export function Dialog({ open, onClose, title, children, footer, size }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [];
    setTimeout(() => {
      const first = el?.querySelector('[autofocus], input, textarea, select') || focusables()[0];
      first?.focus();
    }, 0);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = [...focusables()].filter((n) => !n.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog ${size === 'lg' ? 'dialog-lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close dialog" />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', children, confirmLabel = 'Confirm', danger, busy }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="muted">{children}</div>
    </Dialog>
  );
}

/** Dropdown menu with outside-click and Escape handling. */
export function Menu({ trigger, children, label = 'More options' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-label': label, 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div className="menu" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, danger, to, ...rest }) {
  const cls = `menu-item ${danger ? 'danger' : ''}`;
  if (to)
    return (
      <Link to={to} className={cls} role="menuitem">
        {Icon && <Icon size={16} aria-hidden="true" />}
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} role="menuitem" {...rest}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions, children, icon, tone = 'blue' }) {
  return (
    <header className="page-header rise">
      <div className="page-header-main">
        {icon && <IconTile icon={icon} tone={tone} size="lg" />}
        <div className="grow">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </header>
  );
}

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="row" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange(n)} style={{ color: '#f5a524' }}>
          <Star size={20} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

/** Drag-and-drop file picker. */
export function FileDrop({ accept, multiple, onFiles, files = [], hint, maxMB, onRemove, label = 'Choose a file or drag it here' }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handle = (list) => {
    const arr = [...list].filter((f) => !maxMB || f.size <= maxMB * 1024 * 1024);
    if (arr.length) onFiles(multiple ? arr : arr.slice(0, 1));
  };
  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={28} style={{ margin: '0 auto 8px' }} aria-hidden="true" />
        <div className="bold">{label}</div>
        {hint && <div className="small subtle">{hint}</div>}
        <input ref={inputRef} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => (handle(e.target.files), (e.target.value = ''))} />
      </div>
      {files.length > 0 && (
        <div className="file-pills">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="file-pill">
              <span className="truncate" style={{ maxWidth: 220 }}>
                {f.name}
              </span>
              <span className="subtle">{formatBytes(f.size)}</span>
              {onRemove && <Button variant="ghost" size="sm" icon={X} onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
