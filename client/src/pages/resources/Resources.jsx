import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, FileText, Upload } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Alert, Badge, Button, Dialog, EmptyState, ErrorState, FileDrop, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, SelectField, Stars, Tabs, TextField } from '../../components/ui.jsx';
import { DepartmentFilter, DepartmentSelect, SaveButton } from '../../components/common.jsx';
import { RESOURCE_TYPES, label } from '../../utils/constants.js';
import { formatBytes, timeAgo } from '../../utils/format.js';

function UploadDialog({ open, onClose, onUploaded }) {
  const toast = useToast();
  const empty = { title: '', description: '', courseCode: '', courseTitle: '', department: '', semester: '', topic: '', resourceType: 'notes', attribution: '', rightsConfirmed: false };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a file to upload');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v !== '' && fd.append(k, String(v)));
    fd.append('file', file);
    setBusy(true);
    try {
      const r = await api.post('/resources', fd);
      toast.success(r.message);
      setForm(empty);
      setFile(null);
      onUploaded?.(r.resource);
      onClose();
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
      size="lg"
      title="Upload a study resource"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="upload-form" loading={busy} disabled={!form.rightsConfirmed || !file}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-form" className="stack" onSubmit={submit}>
        <FileDrop
          accept=".pdf,.docx,.pptx,.xlsx,.doc,.ppt,.txt,.md,.png,.jpg,.jpeg,.webp"
          files={file ? [file] : []}
          onFiles={(f) => setFile(f[0])}
          onRemove={() => setFile(null)}
          maxMB={15}
          hint="PDF, Word, PowerPoint, Excel, text or images · max 15 MB"
        />
        <TextField label="Title" required value={form.title} onChange={set('title')} maxLength={160} placeholder="e.g. Data Structures — Graph traversal notes" />
        <div className="form-grid">
          <TextField label="Course code" value={form.courseCode} onChange={set('courseCode')} maxLength={20} placeholder="CSE 213" />
          <TextField label="Course title" value={form.courseTitle} onChange={set('courseTitle')} maxLength={120} />
          <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select department" />
          <SelectField label="Type" value={form.resourceType} onChange={set('resourceType')} options={RESOURCE_TYPES} />
          <TextField label="Semester" value={form.semester} onChange={set('semester')} maxLength={30} placeholder="Spring 2026" />
          <TextField label="Topic" value={form.topic} onChange={set('topic')} maxLength={80} />
        </div>
        <TextField as="textarea" label="Description" value={form.description} onChange={set('description')} maxLength={2000} />
        <TextField label="Original author / source" value={form.attribution} onChange={set('attribution')} maxLength={300} hint="Credit who created the material (e.g. 'My own notes' or the lecturer who allowed sharing)." />
        <label className="check">
          <input type="checkbox" checked={form.rightsConfirmed} onChange={set('rightsConfirmed')} />
          <span>I created this material or have permission to share it. It is not a pirated book or a live exam paper.</span>
        </label>
        <p className="xs subtle mb-0">Uploads are reviewed by moderators before they appear publicly. Files are scanned for type and never executed.</p>
      </form>
    </Dialog>
  );
}

export function ResourceCard({ r }) {
  return (
    <Link to={`/resources/${r._id}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row between">
        <div className="feature-icon" style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--primary-softer)', color: 'var(--primary)' }}>
          <FileText size={20} aria-hidden="true" />
        </div>
        <div className="row">
          {r.status && r.status !== 'approved' && <Badge tone={r.status === 'pending' ? 'warning' : 'danger'}>{r.status}</Badge>}
          <SaveButton type="resource" id={r._id} saved={r.saved} />
        </div>
      </div>
      <div>
        <div className="card-title clamp-2">{r.title}</div>
        <div className="row-wrap" style={{ gap: 6 }}>
          {r.courseCode && <Badge tone="primary">{r.courseCode}</Badge>}
          <Badge>{label(RESOURCE_TYPES, r.resourceType)}</Badge>
          <SampleBadge show={r.isDemo} />
        </div>
      </div>
      <div className="meta">
        {r.ratingCount > 0 && (
          <span>
            <Stars value={r.ratingAvg} size={12} /> {r.ratingAvg}
          </span>
        )}
        <span>
          <Download size={13} aria-hidden="true" /> {r.downloads}
        </span>
        <span>{formatBytes(r.file?.size)}</span>
      </div>
      <div className="xs subtle">
        {r.uploader?.name} · {timeAgo(r.createdAt)}
      </div>
    </Link>
  );
}

export default function Resources() {
  useDocumentTitle('Notes & resources');
  const [filters, setFilter] = useQueryFilters({ q: '', department: '', resourceType: '', semester: '', courseCode: '', sort: 'newest', tab: 'all' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [uploading, setUploading] = useState(false);
  const facets = useApi('/resources/facets');
  const params = { ...filters, mine: filters.tab === 'mine' ? '1' : '', tab: undefined };
  const list = usePaginated('/resources', params, { limit: 12 });

  return (
    <>
      <PageHeader
        title="Notes & resources"
        subtitle="Lecture notes, slides, previous questions and study materials shared by the community."
        actions={
          <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
            Upload
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'all', label: 'Browse' },
          { value: 'mine', label: 'My uploads' },
        ]}
        value={filters.tab}
        onChange={(v) => setFilter('tab', v)}
      />
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search by course code, title or topic" label="Search resources" />
        <DepartmentFilter value={filters.department} onChange={(v) => setFilter('department', v)} />
        <select className="select" value={filters.resourceType} onChange={(e) => setFilter('resourceType', e.target.value)} aria-label="Resource type">
          <option value="">All types</option>
          {RESOURCE_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="select" value={filters.courseCode} onChange={(e) => setFilter('courseCode', e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {(facets.data?.courseCodes || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="select" value={filters.semester} onChange={(e) => setFilter('semester', e.target.value)} aria-label="Semester">
          <option value="">All semesters</option>
          {(facets.data?.semesters || []).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="select" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="popular">Most downloaded</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      {filters.tab === 'mine' && (
        <Alert tone="info" className="mb-0" icon={BookOpen}>
          Pending uploads are visible only to you and moderators until approved.
        </Alert>
      )}
      <div style={{ marginTop: 16 }}>
        {list.loading ? (
          <GridSkeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={BookOpen}
              title="No resources found"
              action={
                <Button variant="primary" icon={Upload} onClick={() => setUploading(true)}>
                  Share the first one
                </Button>
              }
            >
              Try a different course code or clear the filters.
            </EmptyState>
          </div>
        ) : (
          <>
            <p className="small muted">{list.total} resources</p>
            <div className="grid grid-3">
              {list.items.map((r) => (
                <ResourceCard key={r._id} r={r} />
              ))}
            </div>
          </>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
      </div>
      <UploadDialog open={uploading} onClose={() => setUploading(false)} onUploaded={() => filters.tab === 'mine' && list.reload()} />
    </>
  );
}
