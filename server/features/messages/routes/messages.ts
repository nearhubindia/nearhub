import type { Express, Request, Response } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';

import { db } from '../../../data/db';
import {
  chatConversations,
  chatMessages,
  listings,
  type ChatConversation,
} from '../../admin/models/admin-settings';
import { notifyNewMessage } from '../../../shared/services/auto-notifications';
import { resolveUserDisplayName, upsertUser } from '../../users/services/user-profiles';
import { resolveUserIdFromRequest } from '../../users/services/user-lifecycle';

type ParticipantRole = 'buyer' | 'seller';

type CanonicalIdentity = {
  userId: string;
};

function parseFirstImage(value: unknown): string {
  if (!value) return '';

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof first === 'string' ? first : '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item === 'string' && item.trim().length > 0);
        return typeof first === 'string' ? first : '';
      }
      return '';
    } catch {
      return trimmed;
    }
  }

  return '';
}

function participantLabel(userId: string, role: 'buyer' | 'seller'): string {
  return resolveUserDisplayName(userId, role === 'seller' ? 'Seller' : 'Buyer');
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
        .where(
          or(
            eq(chatConversations.buyerId, identity.userId),
            eq(chatConversations.sellerId, identity.userId)
          )
        )
        .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.updatedAt));

      const threads = rows.map((row) => {
        const isSeller = row.sellerId === identity.userId;
        const otherUserId = isSeller ? row.buyerId : row.sellerId;
        const otherUserLabel = participantLabel(otherUserId, isSeller ? 'buyer' : 'seller');

        return {
          conversationId: row.conversationId,
          listingId: row.listingId,
          listingTitle: row.listingTitle,
          listingImage: parseFirstImage(row.listingImages),
          otherUserId,
          otherUserLabel,
          otherUserName: otherUserLabel,
          lastMessage: row.lastMessage || '',
          lastTimestamp: (row.lastMessageAt || row.updatedAt).toISOString(),
        };
      });

      return res.json({ success: true, data: threads });
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

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          listingId: conversation.listingId,
          listingTitle: listing?.title || 'Listing',
          listingImage: parseFirstImage(listing?.images),
          otherUserId,
          otherUserLabel: participantLabel(otherUserId, isSeller ? 'buyer' : 'seller'),
          otherUserName: participantLabel(otherUserId, isSeller ? 'buyer' : 'seller'),
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

        const rows = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, conversationId))
          .orderBy(chatMessages.createdAt);

        const messages = rows.map((row) => ({
          id: row.id,
          conversationId: row.conversationId,
          listingId: conversation.listingId,
          text: row.text,
          sender: row.senderId === identity.userId ? 'me' : 'seller',
          senderId: row.senderId,
          recipientId: row.recipientId,
          timestamp: row.createdAt.toISOString(),
        }));

        return res.json({ success: true, data: messages });
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

      if (conversationId) {
        const participant = await resolveConversationParticipant(conversationId, identity.userId);
        if (!participant) {
          return res.status(404).json({ success: false, error: 'Conversation not found' });
        }
        conversation = participant.conversation;
        senderRole = participant.role;

        recipientId = senderRole === 'seller' ? conversation.buyerId : conversation.sellerId;
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

      notifyNewMessage(
        recipientId,
        participantLabel(identity.userId, senderRole),
        text,
        conversation.id
      ).catch((err) => {
        console.error('[Messages] Failed to send new message notification:', err);
      });

      const message = inserted[0];
      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          listingId: conversation.listingId,
          message: {
            id: message.id,
            text: message.text,
            sender: 'me',
            senderId: message.senderId,
            recipientId: message.recipientId,
            timestamp: message.createdAt.toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('[Messages] Failed to send message:', error);
      return res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });
}
