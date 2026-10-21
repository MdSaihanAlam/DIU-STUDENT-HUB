import { Conversation, Message, PUBLIC_USER_FIELDS, User } from '../models/index.js';
import { notify } from '../services/notify.js';
import { areConnected } from './userController.js';
import { ApiError, assertObjectId, ok } from '../utils/http.js';
import { sameId } from '../utils/viewer.js';

/**
 * Messaging uses plain REST + client polling (no websockets) to keep the first release simple
 * to host. Conversations between non-connections start as "requests" the recipient can accept.
 */
export async function startOrContinueConversation({ from, toId, body, context, bypassConnectionsRule = false }) {
  if (sameId(from._id, toId)) throw ApiError.badRequest('You cannot message yourself');
  const to = await User.findOne({ _id: toId, status: 'active' }).select('name privacy blocked').lean();
  if (!to) throw ApiError.notFound('Member not found');
  if (to.blocked?.some((b) => sameId(b, from._id)) || from.blocked.some((b) => sameId(b, toId))) {
    throw ApiError.forbidden('You cannot message this member');
  }
  const connected = await areConnected(from._id, toId);
  const rule = to.privacy?.allowMessagesFrom || 'everyone';
  if (rule === 'nobody' && !bypassConnectionsRule) throw ApiError.forbidden(`${to.name} is not accepting messages`);
  if (rule === 'connections' && !connected && !bypassConnectionsRule) throw ApiError.forbidden(`${to.name} only accepts messages from connections`);

  let conversation = await Conversation.findOne({ participants: { $all: [from._id, toId], $size: 2 } });
  if (conversation?.status === 'blocked') throw ApiError.forbidden('This conversation is blocked');
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [from._id, toId],
      startedBy: from._id,
      status: connected ? 'active' : 'request',
      context,
    });
  }
  await addMessage(conversation, from, body);
  return conversation;
}

async function addMessage(conversation, sender, body) {
  const message = await Message.create({ conversation: conversation._id, sender: sender._id, body, readBy: [sender._id] });
  // A reply from the recipient accepts a pending request.
  if (conversation.status === 'request' && !sameId(conversation.startedBy, sender._id)) conversation.status = 'active';
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = body.slice(0, 140);
  await conversation.save();
  const recipient = conversation.participants.find((p) => !sameId(p, sender._id));
  await notify({
    user: recipient,
    type: 'message',
    actor: sender._id,
    message: conversation.status === 'request' ? `New message request from ${sender.name}` : `New message from ${sender.name}`,
    link: `/messages/${conversation._id}`,
    dedupeKey: `msg:${conversation._id}:${Math.floor(Date.now() / 600000)}`, // at most one per 10 minutes
  });
  return message;
}

async function loadConversation(req) {
  const conversation = await Conversation.findOne({ _id: assertObjectId(req.params.id), participants: req.user._id });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return conversation;
}

export async function listConversations(req, res) {
  const me = req.user._id;
  const conversations = await Conversation.find({ participants: me, status: { $ne: 'blocked' } })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate('participants', PUBLIC_USER_FIELDS)
    .lean();
  const unread = await Message.aggregate([
    { $match: { conversation: { $in: conversations.map((c) => c._id) }, readBy: { $ne: me } } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadMap = new Map(unread.map((u) => [String(u._id), u.count]));
  const items = conversations.map((c) => ({
    _id: c._id,
    status: c.status,
    context: c.context,
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
    isRequest: c.status === 'request' && !sameId(c.startedBy, me),
    awaitingReply: c.status === 'request' && sameId(c.startedBy, me),
    other: c.participants.find((p) => !sameId(p._id, me)) || { name: 'Deleted user' },
    unread: unreadMap.get(String(c._id)) || 0,
  }));
  ok(res, { items });
}

export async function unreadCount(req, res) {
  const convIds = await Conversation.find({ participants: req.user._id, status: { $ne: 'blocked' } }).distinct('_id');
  const count = await Message.countDocuments({ conversation: { $in: convIds }, readBy: { $ne: req.user._id } });
  ok(res, { count });
}

export async function startConversation(req, res) {
  const conversation = await startOrContinueConversation({ from: req.user, toId: req.body.userId, body: req.body.message, context: req.body.context });
  ok(res, { conversationId: conversation._id }, 201);
}

export async function getMessages(req, res) {
  const conversation = await loadConversation(req);
  const before = req.query.before ? new Date(req.query.before) : null;
  const filter = { conversation: conversation._id, ...(before && !Number.isNaN(+before) ? { createdAt: { $lt: before } } : {}) };
  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(40).lean();
  await Message.updateMany({ conversation: conversation._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  const populated = await Conversation.populate(conversation, { path: 'participants', select: PUBLIC_USER_FIELDS });
  ok(res, {
    conversation: {
      _id: populated._id,
      status: populated.status,
      context: populated.context,
      isRequest: populated.status === 'request' && !sameId(populated.startedBy, req.user._id),
      other: populated.participants.find((p) => !sameId(p._id, req.user._id)) || { name: 'Deleted user' },
    },
    items: messages.reverse().map((m) => ({ _id: m._id, body: m.body, createdAt: m.createdAt, mine: sameId(m.sender, req.user._id) })),
    hasMore: messages.length === 40,
  });
}

export async function sendMessage(req, res) {
  const conversation = await loadConversation(req);
  if (conversation.status === 'blocked') throw ApiError.forbidden('This conversation is blocked');
  const other = conversation.participants.find((p) => !sameId(p, req.user._id));
  const otherUser = await User.findById(other).select('blocked status').lean();
  if (!otherUser || otherUser.status !== 'active') throw ApiError.badRequest('This member is no longer active');
  if (otherUser.blocked?.some((b) => sameId(b, req.user._id))) throw ApiError.forbidden('You cannot message this member');
  // Limit unanswered requests to 3 messages so requests cannot be used to spam.
  if (conversation.status === 'request' && sameId(conversation.startedBy, req.user._id)) {
    const sent = await Message.countDocuments({ conversation: conversation._id, sender: req.user._id });
    if (sent >= 3) throw ApiError.badRequest('Wait for a reply before sending more messages');
  }
  const message = await addMessage(conversation, req.user, req.body.body);
  ok(res, { message: { _id: message._id, body: message.body, createdAt: message.createdAt, mine: true } }, 201);
}

export async function acceptConversation(req, res) {
  const conversation = await loadConversation(req);
  if (conversation.status !== 'request' || sameId(conversation.startedBy, req.user._id)) throw ApiError.badRequest('Nothing to accept');
  conversation.status = 'active';
  await conversation.save();
  ok(res, { status: conversation.status });
}

export async function declineConversation(req, res) {
  const conversation = await loadConversation(req);
  if (conversation.status !== 'request' || sameId(conversation.startedBy, req.user._id)) throw ApiError.badRequest('Nothing to decline');
  await Message.deleteMany({ conversation: conversation._id });
  await conversation.deleteOne();
  ok(res, { declined: true });
}
