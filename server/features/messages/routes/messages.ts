import type { Express, Request, Response } from 'express';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '../../../data/db';
import {
  chatConversations,
  chatMessages,
  listings,
  type ChatConversation,
} from '../../admin/models/admin-settings';
import { notifyNewMessage } from '../../../shared/services/auto-notifications';
import {
  normalizePhone,
  pickMeaningfulDisplayName,
  resolveUserDisplayName,
  upsertUser,
} from '../../users/services/user-profiles';
import { resolveUserIdFromRequest } from '../../users/services/user-lifecycle';
import { users } from '../../users/models/users';
import { firstStringField } from '../../../shared/utils/json-fields';

type ParticipantRole = 'buyer' | 'seller';

type CanonicalIdentity = {
  userId: string;
};

type UserProfileSummary = {
  displayName: string;
  avatarUrl: string;
};

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function participantLabel(userId: string, role: 'buyer' | 'seller'): string {
  return resolveUserDisplayName(userId, role === 'seller' ? 'Seller' : 'Buyer');
}

function registerUserProfile(
  map: Map<string, UserProfileSummary>,
  key: unknown,
  profile: UserProfileSummary
): void {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;

  const existing = map.get(normalizedKey);
  if (!existing) {
    map.set(normalizedKey, profile);
    return;
  }

  map.set(normalizedKey, {
    displayName: existing.displayName || profile.displayName,
    avatarUrl: existing.avatarUrl || profile.avatarUrl,
  });
}

async function getUserProfileMap(userIds: string[]): Promise<Map<string, UserProfileSummary>> {
  const uniqueIds = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: users.id,
      mobile: users.mobile,
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(or(inArray(users.id, uniqueIds), inArray(users.mobile, uniqueIds))!);

  const map = new Map<string, UserProfileSummary>();
  for (const row of rows) {
    const profile: UserProfileSummary = {
      displayName: pickMeaningfulDisplayName(row.displayName, row.username),
      avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl.trim() : '',
    };

    registerUserProfile(map, row.id, profile);
    registerUserProfile(map, row.mobile, profile);
    registerUserProfile(map, normalizePhone(row.mobile), profile);
  }
  return map;
}

function captureActorProfile(req: Request, identity: CanonicalIdentity): void {
  const headerName = req.get('x-user-name');
  const name = typeof headerName === 'string' ? headerName.trim() : '';
  if (!name) return;

  upsertUser({
    id: identity.userId,
    phone: identity.userId,
    name,
    email: '',
    gender: 'other',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function getCanonicalIdentity(req: Request): Promise<CanonicalIdentity | null> {
  const resolvedUserId = await resolveUserIdFromRequest(req as any);
  if (!resolvedUserId) return null;

  (req as any).userId = resolvedUserId;
  return {
    userId: resolvedUserId,
  };
}

async function getConversationById(conversationId: string) {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .limit(1);

  return rows[0] || null;
}

async function resolveConversationParticipant(conversationId: string, userId: string) {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;

  if (conversation.buyerId === userId) {
    return { conversation, role: 'buyer' as ParticipantRole };
  }

  if (conversation.sellerId === userId) {
    return { conversation, role: 'seller' as ParticipantRole };
  }

  return null;
}

export function registerMessageRoutes(app: Express) {
  app.get('/api/messages/threads', async (req: Request, res: Response) => {
    try {
      const identity = await getCanonicalIdentity(req);
      if (!identity?.userId) {
        return res.status(401).json({ success: false, error: 'Missing authenticated user' });
      }
      captureActorProfile(req, identity);
      const limit = toPositiveInt(req.query.limit, 30, 100);
      const offset = toNonNegativeInt(req.query.offset, 0);
      const queryLimit = limit + 1;
      const participantFilter = or(
        eq(chatConversations.buyerId, identity.userId),
        eq(chatConversations.sellerId, identity.userId)
      )!;

      const rows = await db
        .select({
          conversationId: chatConversations.id,
          listingId: chatConversations.listingId,
          buyerId: chatConversations.buyerId,
          sellerId: chatConversations.sellerId,
          lastMessage: chatConversations.lastMessage,
          lastMessageAt: chatConversations.lastMessageAt,
          updatedAt: chatConversations.updatedAt,
          listingTitle: listings.title,
          listingImages: listings.images,
        })
        .from(chatConversations)
        .innerJoin(listings, eq(chatConversations.listingId, listings.id))
        .where(participantFilter)
        .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.updatedAt))
        .limit(queryLimit)
        .offset(offset);
      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;

      const otherUserIds = pageRows.map((row) =>
        row.sellerId === identity.userId ? row.buyerId : row.sellerId
      );
      const userProfileMap = await getUserProfileMap(otherUserIds);
      const conversationIds = pageRows.map((row) => row.conversationId);
      const unreadRows =
        conversationIds.length > 0
          ? await db
              .select({
                conversationId: chatMessages.conversationId,
                unreadCount: sql<number>`count(*)`,
              })
              .from(chatMessages)
              .where(
                and(
                  inArray(chatMessages.conversationId, conversationIds),
                  eq(chatMessages.recipientId, identity.userId),
                  isNull(chatMessages.readAt)
                )
              )
              .groupBy(chatMessages.conversationId)
          : [];
      const unreadCountMap = new Map(
        unreadRows.map((row) => [row.conversationId, Number(row.unreadCount) || 0])
      );

      const threads = pageRows.map((row) => {
        const isSeller = row.sellerId === identity.userId;
        const otherUserId = isSeller ? row.buyerId : row.sellerId;
        const otherUserProfile = userProfileMap.get(otherUserId);
        const otherUserLabel =
          otherUserProfile?.displayName ||
          participantLabel(otherUserId, isSeller ? 'buyer' : 'seller');

        return {
          conversationId: row.conversationId,
          listingId: row.listingId,
          listingTitle: row.listingTitle,
          listingImage: firstStringField(row.listingImages),
          otherUserId,
          otherUserLabel,
          otherUserName: otherUserLabel,
          otherUserAvatar: otherUserProfile?.avatarUrl || '',
          lastMessage: row.lastMessage || '',
          lastTimestamp: (row.lastMessageAt || row.updatedAt).toISOString(),
          unreadCount: unreadCountMap.get(row.conversationId) || 0,
        };
      });

      return res.json({
        success: true,
        data: threads,
        limit,
        offset,
        hasMore,
      });
    } catch (error) {
      console.error('[Messages] Failed to fetch threads:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch threads' });
    }
  });

  app.get('/api/messages/conversations/:conversationId', async (req: Request, res: Response) => {
    try {
      const identity = await getCanonicalIdentity(req);
      if (!identity?.userId) {
        return res.status(401).json({ success: false, error: 'Missing authenticated user' });
      }
      captureActorProfile(req, identity);

      const conversationId = String(req.params.conversationId || '').trim();
      if (!conversationId) {
        return res.status(400).json({ success: false, error: 'conversationId is required' });
      }

      const participant = await resolveConversationParticipant(conversationId, identity.userId);
      if (!participant) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }

      const conversation = participant.conversation;
      const listingRow = await db
        .select({
          id: listings.id,
          title: listings.title,
          images: listings.images,
        })
        .from(listings)
        .where(eq(listings.id, conversation.listingId))
        .limit(1);
      const listing = listingRow[0];
      const isSeller = participant.role === 'seller';
      const otherUserId = isSeller ? conversation.buyerId : conversation.sellerId;
      const profileMap = await getUserProfileMap([otherUserId]);
      const otherUserProfile = profileMap.get(otherUserId);
      const otherUserLabel =
        otherUserProfile?.displayName ||
        participantLabel(otherUserId, isSeller ? 'buyer' : 'seller');

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          listingId: conversation.listingId,
          listingTitle: listing?.title || 'Listing',
          listingImage: firstStringField(listing?.images),
          otherUserId,
          otherUserLabel,
          otherUserName: otherUserLabel,
          otherUserAvatar: otherUserProfile?.avatarUrl || '',
        },
      });
    } catch (error) {
      console.error('[Messages] Failed to fetch conversation:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
    }
  });

  app.get(
    '/api/messages/conversations/:conversationId/messages',
    async (req: Request, res: Response) => {
      try {
        const identity = await getCanonicalIdentity(req);
        if (!identity?.userId) {
          return res.status(401).json({ success: false, error: 'Missing authenticated user' });
        }
        captureActorProfile(req, identity);

        const conversationId = String(req.params.conversationId || '').trim();
        if (!conversationId) {
          return res.status(400).json({ success: false, error: 'conversationId is required' });
        }

        const participant = await resolveConversationParticipant(conversationId, identity.userId);
        if (!participant) {
          return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        const conversation = participant.conversation;
        const limit = toPositiveInt(req.query.limit, 100, 300);
        const offset = toNonNegativeInt(req.query.offset, 0);
        const queryLimit = limit + 1;

        await db
          .update(chatMessages)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(chatMessages.conversationId, conversationId),
              eq(chatMessages.recipientId, identity.userId),
              isNull(chatMessages.readAt)
            )
          );

        const rows = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, conversationId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(queryLimit)
          .offset(offset);
        const hasMore = rows.length > limit;
        const pageRows = (hasMore ? rows.slice(0, limit) : rows).reverse();

        const messages = pageRows.map((row) => ({
          id: row.id,
          conversationId: row.conversationId,
          listingId: conversation.listingId,
          text: row.text,
          sender: row.senderId === identity.userId ? 'me' : 'seller',
          senderId: row.senderId,
          recipientId: row.recipientId,
          timestamp: row.createdAt.toISOString(),
          readAt: row.readAt ? row.readAt.toISOString() : null,
          isRead: Boolean(row.readAt),
        }));

        return res.json({
          success: true,
          data: messages,
          limit,
          offset,
          hasMore,
        });
      } catch (error) {
        console.error('[Messages] Failed to fetch messages:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
      }
    }
  );

  app.post('/api/messages/send', async (req: Request, res: Response) => {
    try {
      const identity = await getCanonicalIdentity(req);
      if (!identity?.userId) {
        return res.status(401).json({ success: false, error: 'Missing authenticated user' });
      }
      captureActorProfile(req, identity);

      const textRaw = typeof req.body?.text === 'string' ? req.body.text : '';
      const text = textRaw.trim();
      const conversationIdRaw =
        typeof req.body?.conversationId === 'string' ? req.body.conversationId : '';
      const listingIdRaw = typeof req.body?.listingId === 'string' ? req.body.listingId : '';
      const conversationId = conversationIdRaw.trim();
      const listingId = listingIdRaw.trim();

      if (!text) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }
      if (!conversationId && !listingId) {
        return res
          .status(400)
          .json({ success: false, error: 'conversationId or listingId is required' });
      }

      let conversation: ChatConversation | null = null;
      let recipientId = '';
      let senderRole: ParticipantRole = 'buyer';
      let recipientRole: ParticipantRole = 'seller';

      if (conversationId) {
        const participant = await resolveConversationParticipant(conversationId, identity.userId);
        if (!participant) {
          return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        conversation = participant.conversation;
        senderRole = participant.role;

        recipientId = senderRole === 'seller' ? conversation.buyerId : conversation.sellerId;
        recipientRole = senderRole === 'seller' ? 'buyer' : 'seller';
      } else {
        const listingRows = await db
          .select({ id: listings.id, sellerId: listings.sellerId })
          .from(listings)
          .where(eq(listings.id, listingId))
          .limit(1);

        const listing = listingRows[0];
        if (!listing) {
          return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        if (listing.sellerId === identity.userId) {
          return res.status(400).json({
            success: false,
            error: 'Seller must send using an existing conversationId',
          });
        }

        senderRole = 'buyer';
        recipientId = listing.sellerId;
        recipientRole = 'seller';

        const existing = await db
          .select()
          .from(chatConversations)
          .where(
            and(
              eq(chatConversations.listingId, listing.id),
              eq(chatConversations.buyerId, identity.userId),
              eq(chatConversations.sellerId, listing.sellerId)
            )
          )
          .limit(1);

        conversation = existing[0] || null;

        if (!conversation) {
          const created = await db
            .insert(chatConversations)
            .values({
              listingId: listing.id,
              buyerId: identity.userId,
              sellerId: listing.sellerId,
              lastMessage: text,
              lastMessageAt: new Date(),
            })
            .returning();

          conversation = created[0] || null;
        }
      }

      if (!conversation) {
        return res.status(500).json({ success: false, error: 'Failed to create conversation' });
      }

      const inserted = await db
        .insert(chatMessages)
        .values({
          conversationId: conversation.id,
          senderId: identity.userId,
          recipientId,
          text,
        })
        .returning();

      await db
        .update(chatConversations)
        .set({
          lastMessage: text,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatConversations.id, conversation.id));

      const participantProfileMap = await getUserProfileMap([identity.userId, recipientId]);
      const senderProfile = participantProfileMap.get(identity.userId);
      const recipientProfile = participantProfileMap.get(recipientId);
      const senderLabel =
        senderProfile?.displayName || participantLabel(identity.userId, senderRole);
      notifyNewMessage(recipientId, senderLabel, text, conversation.id, identity.userId).catch(
        (err) => {
          console.error('[Messages] Failed to send new message notification:', err);
        }
      );

      const message = inserted[0];
      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          listingId: conversation.listingId,
          otherUserId: recipientId,
          otherUserLabel:
            recipientProfile?.displayName || participantLabel(recipientId, recipientRole),
          otherUserName:
            recipientProfile?.displayName || participantLabel(recipientId, recipientRole),
          otherUserAvatar: recipientProfile?.avatarUrl || '',
          message: {
            id: message.id,
            text: message.text,
            sender: 'me',
            senderId: message.senderId,
            recipientId: message.recipientId,
            timestamp: message.createdAt.toISOString(),
            readAt: null,
            isRead: false,
          },
        },
      });
    } catch (error) {
      console.error('[Messages] Failed to send message:', error);
      return res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });
}
