import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { Alert, Button, PageHeader, PageLoader, SelectField, TextField } from '../../components/ui.jsx';
import { DepartmentSelect } from '../../components/common.jsx';

export default function AlumniEdit() {
  useDocumentTitle('My alumni profile');
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    graduationYear: '',
    department: user?.department?._id || '',
    jobTitle: '',
    employer: '',
    industry: '',
    location: '',
    skills: '',
    interests: '',
    careerJourney: '',
    achievements: '',
    advice: '',
    mentorshipAvailable: false,
    referralsNote: '',
    linkedin: '',
    website: '',
    contactEmail: '',
    shareContact: false,
    visibility: 'members',
    storyTitle: '',
    storyBody: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  useEffect(() => {
    api
      .get('/alumni/me')
      .then(({ profile: p }) => {
        if (p)
          setForm((f) => ({
            ...f,
            ...Object.fromEntries(Object.entries(p).filter(([k]) => k in f && !Array.isArray(p[k]))),
            department: p.department || f.department,
            graduationYear: p.graduationYear ? String(p.graduationYear) : '',
            skills: (p.skills || []).join(', '),
            interests: (p.interests || []).join(', '),
            achievements: (p.achievements || []).join('\n'),
            storyTitle: p.successStory?.title || '',
            storyBody: p.successStory?.body || '',
          }));
      })
      .catch((e) => toast.error(e))
      .finally(() => setLoading(false));
  }, [toast]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { storyTitle, storyBody, achievements, ...rest } = form;
    try {
      await api.put('/alumni/me', {
        ...rest,
        graduationYear: rest.graduationYear || undefined,
        achievements: achievements.split('\n').map((s) => s.trim()).filter(Boolean),
        successStory: { title: storyTitle, body: storyBody },
      });
      toast.success('Alumni profile saved');
      navigate(`/u/${user._id}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (user?.affiliation !== 'alumni') {
    return (
      <div className="card">
        <Alert tone="info" icon={Info}>
          Alumni profiles are available to members whose affiliation is <b>alumni</b>. If you graduated from DIU, request alumni verification in <Link to="/settings?tab=verification">Settings → Verification</Link>.
        </Alert>
      </div>
    );
  }
  if (loading) return <PageLoader />;

  return (
    <div className="main-narrow" style={{ maxWidth: 860 }}>
      <Link to="/alumni" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Alumni network
      </Link>
      <PageHeader title="My alumni profile" subtitle="Help current students learn from your path. Contact details are only shown if you opt in." />
      {!user.affiliationVerified && (
        <Alert tone="warning" icon={Info} className="mb-0">
          Your alumni status is not verified yet, so your profile shows an “unverified” label.
        </Alert>
      )}
      <form className="card stack" onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="form-grid">
          <TextField label="Graduation year" type="number" min="1995" max="2100" value={form.graduationYear} onChange={set('graduationYear')} />
          <DepartmentSelect value={form.department} onChange={set('department')} placeholder="Select department" />
          <TextField label="Current job title" value={form.jobTitle} onChange={set('jobTitle')} maxLength={100} />
          <TextField label="Employer" value={form.employer} onChange={set('employer')} maxLength={100} />
          <TextField label="Industry" value={form.industry} onChange={set('industry')} maxLength={60} placeholder="e.g. Software, Banking, FMCG" />
          <TextField label="Location" value={form.location} onChange={set('location')} maxLength={80} />
        </div>
        <TextField label="Skills" value={form.skills} onChange={set('skills')} hint="Comma-separated" />
        <TextField label="Professional interests" value={form.interests} onChange={set('interests')} hint="Comma-separated" />
        <TextField as="textarea" label="Career journey" value={form.careerJourney} onChange={set('careerJourney')} maxLength={4000} rows={4} />
        <TextField as="textarea" label="Achievements" value={form.achievements} onChange={set('achievements')} hint="One per line" rows={3} />
        <TextField as="textarea" label="Advice for students" value={form.advice} onChange={set('advice')} maxLength={2000} rows={3} />
        <label className="check">
          <input type="checkbox" checked={form.mentorshipAvailable} onChange={set('mentorshipAvailable')} />
          <span>I am open to mentorship requests from students</span>
        </label>
        <TextField as="textarea" label="Internships or referrals you can share (optional)" value={form.referralsNote} onChange={set('referralsNote')} maxLength={600} rows={2} />
        <div className="form-grid">
          <TextField label="LinkedIn URL" type="url" value={form.linkedin} onChange={set('linkedin')} />
          <TextField label="Personal website" type="url" value={form.website} onChange={set('website')} />
          <TextField label="Contact email (optional)" type="email" value={form.contactEmail} onChange={set('contactEmail')} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.shareContact} onChange={set('shareContact')} />
          <span>Show my contact email to signed-in members</span>
        </label>
        <SelectField
          label="Directory visibility"
          value={form.visibility}
          onChange={set('visibility')}
          options={[
            ['members', 'Visible in the alumni directory'],
            ['hidden', 'Hidden from the directory'],
          ]}
        />
        <hr className="divider" />
        <h2 className="mb-0">Success story (optional)</h2>
        <p className="small muted mb-0">Moderators may feature your story on the landing page.</p>
        <TextField label="Story title" value={form.storyTitle} onChange={set('storyTitle')} maxLength={140} />
        <TextField as="textarea" label="Your story" value={form.storyBody} onChange={set('storyBody')} maxLength={4000} rows={5} />
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}
