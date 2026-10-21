import { HousingListing, PUBLIC_USER_FIELDS } from '../models/index.js';
import { isStaff } from '../middleware/auth.js';
import { IMAGE_EXTS, inspectFile } from '../middleware/upload.js';
import { storage, publicFileUrl } from '../services/storage.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notify.js';
import { startOrContinueConversation } from './messageController.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';
import { isOwner, withSaved } from '../utils/viewer.js';

const DAY = 24 * 60 * 60 * 1000;

async function savePhotos(files = []) {
  const urls = [];
  for (const f of files.slice(0, 6)) {
    const { ext } = inspectFile(f, IMAGE_EXTS);
    urls.push(publicFileUrl(await storage.save(f.buffer, { folder: 'housing', ext })));
  }
  return urls;
}

/** Mark listings whose expiry passed. Cheap enough to run on reads. */
const expireOld = () => HousingListing.updateMany({ status: 'active', expiresAt: { $lt: new Date() } }, { status: 'expired' });

export async function listHousing(req, res) {
  await expireOld();
  const q = req.query;
  const paging = getPaging(q, { defaultLimit: 12 });
  const filter = q.mine === '1' ? { owner: req.user._id, status: { $ne: 'removed' } } : { status: 'active', owner: { $nin: req.user.blocked } };
  if (q.type) filter.type = String(q.type);
  if (q.area) filter.area = containsRegex(q.area);
  if (q.gender && ['female', 'male'].includes(q.gender)) filter.genderPreference = { $in: ['any', q.gender] };
  const min = Number(q.minRent);
  const max = Number(q.maxRent);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.rent = {};
    if (Number.isFinite(min) && q.minRent !== '') filter.rent.$gte = min;
    if (Number.isFinite(max) && q.maxRent !== '') filter.rent.$lte = max;
    if (!Object.keys(filter.rent).length) delete filter.rent;
  }
  if (q.availableBy) {
    const d = new Date(q.availableBy);
    if (!Number.isNaN(+d)) filter.availableFrom = { $lte: d };
  }
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$or = [{ title: r }, { description: r }, { area: r }];
  }
  const sort = { rent_asc: { rent: 1 }, rent_desc: { rent: -1 }, available: { availableFrom: 1 } }[q.sort] || { createdAt: -1 };
  const data = await paginate(HousingListing, filter, paging, { sort, populate: { path: 'owner', select: 'name avatarUrl affiliationVerified' } });
  data.items = await withSaved(data.items, req.user, 'housing');
  ok(res, data);
}

export async function getHousing(req, res) {
  const listing = await HousingListing.findById(assertObjectId(req.params.id)).select('+contact.value').populate('owner', PUBLIC_USER_FIELDS).lean();
  if (!listing || listing.status === 'removed') throw ApiError.notFound('Listing not found');
  const mine = isOwner(req.user, listing.owner?._id);
  if (listing.status === 'expired' && !mine && !isStaff(req.user)) throw ApiError.notFound('This listing has expired');
  // Contact details are only revealed to signed-in members, and only if the owner chose to share them.
  if (listing.contact?.method === 'in_app' && !mine) delete listing.contact.value;
  const [withFlag] = await withSaved([listing], req.user, 'housing');
  ok(res, { listing: { ...withFlag, mine } });
}

export async function createHousing(req, res) {
  const { contactMethod, contactValue, durationDays, ...fields } = req.body;
  const listing = await HousingListing.create({
    ...fields,
    owner: req.user._id,
    photos: await savePhotos(req.files),
    contact: { method: contactMethod, value: contactMethod === 'in_app' ? undefined : contactValue },
    expiresAt: new Date(Date.now() + durationDays * DAY),
  });
  ok(res, { listing }, 201);
}

export async function updateHousing(req, res) {
  const listing = await HousingListing.findById(assertObjectId(req.params.id)).select('+contact.value');
  if (!listing || listing.status === 'removed') throw ApiError.notFound('Listing not found');
  if (!isOwner(req.user, listing.owner)) throw ApiError.forbidden('Only the owner can edit this listing');
  const { contactMethod, contactValue, durationDays, ...fields } = req.body;
  Object.assign(listing, fields);
  if (contactMethod) listing.contact = { method: contactMethod, value: contactMethod === 'in_app' ? undefined : contactValue ?? listing.contact?.value };
  if (durationDays) {
    listing.expiresAt = new Date(Date.now() + durationDays * DAY);
    if (listing.status === 'expired') listing.status = 'active';
  }
  if (req.files?.length) listing.photos = [...listing.photos, ...(await savePhotos(req.files))].slice(0, 6);
  await listing.save();
  ok(res, { listing });
}

export async function setHousingStatus(req, res) {
  const listing = await HousingListing.findById(assertObjectId(req.params.id));
  if (!listing || listing.status === 'removed') throw ApiError.notFound('Listing not found');
  if (!isOwner(req.user, listing.owner)) throw ApiError.forbidden();
  listing.status = req.body.status;
  if (req.body.status === 'active' && listing.expiresAt < new Date()) listing.expiresAt = new Date(Date.now() + 30 * DAY);
  await listing.save();
  ok(res, { listing });
}

export async function deleteHousing(req, res) {
  const listing = await HousingListing.findById(assertObjectId(req.params.id));
  if (!listing || listing.status === 'removed') throw ApiError.notFound('Listing not found');
  const owner = isOwner(req.user, listing.owner);
  if (!owner && !isStaff(req.user)) throw ApiError.forbidden();
  listing.status = 'removed';
  await listing.save();
  if (!owner) await audit(req.user, 'housing.remove', 'housing', listing._id);
  ok(res, { removed: true });
}

export async function contactOwner(req, res) {
  const listing = await HousingListing.findOne({ _id: assertObjectId(req.params.id), status: 'active' });
  if (!listing) throw ApiError.notFound('This listing is no longer available');
  if (isOwner(req.user, listing.owner)) throw ApiError.badRequest('This is your own listing');
  const conversation = await startOrContinueConversation({
    from: req.user,
    toId: listing.owner,
    body: req.body.message,
    context: `Housing: ${listing.title}`.slice(0, 140),
    bypassConnectionsRule: true, // contacting a public listing owner is the point of the listing
  });
  await notify({ user: listing.owner, type: 'housing_response', actor: req.user._id, message: `${req.user.name} asked about "${listing.title}"`, link: `/messages/${conversation._id}` });
  ok(res, { conversationId: conversation._id }, 201);
}
