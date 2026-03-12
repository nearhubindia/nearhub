/**
 * Tax Invoice Routes
 * Generates and manages tax invoices for subscriptions
 */

import type { Express, Request, Response } from 'express';
import InvoiceService, { InvoiceItem, InvoiceData } from '../services/invoice';
import { db } from '../../../data/db';
import { invoices } from '../../admin/models/admin-settings';
import { and, desc, eq } from 'drizzle-orm';
import { getRequestUserId } from '../../../lib/request-user';

async function resolveInvoiceData(
  invoiceNumber: string,
  rawData?: string
): Promise<InvoiceData | null> {
  if (rawData) {
    return JSON.parse(decodeURIComponent(rawData));
  }

  const result = await db
    .select({ invoiceData: invoices.invoiceData })
    .from(invoices)
    .where(eq(invoices.invoiceNumber, invoiceNumber))
    .limit(1);

  if (result.length === 0) return null;
  return JSON.parse(result[0].invoiceData) as InvoiceData;
}

export function registerInvoiceRoutes(app: Express) {
  // Initialize invoice service with Synvide Business Solutions config
  const invoiceConfig = InvoiceService.createSynvideConfig();

  /**
   * POST /api/invoices/generate
   * Generate a tax invoice for a subscription
   *
   * Body: {
   *   customerId: string,
   *   customerName: string,
   *   customerEmail: string,
   *   customerPhone: string,
   *   items: Array<{ description, quantity, unitPrice, amount }>,
   *   orderId?: string,
   *   paymentId?: string,
   *   subscriptionId?: string,
   *   paymentMethod?: string,
   *   customerAddress?: string,
   *   customerCity?: string,
   *   customerState?: string,
   *   customerPincode?: string,
   *   customerGST?: string,
   *   isInterState?: boolean,
   *   notes?: string
   * }
   */
  app.post('/api/invoices/generate', async (req: Request, res: Response) => {
    try {
      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        items,
        orderId,
        paymentId,
        subscriptionId,
        paymentMethod,
        customerAddress,
        customerCity,
        customerState,
        customerPincode,
        customerGST,
        isInterState,
        notes,
      } = req.body;

      // Validate required fields
      if (
        !customerId ||
        !customerName ||
        !customerEmail ||
        !customerPhone ||
        !items ||
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            'Missing required fields: customerId, customerName, customerEmail, customerPhone, and items array',
        });
      }

      // Validate items
      const validItems: InvoiceItem[] = items.map((item: any) => ({
        description: String(item.description),
        quantity: Number(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        amount:
          parseFloat(item.amount) || parseFloat(item.unitPrice) * (Number(item.quantity) || 1),
      }));

      // Create invoice service instance
      const invoiceService = new InvoiceService(invoiceConfig);

      // Generate invoice
      const invoice = invoiceService.createInvoice(
        customerName,
        customerEmail,
        customerPhone,
        validItems,
        {
          customerAddress,
          customerCity,
          customerState,
          customerPincode,
          customerGST,
          paymentMethod,
          paymentId,
          orderId,
          notes,
          isInterState,
        }
      );

      return res.json({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice,
        downloadUrl: `/api/invoices/${invoice.invoiceNumber}/download`,
        viewUrl: `/api/invoices/${invoice.invoiceNumber}/view`,
      });
    } catch (error) {
      console.error('[Invoices] Error generating invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate invoice',
      });
    }
  });

  /**
   * GET /api/invoices/:invoiceNumber/view
   * View invoice as HTML
   */
  app.get('/api/invoices/:invoiceNumber/view', async (req: Request, res: Response) => {
    try {
      const invoiceNumber = req.params.invoiceNumber as string;
      const invoiceJson = req.query.data as string;
      const invoice = await resolveInvoiceData(invoiceNumber, invoiceJson);
      if (!invoice) {
        return res.status(400).json({
          success: false,
          error: 'Invoice not found',
        });
      }

      const invoiceService = new InvoiceService(invoiceConfig);
      const html = invoiceService.createInvoiceHTML(invoice);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error('[Invoices] Error viewing invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to view invoice',
      });
    }
  });

  /**
   * GET /api/invoices/:invoiceNumber/download
   * Download invoice as PDF (requires pdfkit or similar)
   * For now, returns HTML that can be printed to PDF
   */
  app.get('/api/invoices/:invoiceNumber/download', async (req: Request, res: Response) => {
    try {
      const invoiceNumber = req.params.invoiceNumber as string;
      const invoiceJson = req.query.data as string;
      const invoice = await resolveInvoiceData(invoiceNumber, invoiceJson);
      if (!invoice) {
        return res.status(400).json({
          success: false,
          error: 'Invoice not found',
        });
      }

      const invoiceService = new InvoiceService(invoiceConfig);
      const html = invoiceService.createInvoiceHTML(invoice);

      // Set headers for PDF download (browser will save as HTML file)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Invoice_${invoice.invoiceNumber}.html"`
      );
      res.send(html);
    } catch (error) {
      console.error('[Invoices] Error downloading invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download invoice',
      });
    }
  });

  /**
   * GET /api/users/invoices
   * Returns invoices for authenticated user (or x-user-id header)
   */
  app.get('/api/users/invoices', async (req: Request, res: Response) => {
    try {
      const userId = getRequestUserId(req) || String(req.query.userId || '');
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing user identifier',
        });
      }

      const rows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.customerId, String(userId))))
        .orderBy(desc(invoices.createdAt))
        .limit(200);

      return res.json({
        success: true,
        invoices: rows.map((row) => {
          const parsedInvoiceData = row.invoiceData ? JSON.parse(row.invoiceData) : undefined;
          const vendorName = String(parsedInvoiceData?.vendorName || '').trim();
          const vendorCity = String(parsedInvoiceData?.vendorCity || '').trim();
          const vendorGST = String(parsedInvoiceData?.vendorGST || '').trim();
          return {
            invoiceNumber: row.invoiceNumber,
            invoiceDate: row.invoiceDate,
            customerName: row.customerName,
            total: Number(row.totalAmount || 0),
            status: row.status || 'issued',
            paymentId: row.paymentId || undefined,
            orderId: row.orderId || undefined,
            sellerName: vendorName || 'NearHub',
            sellerCity: vendorCity || '',
            sellerGstin: vendorGST || '',
            storedAt: row.createdAt,
            invoiceHtmlUrl: `/api/invoices/${encodeURIComponent(row.invoiceNumber)}/view`,
            invoiceDownloadUrl: `/api/invoices/${encodeURIComponent(row.invoiceNumber)}/download`,
            rawInvoiceData: parsedInvoiceData,
          };
        }),
      });
    } catch (error) {
      console.error('[Invoices] Error fetching user invoices:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch invoices',
      });
    }
  });

  /**
   * POST /api/invoices/sample
   * Generate a sample invoice for testing
   */
  app.post('/api/invoices/sample', async (req: Request, res: Response) => {
    try {
      const invoiceService = new InvoiceService(invoiceConfig);

      const sampleInvoice = invoiceService.createInvoice(
        'Acme Corporation',
        'contact@acme.com',
        '+91 98765 43210',
        [
          {
            description: 'Listing Premium Subscription - 90 Days',
            quantity: 1,
            unitPrice: 8910,
            amount: 8910,
          },
          {
            description: 'Feature Enhancement Package',
            quantity: 1,
            unitPrice: 2000,
            amount: 2000,
          },
        ],
        {
          customerAddress: '123 Business Street',
          customerCity: 'Mumbai',
          customerState: 'Maharashtra',
          customerPincode: '400001',
          customerGST: '27AABCU1234G1Z0',
          paymentMethod: 'Razorpay',
          orderId: 'order_MIV1OmC3CJMhRy',
          paymentId: 'pay_MIV1POCOCCHblI',
        }
      );

      return res.json({
        success: true,
        message: 'Sample invoice generated',
        data: sampleInvoice,
        htmlUrl: `/api/invoices/${sampleInvoice.invoiceNumber}/view?data=${encodeURIComponent(JSON.stringify(sampleInvoice))}`,
      });
    } catch (error) {
      console.error('[Invoices] Error generating sample invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate sample invoice',
      });
    }
  });
}
