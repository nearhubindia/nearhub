/**
 * Tax Invoice Routes
 * Generates and manages tax invoices for subscriptions
 */

import type { Express, Request, Response } from 'express';
import InvoiceService, { InvoiceItem, InvoiceData } from '../services/invoice';

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
      // Temporary: For demo, we'll accept invoice data as query parameter
      // In production, this would be fetched from database
      const invoiceJson = req.query.data as string;

      if (!invoiceJson) {
        return res.status(400).json({
          success: false,
          error: "Invoice data required. Pass invoice JSON as 'data' query parameter.",
          example: 'GET /api/invoices/INV-2026-02-16-XXXXX/view?data={...invoiceJSON}',
        });
      }

      const invoice: InvoiceData = JSON.parse(decodeURIComponent(invoiceJson));
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
      const invoiceJson = req.query.data as string;

      if (!invoiceJson) {
        return res.status(400).json({
          success: false,
          error: 'Invoice data required',
        });
      }

      const invoice: InvoiceData = JSON.parse(decodeURIComponent(invoiceJson));
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
