import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, fileUrl } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocumentTitle } from '../../hooks/index.js';
import { Alert, Button, FileDrop, PageHeader, PageLoader, SelectField, TextField } from '../../components/ui.jsx';
import { HOUSING_TYPES } from '../../utils/constants.js';
import { toDateInput } from '../../utils/format.js';

const EMPTY = {
  title: '',
  description: '',
  type: 'mess_seat',
  rent: '',
  area: '',
  locationNote: '',
  availableFrom: toDateInput(new Date()),
  facilities: '',
  rules: '',
  genderPreference: 'any',
  contactMethod: 'in_app',
  contactValue: '',
  durationDays: '30',
};

export default function HousingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit listing' : 'New listing');
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/housing/${id}`)
      .then(({ listing: l }) => {
        if (!l.mine) {
          toast.error('You can only edit your own listings');
          return navigate(`/housing/${id}`);
        }
        setForm({
          title: l.title,
          description: l.description || '',
          type: l.type,
          rent: String(l.rent),
          area: l.area,
          locationNote: l.locationNote || '',
          availableFrom: toDateInput(l.availableFrom),
          facilities: (l.facilities || []).join(', '),
          rules: l.rules || '',
          genderPreference: l.genderPreference,
          contactMethod: l.contact?.method || 'in_app',
          contactValue: l.contact?.value || '',
          durationDays: '',
        });
        setExistingPhotos(l.photos || []);
      })
      .catch((e) => toast.error(e))
      .finally(() => setLoading(false));
  }, [editing, id, navigate, toast]);

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v !== '' && fd.append(k, v));
    photos.forEach((p) => fd.append('photos', p));
    setBusy(true);
    try {
      const r = editing ? await api.patch(`/housing/${id}`, fd) : await api.post('/housing', fd);
      toast.success(editing ? 'Listing updated' : 'Listing published');
      navigate(`/housing/${r.listing._id}`);
    } catch (err) {
      const fieldErrors = {};
      err.details?.forEach((d) => (fieldErrors[d.field] = d.message));
      setErrors(fieldErrors);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="main-narrow" style={{ maxWidth: 820 }}>
      <Link to={editing ? `/housing/${id}` : '/housing'} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </Link>
      <PageHeader title={editing ? 'Edit listing' : 'Post a housing listing'} subtitle="Share only an approximate location. Contact details stay private unless you choose to share them." />
      <form className="card stack" onSubmit={submit}>
        <TextField label="Title" required value={form.title} onChange={set('title')} minLength={5} maxLength={140} error={errors.title} placeholder="e.g. Mess seat available near campus" />
        <div className="form-grid">
          <SelectField label="Type" required value={form.type} onChange={set('type')} options={HOUSING_TYPES} />
          <TextField label="Monthly rent (BDT)" type="number" min="0" required value={form.rent} onChange={set('rent')} error={errors.rent} inputMode="numeric" />
          <TextField label="Area" required value={form.area} onChange={set('area')} maxLength={80} error={errors.area} placeholder="e.g. Badda" />
          <TextField label="Available from" type="date" required value={form.availableFrom} onChange={set('availableFrom')} error={errors.availableFrom} />
          <SelectField
            label="Suitable for"
            value={form.genderPreference}
            onChange={set('genderPreference')}
            options={[
              ['any', 'Anyone'],
              ['female', 'Female only'],
              ['male', 'Male only'],
            ]}
            hint="Only set this if it is a genuine requirement of the accommodation."
          />
          <SelectField
            label={editing ? 'Extend listing by' : 'Keep listing for'}
            value={form.durationDays}
            onChange={set('durationDays')}
            options={[
              ['7', '7 days'],
              ['14', '14 days'],
              ['30', '30 days'],
              ['60', '60 days'],
              ['90', '90 days'],
            ]}
            placeholder={editing ? 'Do not change' : undefined}
          />
        </div>
        <TextField label="Approximate location" value={form.locationNote} onChange={set('locationNote')} maxLength={200} placeholder="e.g. 5 minutes walk from the main gate" hint="Do not post a full address publicly." />
        <TextField as="textarea" label="Description" value={form.description} onChange={set('description')} maxLength={3000} />
        <TextField label="Facilities" value={form.facilities} onChange={set('facilities')} hint="Comma-separated, e.g. Wi-Fi, Meal system, Generator" />
        <TextField as="textarea" label="House rules" value={form.rules} onChange={set('rules')} maxLength={1000} rows={2} />
        <div className="form-grid">
          <SelectField
            label="How should people contact you?"
            value={form.contactMethod}
            onChange={set('contactMethod')}
            options={[
              ['in_app', 'Platform messages only (recommended)'],
              ['phone', 'Show my phone to signed-in members'],
              ['email', 'Show my email to signed-in members'],
            ]}
          />
          {form.contactMethod !== 'in_app' && (
            <TextField label={form.contactMethod === 'phone' ? 'Phone number' : 'Email address'} value={form.contactValue} onChange={set('contactValue')} maxLength={120} required error={errors.contactValue} />
          )}
        </div>
        {existingPhotos.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Current photos
            </div>
            <div className="photo-grid">
              {existingPhotos.map((p) => (
                <img key={p} src={fileUrl(p)} alt="" />
              ))}
            </div>
          </div>
        )}
        <FileDrop
          label="Add photos"
          accept="image/png,image/jpeg,image/webp"
          multiple
          maxMB={5}
          files={photos}
          onFiles={(f) => setPhotos((p) => [...p, ...f].slice(0, 6 - existingPhotos.length))}
          onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))}
          hint="Up to 6 photos · JPG, PNG or WebP · max 5 MB each"
        />
        <Alert tone="info">By posting you confirm the listing is genuine and that you are allowed to rent or share this accommodation.</Alert>
        <div className="form-actions">
          <Link to="/housing" className="btn">
            Cancel
          </Link>
          <Button type="submit" variant="primary" loading={busy}>
            {editing ? 'Save changes' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}
