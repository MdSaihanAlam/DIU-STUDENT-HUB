import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, CheckCircle2, Mail, MessageSquare, Pencil, Phone, ShieldAlert, Trash2 } from 'lucide-react';
import { api, fileUrl } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Alert, Badge, Button, CardSkeleton, ConfirmDialog, ErrorState, SampleBadge } from '../../components/ui.jsx';
import { MessageDialog, ReportButton, SaveButton, UserLine } from '../../components/common.jsx';
import { HOUSING_TYPES, label } from '../../utils/constants.js';
import { formatBDT, formatDate, timeAgo } from '../../utils/format.js';

export default function HousingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
  const { data, error, loading, reload, setData } = useApi(`/housing/${id}`);
  const h = data?.listing;
  useDocumentTitle(h?.title || 'Listing');
  const [contacting, setContacting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <CardSkeleton count={1} lines={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const r = await api.post(`/housing/${id}/status`, { status });
      setData((d) => ({ listing: { ...d.listing, status: r.listing.status } }));
      toast.success(status === 'rented' ? 'Marked as rented' : 'Listing re-opened');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/housing/${id}`);
      toast.success('Listing removed');
      navigate('/housing');
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  const photos = h.photos || [];

  return (
    <div className="stack-lg">
      <div>
        <Link to="/housing" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" /> All listings
        </Link>
      </div>
      {h.status !== 'active' && <Alert tone={h.status === 'rented' ? 'success' : 'warning'}>This listing is {h.status}.</Alert>}

      {photos.length > 0 ? (
        <div className="gallery" style={photos.length === 1 ? { gridTemplateColumns: '1fr' } : undefined}>
          <img src={fileUrl(photos[0])} alt={`Photo 1 of ${h.title}`} />
          {photos.length > 1 && (
            <div className="side">
              {photos.slice(1, 3).map((p, i) => (
                <img key={p} src={fileUrl(p)} alt={`Photo ${i + 2} of ${h.title}`} loading="lazy" />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="thumb-placeholder card" style={{ aspectRatio: '21/6' }}>
          <BedDouble size={40} aria-hidden="true" />
        </div>
      )}

      <div className="detail-grid">
        <div className="card stack">
          <div className="row-wrap">
            <Badge tone="primary">{label(HOUSING_TYPES, h.type)}</Badge>
            {h.genderPreference !== 'any' && <Badge>{h.genderPreference === 'female' ? 'Female only' : 'Male only'}</Badge>}
            <SampleBadge show={h.isDemo} />
          </div>
          <h1 style={{ marginBottom: 0 }}>{h.title}</h1>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {formatBDT(h.rent)} <span className="small muted">/ month</span>
          </div>
          {h.description && <p className="pre-wrap mb-0">{h.description}</p>}
          <dl className="kv">
            <dt>Area</dt>
            <dd>{h.area}</dd>
            <dt>Location</dt>
            <dd>{h.locationNote || 'Shared after contact'}</dd>
            <dt>Available from</dt>
            <dd>{formatDate(h.availableFrom)}</dd>
            <dt>Facilities</dt>
            <dd>{h.facilities?.length ? h.facilities.join(', ') : '—'}</dd>
            <dt>Rules</dt>
            <dd className="pre-wrap">{h.rules || '—'}</dd>
            <dt>Listed</dt>
            <dd>
              {timeAgo(h.createdAt)} · expires {formatDate(h.expiresAt)}
            </dd>
          </dl>
        </div>

        <aside className="card stack">
          <UserLine user={h.owner} meta="Listed by" />
          {h.mine ? (
            <>
              <Link to={`/housing/${id}/edit`} className="btn">
                <Pencil size={16} aria-hidden="true" /> Edit listing
              </Link>
              {h.status === 'active' ? (
                <Button icon={CheckCircle2} onClick={() => setStatus('rented')} loading={busy}>
                  Mark as rented
                </Button>
              ) : (
                <Button onClick={() => setStatus('active')} loading={busy}>
                  Re-open listing
                </Button>
              )}
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                Delete listing
              </Button>
            </>
          ) : (
            <>
              {h.status === 'active' && (
                <Button variant="primary" icon={MessageSquare} onClick={() => setContacting(true)}>
                  Message owner
                </Button>
              )}
              {h.contact?.value && (
                <a className="btn" href={h.contact.method === 'phone' ? `tel:${h.contact.value}` : `mailto:${h.contact.value}`}>
                  {h.contact.method === 'phone' ? <Phone size={16} aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                  {h.contact.value}
                </a>
              )}
              <div className="row">
                <SaveButton type="housing" id={h._id} saved={h.saved} size="" withLabel />
                <ReportButton targetType="housing" targetId={h._id} size="" withLabel />
              </div>
              {isStaff && (
                <Button variant="ghost" icon={Trash2} onClick={() => setConfirm(true)}>
                  Remove (moderator)
                </Button>
              )}
            </>
          )}
          <Alert tone="warning" icon={ShieldAlert}>
            Never pay before visiting. The platform does not guarantee listings or transactions.
          </Alert>
        </aside>
      </div>

      <MessageDialog
        open={contacting}
        onClose={() => setContacting(false)}
        user={h.owner}
        endpoint={`/housing/${id}/contact`}
        title="Ask about this listing"
        context={`About: ${h.title}`}
      />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} title="Remove this listing?" confirmLabel="Remove" danger busy={busy}>
        The listing will no longer be visible to anyone.
      </ConfirmDialog>
    </div>
  );
}
