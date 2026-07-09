import type { Express, Request, Response } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../data/db';
import { dealBookings, listings } from '../../admin/models/admin-settings';
import { users } from '../../users/models/users';
import { getRequestUserId } from '../../../lib/request-user';
import { parseStringArrayField } from '../../../shared/utils/json-fields';

function voucherCode(): string {
  const block = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NHD-${Date.now().toString(36).toUpperCase()}-${block}`;
}

function normalizeBookingStatus(
  value: unknown
): 'booked' | 'redeemed' | 'cancelled' | 'expired' | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'purchased' || normalized === 'purchase') return 'booked';
  if (normalized === 'encashed' || normalized === 'encash' || normalized === 'redeem')
    return 'redeemed';
  if (
    normalized === 'booked' ||
    normalized === 'redeemed' ||
    normalized === 'cancelled' ||
    normalized === 'expired'
  ) {
    return normalized;
  }
  return null;
}

function canBuyerCancelBooking(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'booked';
}

function addDealCycle(date: Date, recurrence: string): Date {
  const next = new Date(date);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

function getEffectiveDealWindow(listing: typeof listings.$inferSelect, now: Date) {
  if (!listing.dealStartAt || !listing.dealEndAt || listing.dealEndAt <= listing.dealStartAt) {
    return null;
  }
  const recurrence = String((listing as any).dealRecurrence || 'none').toLowerCase();
  const recurring = recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly';
  if (!recurring) {
    return {
      startAt: new Date(listing.dealStartAt),
      endAt: new Date(listing.dealEndAt),
      cycleKey: new Date(listing.dealStartAt).toISOString().slice(0, 10),
    };
  }

  const repeatUntil = (listing as any).dealRecurrenceUntil
    ? new Date((listing as any).dealRecurrenceUntil)
    : null;
  if (!repeatUntil || repeatUntil < listing.dealStartAt) return null;

  let startAt = new Date(listing.dealStartAt);
  let endAt = new Date(listing.dealEndAt);
  let guard = 0;
  while (endAt < now && endAt < repeatUntil && guard < 370) {
    startAt = addDealCycle(startAt, recurrence);
    endAt = addDealCycle(endAt, recurrence);
    guard += 1;
  }
  if (startAt > repeatUntil) return null;
  return {
    startAt,
    endAt: endAt > repeatUntil ? repeatUntil : endAt,
    cycleKey: startAt.toISOString().slice(0, 10),
  };
}

function pdfEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfDocument(content: string): Buffer {
  const contentLength = Buffer.byteLength(content, 'utf8');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n'
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj\n');
  objects.push(`7 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}endstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function pdfText(
  x: number,
  y: number,
  value: string,
  opts?: { font?: 'F1' | 'F2' | 'F3'; size?: number }
): string {
  const font = opts?.font || 'F1';
  const size = opts?.size || 10;
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function pdfTable(
  x: number,
  topY: number,
  labelWidth: number,
  valueWidth: number,
  rowHeight: number,
  rows: Array<[string, string]>
): string[] {
  const ops: string[] = [];
  const width = labelWidth + valueWidth;
  const height = rows.length * rowHeight;
  const bottomY = topY - height;
  ops.push('0.82 0.82 0.82 RG');
  ops.push(`${x} ${bottomY} ${width} ${height} re S`);
  ops.push(pdfLine(x + labelWidth, bottomY, x + labelWidth, topY));
  for (let index = 1; index < rows.length; index += 1) {
    const y = topY - index * rowHeight;
    ops.push(pdfLine(x, y, x + width, y));
  }
  rows.forEach(([label, value], index) => {
    const textY = topY - index * rowHeight - 13;
    ops.push(pdfText(x + 7, textY, label, { font: 'F2', size: 10 }));
    ops.push(pdfText(x + labelWidth + 7, textY, value, { font: 'F1', size: 10 }));
  });
  ops.push('0 0 0 RG');
  return ops;
}

function parseVoucherPayloadSafe(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatVoucherDate(value: unknown): string {
  if (!value) return 'Not available';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatVoucherAmount(value: unknown): string {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not available';
  return `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function addDays(value: unknown, days: number): string {
  if (!value) return 'Not available';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not available';
  date.setDate(date.getDate() + days);
  return formatVoucherDate(date.toISOString());
}

function voucherStatusLabel(value: unknown): string {
  const normalized = String(value || 'booked').toLowerCase();
  if (normalized === 'booked') return 'Purchased';
  if (normalized === 'redeemed') return 'Encashed';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function userDisplay(user: any, fallback: string): string {
  return String(user?.displayName || user?.username || user?.mobile || fallback || 'Not available');
}

function voucherCell(value: unknown, fallback = 'Not available', maxLength = 76): string {
  const text =
    String(value || fallback)
      .replace(/\s+/g, ' ')
      .trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

async function loadVoucherContext(bookingId: string, requesterId: string) {
  const bookingRows = await db
    .select()
    .from(dealBookings)
    .where(eq(dealBookings.id, bookingId))
    .limit(1);
  const booking = bookingRows[0];
  if (!booking) {
    return { status: 404, error: 'Booking not found' as const };
  }
  if (String(booking.buyerId) !== requesterId && String(booking.sellerId) !== requesterId) {
    return { status: 403, error: 'Unauthorized voucher access' as const };
  }
  if (String(booking.status || '').toLowerCase() === 'cancelled' && String(booking.buyerId) === requesterId) {
    return { status: 410, error: 'This booking was cancelled' as const };
  }

  const [listingRows, sellerRows, buyerRows] = await Promise.all([
    db.select().from(listings).where(eq(listings.id, booking.listingId)).limit(1),
    db.select().from(users).where(eq(users.id, booking.sellerId)).limit(1),
    db.select().from(users).where(eq(users.id, booking.buyerId)).limit(1),
  ]);

  return {
    status: 200,
    booking,
    listing: listingRows[0],
    seller: sellerRows[0],
    buyer: buyerRows[0],
    payload: parseVoucherPayloadSafe(booking.voucherPayload),
  };
}

function buildVoucherPdf(context: {
  booking: typeof dealBookings.$inferSelect;
  listing?: typeof listings.$inferSelect;
  seller?: typeof users.$inferSelect;
  buyer?: typeof users.$inferSelect;
  payload: Record<string, any>;
}): Buffer {
  const { booking, listing, seller, buyer, payload } = context;
  const price = Number(listing?.price || payload.price || 0);
  const offerPrice = Number(listing?.offerPrice || payload.offerPrice || 0);
  const dealPrice = offerPrice > 0 ? offerPrice : price;
  const savings = price > 0 && dealPrice > 0 && price > dealPrice ? price - dealPrice : 0;
  const purchaseDate = booking.bookedAt || payload.bookedAt;
  const sectionBlue = '0.05 0.35 1 rg';
  const ops: string[] = ['1 w', '0 0 0 rg', '0 0 0 RG'];

  ops.push(pdfText(175, 792, 'NEARHUB DEAL VOUCHER', { font: 'F2', size: 18 }));
  ops.push(pdfText(70, 764, 'Premium Purchase & Redemption Certificate', { font: 'F3', size: 11 }));
  ops.push(
    ...pdfTable(70, 744, 125, 330, 18, [
      ['Voucher Code', voucherCell(booking.voucherCode || payload.voucherCode, '', 60)],
      ['Status', voucherStatusLabel(booking.status)],
      ['Booking ID', voucherCell(booking.id, '', 60)],
      ['Purchased', formatVoucherDate(purchaseDate)],
      ['Valid Until', addDays(purchaseDate, 7)],
      ['Redeemed', booking.redeemedAt ? formatVoucherDate(booking.redeemedAt) : 'Not encashed yet'],
    ])
  );

  ops.push(sectionBlue);
  ops.push(pdfText(70, 592, 'Deal Summary', { font: 'F2', size: 15 }));
  ops.push('0 0 0 rg');
  ops.push(
    ...pdfTable(70, 576, 125, 330, 18, [
      ['Deal', voucherCell(listing?.title || payload.listingTitle || 'Deal product')],
      ['Category', voucherCell(listing?.category || listing?.subCategory || payload.category)],
      ['Location', voucherCell(listing?.location || payload.location)],
      ['Original Price', formatVoucherAmount(price)],
      ['Deal Price', formatVoucherAmount(dealPrice)],
      ['You Saved', savings > 0 ? formatVoucherAmount(savings) : 'Not available'],
    ])
  );

  ops.push(sectionBlue);
  ops.push(pdfText(70, 414, 'Seller Information', { font: 'F2', size: 15 }));
  ops.push('0 0 0 rg');
  ops.push(
    ...pdfTable(70, 398, 125, 330, 18, [
      [
        'Name',
        voucherCell(userDisplay(seller, String(booking.sellerId || '')), 'Not available', 60),
      ],
      ['Phone', voucherCell(seller?.mobile || listing?.contactPhone, 'Not available', 60)],
    ])
  );

  ops.push(sectionBlue);
  ops.push(pdfText(70, 328, 'Buyer Information', { font: 'F2', size: 15 }));
  ops.push('0 0 0 rg');
  ops.push(
    ...pdfTable(70, 312, 125, 330, 18, [
      ['Name', voucherCell(userDisplay(buyer, String(booking.buyerId || '')), 'Not available', 60)],
      ['Phone', voucherCell(buyer?.mobile, 'Not available', 60)],
    ])
  );

  ops.push(
    pdfText(70, 238, 'Note: Deal Voucher is Valid upto 7 Days only from date of Purchase.', {
      font: 'F3',
      size: 10,
    })
  );
  ops.push(
    pdfText(70, 218, `Generated At: ${formatVoucherDate(new Date().toISOString())}`, {
      font: 'F1',
      size: 9,
    })
  );

  return buildPdfDocument(`${ops.join('\n')}\n`);
}

async function sendVoucherPdf(
  req: Request,
  res: Response,
  disposition: 'inline' | 'attachment',
  failureMessage: string
) {
  try {
    const requesterId = getRequestUserId(req);
    if (!requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const bookingId = String(req.params.bookingId || '').trim();
    const context = await loadVoucherContext(bookingId, requesterId);
    if (context.status !== 200 || !context.booking) {
      return res.status(context.status).json({ success: false, error: context.error });
    }
    const pdf = buildVoucherPdf(context as Parameters<typeof buildVoucherPdf>[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="nearhub-voucher-${context.booking.id}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    console.error(`[Deals] ${failureMessage}:`, error);
    return res.status(500).json({ success: false, error: failureMessage });
  }
}

export function registerDealRoutes(app: Express): void {
  app.post('/api/deals/:listingId/book', async (req: Request, res: Response) => {
    try {
      const buyerId = getRequestUserId(req);
      if (!buyerId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const listingId = String(req.params.listingId || '').trim();
      if (!listingId) {
        return res.status(400).json({ success: false, error: 'Listing id is required' });
      }

      const [result] = await db.transaction(async (tx) => {
        const found = await tx.select().from(listings).where(eq(listings.id, listingId)).limit(1);
        const listing = found[0];
        if (!listing)
          return [{ status: 404, body: { success: false, error: 'Listing not found' } }];
        if (!listing.isDeal)
          return [{ status: 400, body: { success: false, error: 'This listing is not a deal' } }];
        if (!listing.isActive || listing.status !== 'active') {
          return [{ status: 400, body: { success: false, error: 'Deal is not active' } }];
        }

        const now = new Date();
        const dealWindow = getEffectiveDealWindow(listing, now);
        if (!dealWindow) {
          return [
            { status: 400, body: { success: false, error: 'Deal booking window is unavailable' } },
          ];
        }
        if (now < dealWindow.startAt) {
          return [
            { status: 400, body: { success: false, error: 'Deal booking has not started yet' } },
          ];
        }
        if (now > dealWindow.endAt) {
          return [
            { status: 400, body: { success: false, error: 'Deal booking window has closed' } },
          ];
        }
        if ((listing as any).dealLastCycleKey !== dealWindow.cycleKey) {
          await tx
            .update(listings)
            .set({
              dealBookingsUsed: 0,
              dealLastCycleKey: dealWindow.cycleKey,
              updatedAt: new Date(),
            } as any)
            .where(eq(listings.id, listingId));
        }

        const purchaseLimitType = String((listing as any).purchaseLimitType || '').toUpperCase();
        if (purchaseLimitType === 'ONE_TIME') {
          const alreadyPurchased = await tx
            .select()
            .from(dealBookings)
            .where(
              and(
                eq(dealBookings.listingId, listingId),
                eq(dealBookings.buyerId, buyerId),
                inArray(dealBookings.status, ['booked', 'redeemed'])
              )
            )
            .limit(1);
          if (alreadyPurchased[0]) {
            return [
              {
                status: 409,
                body: {
                  success: false,
                  error:
                    'You have already purchased this deal. This offer is limited to one purchase per customer.',
                },
              },
            ];
          }
        } else if (purchaseLimitType !== 'UNLIMITED') {
          const already = await tx
            .select()
            .from(dealBookings)
            .where(
              and(
                eq(dealBookings.listingId, listingId),
                eq(dealBookings.dealCycleKey, dealWindow.cycleKey),
                eq(dealBookings.buyerId, buyerId),
                inArray(dealBookings.status, ['booked', 'redeemed'])
              )
            )
            .limit(1);
          if (already[0]) {
            return [{ status: 409, body: { success: false, error: 'You already booked this deal' } }];
          }
        }

        const maxSlots = Number((listing as any).dealCycleQuantity || listing.maxDealBookings || 0);
        if (maxSlots > 0) {
          const updateSlots = await tx
            .update(listings)
            .set({
              dealBookingsUsed: sql`${listings.dealBookingsUsed} + 1`,
              updatedAt: new Date(),
            } as any)
            .where(and(eq(listings.id, listingId), sql`${listings.dealBookingsUsed} < ${maxSlots}`))
            .returning({ id: listings.id, dealBookingsUsed: listings.dealBookingsUsed });
          if (!updateSlots[0]) {
            return [{ status: 409, body: { success: false, error: 'All deal slots are full' } }];
          }
        } else {
          await tx
            .update(listings)
            .set({
              dealBookingsUsed: sql`${listings.dealBookingsUsed} + 1`,
              updatedAt: new Date(),
            } as any)
            .where(eq(listings.id, listingId));
        }

        const code = voucherCode();
        const listingImages = parseStringArrayField(listing.images);
        const primaryImage = listingImages[0] || '';
        const payload = {
          voucherCode: code,
          listingId,
          listingTitle: listing.title,
          buyerId,
          sellerId: listing.sellerId,
          bookedAt: now.toISOString(),
          dealStartAt: dealWindow.startAt.toISOString(),
          dealEndAt: dealWindow.endAt.toISOString(),
          dealCycleKey: dealWindow.cycleKey,
          listingImage: primaryImage,
          listingImages,
          terms: String(listing.dealTerms || '').trim(),
        };

        const inserted = await tx
          .insert(dealBookings)
          .values({
            listingId,
            dealCycleKey: dealWindow.cycleKey,
            buyerId,
            sellerId: String(listing.sellerId),
            status: 'booked',
            voucherCode: code,
            voucherPayload: JSON.stringify(payload),
          })
          .returning();

        return [
          {
            status: 200,
            body: {
              success: true,
              booking: inserted[0],
              voucher: payload,
              listingImage: primaryImage,
              listingImages,
              voucherViewUrl: `/api/deals/bookings/${inserted[0].id}/voucher`,
            },
          },
        ];
      });

      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('[Deals] Failed to create booking:', error);
      return res.status(500).json({ success: false, error: 'Failed to book deal' });
    }
  });

  app.get('/api/deals/my-bookings', async (req: Request, res: Response) => {
    try {
      const buyerId = getRequestUserId(req);
      if (!buyerId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const rows = await db
        .select()
        .from(dealBookings)
        .where(eq(dealBookings.buyerId, buyerId))
        .orderBy(desc(dealBookings.createdAt))
        .limit(200);
      return res.json({ success: true, bookings: rows });
    } catch (error) {
      console.error('[Deals] Failed to fetch buyer bookings:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
    }
  });

  app.get('/api/deals/listing/:listingId/bookings', async (req: Request, res: Response) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const listingId = String(req.params.listingId || '').trim();
      const found = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
      const listing = found[0];
      if (!listing) {
        return res.status(404).json({ success: false, error: 'Listing not found' });
      }
      if (String(listing.sellerId) !== requesterId) {
        return res
          .status(403)
          .json({ success: false, error: 'Only seller can view deal bookings' });
      }
      const rows = await db
        .select()
        .from(dealBookings)
        .where(eq(dealBookings.listingId, listingId))
        .orderBy(desc(dealBookings.createdAt))
        .limit(500);
      return res.json({ success: true, bookings: rows });
    } catch (error) {
      console.error('[Deals] Failed to fetch seller deal bookings:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
    }
  });

  app.get('/api/deals/seller/bookings', async (req: Request, res: Response) => {
    try {
      const sellerId = getRequestUserId(req);
      if (!sellerId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const rows = await db
        .select({
          id: dealBookings.id,
          listingId: dealBookings.listingId,
          dealCycleKey: dealBookings.dealCycleKey,
          buyerId: dealBookings.buyerId,
          sellerId: dealBookings.sellerId,
          status: dealBookings.status,
          voucherCode: dealBookings.voucherCode,
          voucherPayload: dealBookings.voucherPayload,
          bookedAt: dealBookings.bookedAt,
          redeemedAt: dealBookings.redeemedAt,
          createdAt: dealBookings.createdAt,
          updatedAt: dealBookings.updatedAt,
          listingTitle: listings.title,
        })
        .from(dealBookings)
        .leftJoin(listings, eq(listings.id, dealBookings.listingId))
        .where(eq(dealBookings.sellerId, sellerId))
        .orderBy(desc(dealBookings.createdAt))
        .limit(500);

      return res.json({ success: true, bookings: rows });
    } catch (error) {
      console.error('[Deals] Failed to fetch seller bookings:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch seller bookings' });
    }
  });

  app.post('/api/deals/bookings/:bookingId/redeem', async (req: Request, res: Response) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const bookingId = String(req.params.bookingId || '').trim();
      const rows = await db
        .select()
        .from(dealBookings)
        .where(eq(dealBookings.id, bookingId))
        .limit(1);
      const booking = rows[0];
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      if (String(booking.sellerId) !== requesterId) {
        return res.status(403).json({ success: false, error: 'Only seller can redeem voucher' });
      }
      if (booking.status === 'redeemed') {
        return res.status(409).json({ success: false, error: 'Voucher already redeemed' });
      }

      const updated = await db
        .update(dealBookings)
        .set({ status: 'redeemed', redeemedAt: new Date(), updatedAt: new Date() })
        .where(eq(dealBookings.id, bookingId))
        .returning();
      return res.json({ success: true, booking: updated[0] });
    } catch (error) {
      console.error('[Deals] Failed to redeem booking:', error);
      return res.status(500).json({ success: false, error: 'Failed to redeem voucher' });
    }
  });

  app.post('/api/deals/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const bookingId = String(req.params.bookingId || '').trim();
      const rows = await db
        .select()
        .from(dealBookings)
        .where(eq(dealBookings.id, bookingId))
        .limit(1);
      const booking = rows[0];
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      if (String(booking.buyerId) !== requesterId) {
        return res.status(403).json({ success: false, error: 'Only buyer can cancel booking' });
      }
      if (!canBuyerCancelBooking(booking.status)) {
        return res.status(409).json({
          success: false,
          error: 'Only active booked deals can be cancelled',
        });
      }

      const listingRows = await db.select().from(listings).where(eq(listings.id, booking.listingId)).limit(1);
      const listing = listingRows[0];

      const updated = await db.transaction(async (tx) => {
        const bookingUpdate = await tx
          .update(dealBookings)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(dealBookings.id, bookingId))
          .returning();

        if (listing) {
          await tx
            .update(listings)
            .set({
              dealBookingsUsed: sql`GREATEST(${listings.dealBookingsUsed} - 1, 0)`,
              updatedAt: new Date(),
            } as any)
            .where(eq(listings.id, listing.id));
        }

        return bookingUpdate[0];
      });

      return res.json({ success: true, booking: updated });
    } catch (error) {
      console.error('[Deals] Failed to cancel booking:', error);
      return res.status(500).json({ success: false, error: 'Failed to cancel booking' });
    }
  });

  app.post('/api/deals/bookings/:bookingId/status', async (req: Request, res: Response) => {
    try {
      const requesterId = getRequestUserId(req);
      if (!requesterId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const bookingId = String(req.params.bookingId || '').trim();
      const nextStatus = normalizeBookingStatus(req.body?.status);
      if (!nextStatus) {
        return res.status(400).json({
          success: false,
          error: 'Status must be booked, purchased, redeemed, encashed, cancelled, or expired',
        });
      }

      const rows = await db
        .select()
        .from(dealBookings)
        .where(eq(dealBookings.id, bookingId))
        .limit(1);
      const booking = rows[0];
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      if (String(booking.sellerId) !== requesterId) {
        return res
          .status(403)
          .json({ success: false, error: 'Only seller can update booking status' });
      }
      if (booking.status === 'redeemed' && nextStatus !== 'redeemed') {
        return res
          .status(409)
          .json({ success: false, error: 'Redeemed vouchers cannot be moved back' });
      }
      if (
        (booking.status === 'cancelled' || booking.status === 'expired') &&
        nextStatus === 'redeemed'
      ) {
        return res
          .status(409)
          .json({ success: false, error: 'Cancelled or expired bookings cannot be encashed' });
      }

      const updated = await db
        .update(dealBookings)
        .set({
          status: nextStatus,
          redeemedAt:
            nextStatus === 'redeemed' ? booking.redeemedAt || new Date() : booking.redeemedAt,
          updatedAt: new Date(),
        })
        .where(eq(dealBookings.id, bookingId))
        .returning();
      return res.json({ success: true, booking: updated[0] });
    } catch (error) {
      console.error('[Deals] Failed to update booking status:', error);
      return res.status(500).json({ success: false, error: 'Failed to update booking status' });
    }
  });

  app.get('/api/deals/bookings/:bookingId/voucher', async (req: Request, res: Response) => {
    return sendVoucherPdf(req, res, 'inline', 'Failed to render voucher');
  });

  app.get(
    '/api/deals/bookings/:bookingId/voucher/download',
    async (req: Request, res: Response) => {
      return sendVoucherPdf(req, res, 'attachment', 'Failed to download voucher');
    }
  );
}
