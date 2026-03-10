import type { Express, Request, Response } from 'express';
import { db } from '../../../data/db';
import { contactSubmissions } from '../../admin/models/admin-settings';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^[0-9]{10}$/.test(phone);
}

export function registerContactRoutes(app: Express) {
  /**
   * POST /api/contact
   * Public endpoint to submit a contact form message.
   */
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const source = typeof req.body?.source === 'string' ? req.body.source.trim() : 'web';

      if (!name || !email || !phone || !subject || !message) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, phone, subject, and message are required',
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address',
        });
      }

      if (!isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Phone number must be exactly 10 digits',
        });
      }

      if (name.length > 120 || email.length > 255 || phone.length > 30 || subject.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'One or more fields exceed allowed length',
        });
      }

      await db.insert(contactSubmissions).values({
        name,
        email: email.toLowerCase(),
        phone,
        subject,
        message,
        source: source || 'web',
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      });

      return res.status(201).json({
        success: true,
        message: 'Contact message submitted successfully',
      });
    } catch (error) {
      console.error('[Contact] Failed to save contact submission:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit message',
      });
    }
  });
}
