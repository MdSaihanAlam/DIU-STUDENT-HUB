import { Community, CommunityMembership, PUBLIC_USER_FIELDS } from '../models/index.js';
import { isStaff } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { ApiError, assertObjectId, containsRegex, getPaging, ok, paginate } from '../utils/http.js';

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'community';

async function loadCommunity(slug) {
  const community = await Community.findOne({ slug: String(slug).toLowerCase(), status: 'active' });
  if (!community) throw ApiError.notFound('Community not found');
  return community;
}

async function membershipOf(community, user) {
  return CommunityMembership.findOne({ community: community._id, user: user._id });
}

const isCommunityMod = (m, user) => isStaff(user) || (m?.status === 'active' && ['owner', 'moderator'].includes(m.role));

export async function listCommunities(req, res) {
  const q = req.query;
  const paging = getPaging(q, { defaultLimit: 18 });
  const filter = { status: 'active' };
  if (q.type) filter.type = String(q.type);
  if (q.department) filter.department = assertObjectId(q.department, 'department');
  const memberships = await CommunityMembership.find({ user: req.user._id }).select('community status role').lean();
  if (q.mine === '1') filter._id = { $in: memberships.filter((m) => m.status === 'active').map((m) => m.community) };
  if (q.q) {
    const r = containsRegex(q.q);
    filter.$or = [{ name: r }, { description: r }];
  }
  const data = await paginate(Community, filter, paging, { sort: { memberCount: -1, name: 1 }, populate: { path: 'department', select: 'name code' } });
  const byId = new Map(memberships.map((m) => [String(m.community), m]));
  data.items = data.items.map((c) => ({ ...c, membership: byId.get(String(c._id)) ? { status: byId.get(String(c._id)).status, role: byId.get(String(c._id)).role } : null }));
  ok(res, data);
}

export async function createCommunity(req, res) {
  let slug = slugify(req.body.name);
  if (await Community.exists({ slug })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const community = await Community.create({ ...req.body, slug, createdBy: req.user._id, memberCount: 1 });
  await CommunityMembership.create({ community: community._id, user: req.user._id, role: 'owner', status: 'active' });
  ok(res, { community }, 201);
}

export async function getCommunity(req, res) {
  const community = await loadCommunity(req.params.slug);
  await community.populate('department', 'name code slug');
  const membership = await membershipOf(community, req.user);
  const moderators = await CommunityMembership.find({ community: community._id, role: { $in: ['owner', 'moderator'] }, status: 'active' })
    .populate('user', 'name avatarUrl')
    .lean();
  const pendingCount = isCommunityMod(membership, req.user) ? await CommunityMembership.countDocuments({ community: community._id, status: 'pending' }) : 0;
  ok(res, {
    community,
    membership: membership ? { status: membership.status, role: membership.role } : null,
    canModerate: isCommunityMod(membership, req.user),
    canSeePosts: community.visibility === 'public' || membership?.status === 'active' || isStaff(req.user),
    moderators: moderators.map((m) => ({ ...m.user, role: m.role })),
    pendingCount,
  });
}

export async function updateCommunity(req, res) {
  const community = await loadCommunity(req.params.slug);
  if (!isCommunityMod(await membershipOf(community, req.user), req.user)) throw ApiError.forbidden('Only community moderators can edit settings');
  Object.assign(community, req.body);
  if (req.body.pinnedResources) {
    community.pinnedResources = req.body.pinnedResources.filter((p) => /^https?:\/\//i.test(p.url) || /^\/(?![/\\])/.test(p.url));
  }
  await community.save();
  ok(res, { community });
}

export async function joinCommunity(req, res) {
  const community = await loadCommunity(req.params.slug);
  const existing = await membershipOf(community, req.user);
  if (existing) return ok(res, { membership: { status: existing.status, role: existing.role } });
  const status = community.visibility === 'public' ? 'active' : 'pending';
  const membership = await CommunityMembership.create({ community: community._id, user: req.user._id, status });
  if (status === 'active') {
    await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
  } else {
    const mods = await CommunityMembership.find({ community: community._id, role: { $in: ['owner', 'moderator'] }, status: 'active' }).distinct('user');
    await Promise.all(mods.map((m) => notify({ user: m, type: 'community', actor: req.user._id, message: `${req.user.name} asked to join ${community.name}`, link: `/communities/${community.slug}?tab=members` })));
  }
  ok(res, { membership: { status: membership.status, role: membership.role } }, 201);
}

export async function leaveCommunity(req, res) {
  const community = await loadCommunity(req.params.slug);
  const membership = await membershipOf(community, req.user);
  if (!membership) return ok(res, { membership: null });
  if (membership.role === 'owner') {
    const owners = await CommunityMembership.countDocuments({ community: community._id, role: 'owner', status: 'active' });
    if (owners <= 1) throw ApiError.badRequest('Promote another member to owner/moderator before leaving');
  }
  await membership.deleteOne();
  if (membership.status === 'active') await Community.updateOne({ _id: community._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  ok(res, { membership: null });
}

export async function listMembers(req, res) {
  const community = await loadCommunity(req.params.slug);
  const mine = await membershipOf(community, req.user);
  const status = req.query.status === 'pending' ? 'pending' : 'active';
  if (status === 'pending' && !isCommunityMod(mine, req.user)) throw ApiError.forbidden();
  if (community.visibility === 'private' && mine?.status !== 'active' && !isStaff(req.user)) throw ApiError.forbidden('Join this community to see members');
  const paging = getPaging(req.query, { defaultLimit: 30 });
  const data = await paginate(CommunityMembership, { community: community._id, status }, paging, {
    sort: { role: 1, createdAt: 1 },
    populate: { path: 'user', select: PUBLIC_USER_FIELDS },
  });
  data.items = data.items.filter((m) => m.user);
  ok(res, data);
}

export async function manageMember(req, res) {
  const community = await loadCommunity(req.params.slug);
  const mine = await membershipOf(community, req.user);
  if (!isCommunityMod(mine, req.user)) throw ApiError.forbidden();
  const target = await CommunityMembership.findOne({ community: community._id, user: assertObjectId(req.params.userId) });
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'owner' && !isStaff(req.user)) throw ApiError.forbidden('Owners can only be changed by platform staff');

  switch (req.body.action) {
    case 'approve':
      if (target.status !== 'pending') throw ApiError.badRequest('Already a member');
      target.status = 'active';
      await target.save();
      await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
      await notify({ user: target.user, type: 'community', actor: req.user._id, message: `You joined ${community.name}`, link: `/communities/${community.slug}` });
      break;
    case 'remove':
      await target.deleteOne();
      if (target.status === 'active') await Community.updateOne({ _id: community._id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
      break;
    case 'promote':
      if (target.status !== 'active') throw ApiError.badRequest('Approve the member first');
      target.role = 'moderator';
      await target.save();
      break;
    case 'demote':
      target.role = 'member';
      await target.save();
      break;
  }
  ok(res, { done: true });
}
