import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { Alert, Button, PageHeader, PageLoader, SelectField, TextField } from '../../components/ui.jsx';
import { DepartmentSelect } from '../../components/common.jsx';
import { RESEARCH_STATUS } from '../../utils/constants.js';
import { toDateInput } from '../../utils/format.js';

export default function ResearchForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit project' : 'Submit a project');
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [form, setForm] = useState({
    title: '',
    abstract: '',
    domain: '',
    department: user?.department?._id || '',
    status: 'ongoing',
    affiliation: user?.affiliation === 'faculty' ? 'faculty' : 'student',
    supervisor: '',
    supervisorName: '',
    startDate: '',
    endDate: '',
    methodology: '',
    technologies: '',
    progress: '',
    links: { repo: '', dataset: '', paper: '', doi: '', preprint: '' },
    collaborationOpen: false,
    collaborationNote: '',
    contributors: [{ name: user?.name || '', role: 'Lead', user: user?._id }],
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const setLink = (k) => (e) => setForm((f) => ({ ...f, links: { ...f.links, [k]: e.target.value } }));

  useEffect(() => {
    if (!form.department) return;
    api
      .get('/faculty', { department: form.department, limit: 50 })
      .then((d) => setFaculty(d.items))
      .catch(() => setFaculty([]));
  }, [form.department]);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/research/${id}`)
      .then(({ project: p }) => {
        if (!p.editable) {
          toast.error('Only the project team can edit this project');
          return navigate(`/research/${id}`);
        }
        setForm({
          title: p.title,
          abstract: p.abstract,
          domain: p.domain,
          department: p.department?._id || '',
          status: p.status,
          affiliation: p.affiliation,
          supervisor: p.supervisor?._id || '',
          supervisorName: p.supervisorName || '',
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
          methodology: p.methodology || '',
          technologies: (p.technologies || []).join(', '),
          progress: p.progress || '',
          links: { repo: '', dataset: '', paper: '', doi: '', preprint: '', ...p.links },
          collaborationOpen: !!p.collaborationOpen,
          collaborationNote: p.collaborationNote || '',
          contributors: p.contributors.map((c) => ({ name: c.user?.name || c.name, role: c.role || '', user: c.user?._id })),
        });
      })
      .catch((e) => toast.error(e))
      .finally(() => setLoading(false));
  }, [editing, id, navigate, toast]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const supervisorProfile = faculty.find((f) => f._id === form.supervisor);
    const body = {
      ...form,
      supervisorName: supervisorProfile?.name || form.supervisorName,
      contributors: form.contributors.filter((c) => c.name.trim()),
    };
    try {
      const r = editing ? await api.patch(`/research/${id}`, body) : await api.post('/research', body);
      toast.success(r.message || 'Project saved');
      navigate(`/research/${r.project._id}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="main-narrow" style={{ maxWidth: 860 }}>
      <Link to={editing ? `/research/${id}` : '/research'} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <PageHeader title={editing ? 'Edit research project' : 'Submit a research project'} subtitle="Projects are reviewed by moderators before being marked as verified." />
      <form className="card stack" onSubmit={submit}>
        <Alert tone="info">Describe only real work and results. Do not claim publications or results that do not exist — misleading submissions are removed.</Alert>
        <TextField label="Project title" required value={form.title} onChange={set('title')} minLength={5} maxLength={200} />
        <TextField as="textarea" label="Short abstract" required value={form.abstract} onChange={set('abstract')} minLength={20} maxLength={3000} rows={4} />
        <div className="form-grid">
          <TextField label="Research domain" required value={form.domain} onChange={set('domain')} maxLength={80} placeholder="e.g. Machine Learning" />
          <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select department" />
          <SelectField label="Status" value={form.status} onChange={set('status')} options={RESEARCH_STATUS} />
          <SelectField
            label="Affiliation"
            value={form.affiliation}
            onChange={set('affiliation')}
            options={[
              ['student', 'Student project'],
              ['faculty', 'Faculty project'],
              ['joint', 'Joint student–faculty'],
            ]}
          />
          <SelectField label="Supervisor (from directory)" value={form.supervisor} onChange={set('supervisor')} options={faculty.map((f) => [f._id, f.name])} placeholder="None / not listed" />
          {!form.supervisor && <TextField label="Supervisor name (if not listed)" value={form.supervisorName} onChange={set('supervisorName')} maxLength={100} />}
          <TextField label="Start date" type="date" value={form.startDate} onChange={set('startDate')} />
          <TextField label="Completion date" type="date" value={form.endDate} onChange={set('endDate')} />
        </div>

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>
            Contributors
          </legend>
          {form.contributors.map((c, i) => (
            <div key={i} className="row">
              <input className="input" value={c.name} onChange={(e) => setForm((f) => ({ ...f, contributors: f.contributors.map((x, j) => (j === i ? { ...x, name: e.target.value, user: j === 0 ? x.user : undefined } : x)) }))} placeholder="Name" aria-label={`Contributor ${i + 1} name`} maxLength={100} />
              <input className="input" value={c.role} onChange={(e) => setForm((f) => ({ ...f, contributors: f.contributors.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) }))} placeholder="Role" aria-label={`Contributor ${i + 1} role`} maxLength={60} style={{ maxWidth: 180 }} />
              {i > 0 && <Button variant="ghost" size="sm" icon={X} onClick={() => setForm((f) => ({ ...f, contributors: f.contributors.filter((_, j) => j !== i) }))} aria-label={`Remove contributor ${i + 1}`} />}
            </div>
          ))}
          {form.contributors.length < 20 && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, contributors: [...f.contributors, { name: '', role: '' }] }))} style={{ alignSelf: 'flex-start' }}>
              Add contributor
            </Button>
          )}
        </fieldset>

        <TextField as="textarea" label="Methodology" value={form.methodology} onChange={set('methodology')} maxLength={3000} />
        <TextField label="Technologies" value={form.technologies} onChange={set('technologies')} hint="Comma-separated, e.g. Python, PyTorch, ESP32" />
        <TextField as="textarea" label="Results & current progress" value={form.progress} onChange={set('progress')} maxLength={3000} />
        <div className="form-grid">
          <TextField label="Code repository URL" type="url" value={form.links.repo} onChange={setLink('repo')} placeholder="https://github.com/…" />
          <TextField label="Dataset URL" type="url" value={form.links.dataset} onChange={setLink('dataset')} />
          <TextField label="Paper URL" type="url" value={form.links.paper} onChange={setLink('paper')} />
          <TextField label="Preprint URL" type="url" value={form.links.preprint} onChange={setLink('preprint')} />
          <TextField label="DOI" value={form.links.doi} onChange={setLink('doi')} placeholder="10.xxxx/xxxxx" />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.collaborationOpen} onChange={set('collaborationOpen')} />
          <span>We are open to collaborators</span>
        </label>
        {form.collaborationOpen && <TextField as="textarea" label="What kind of help do you need?" value={form.collaborationNote} onChange={set('collaborationNote')} maxLength={600} rows={2} />}
        <div className="form-actions">
          <Link to="/research" className="btn">
            Cancel
          </Link>
          <Button type="submit" variant="primary" loading={busy}>
            {editing ? 'Save changes' : 'Submit for review'}
          </Button>
        </div>
      </form>
    </div>
  );
}
