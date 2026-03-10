/**
 * Invoice Generation Service
 * Handles tax invoice generation for subscriptions
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  // Vendor (Synvide Business Solutions)
  vendorName: string;
  vendorAddress: string;
  vendorCity: string;
  vendorState: string;
  vendorPincode: string;
  vendorGST: string;
  vendorEmail: string;
  vendorPhone: string;

  // Customer
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPincode?: string;
  customerGST?: string;

  // Invoice Details
  items: InvoiceItem[];
  subtotal: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;

  // Payment Details
  paymentMethod?: string;
  paymentId?: string;
  orderId?: string;

  // Additional Info
  notes?: string;
  terms?: string;
}

export interface InvoiceConfig {
  gstRate: number; // e.g., 18 for 18% GST
  isInterState: boolean; // If true, use IGST; if false, use SGST+CGST
  vendorName: string;
  vendorAddress: string;
  vendorCity: string;
  vendorState: string;
  vendorPincode: string;
  vendorGST: string;
  vendorEmail: string;
  vendorPhone: string;
}

class InvoiceService {
  private config: InvoiceConfig;

  constructor(config: InvoiceConfig) {
    this.config = config;
  }

  /**
   * Generate a unique invoice number
   * Format: INV-YYYY-MM-DD-XXXXX
   */
  generateInvoiceNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const randomNum = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `INV-${dateStr}-${randomNum}`;
  }

  /**
   * Calculate tax amounts
   */
  calculateTaxes(subtotal: number): { sgst: number; cgst: number; igst: number } {
    const gstAmount = (subtotal * this.config.gstRate) / 100;

    if (this.config.isInterState) {
      // For inter-state: IGST only
      return {
        sgst: 0,
        cgst: 0,
        igst: parseFloat(gstAmount.toFixed(2)),
      };
    } else {
      // For intra-state: SGST + CGST (each 50% of GST)
      const halfGst = gstAmount / 2;
      return {
        sgst: parseFloat(halfGst.toFixed(2)),
        cgst: parseFloat(halfGst.toFixed(2)),
        igst: 0,
      };
    }
  }

  /**
   * Create an invoice
   */
  createInvoice(
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    items: InvoiceItem[],
    options?: {
      customerAddress?: string;
      customerCity?: string;
      customerState?: string;
      customerPincode?: string;
      customerGST?: string;
      paymentMethod?: string;
      paymentId?: string;
      orderId?: string;
      notes?: string;
      isInterState?: boolean;
    }
  ): InvoiceData {
    // Calculate subtotal
    const subtotal = parseFloat(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));

    // Determine if inter-state
    const isInterState: boolean =
      options?.isInterState ??
      (options?.customerState ? options.customerState !== this.config.vendorState : false);

    // Calculate taxes
    const taxConfig: InvoiceConfig = {
      ...this.config,
      isInterState,
    };
    const taxService = new InvoiceService(taxConfig);
    const taxes = taxService.calculateTaxes(subtotal);

    // Calculate total
    const total = parseFloat((subtotal + taxes.sgst + taxes.cgst + taxes.igst).toFixed(2));

    // Generate invoice number and dates
    const invoiceNumber = this.generateInvoiceNumber();
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = this.addDays(new Date(), 7).toISOString().split('T')[0];

    return {
      invoiceNumber,
      invoiceDate,
      dueDate,

      vendorName: this.config.vendorName,
      vendorAddress: this.config.vendorAddress,
      vendorCity: this.config.vendorCity,
      vendorState: this.config.vendorState,
      vendorPincode: this.config.vendorPincode,
      vendorGST: this.config.vendorGST,
      vendorEmail: this.config.vendorEmail,
      vendorPhone: this.config.vendorPhone,

      customerName,
      customerEmail,
      customerPhone,
      customerAddress: options?.customerAddress,
      customerCity: options?.customerCity,
      customerState: options?.customerState,
      customerPincode: options?.customerPincode,
      customerGST: options?.customerGST,

      items,
      subtotal,
      sgst: taxes.sgst,
      cgst: taxes.cgst,
      igst: taxes.igst,
      total,

      paymentMethod: options?.paymentMethod,
      paymentId: options?.paymentId,
      orderId: options?.orderId,
      notes: options?.notes,
      terms: 'Payment must be made within 7 days of invoice date.',
    };
  }

  /**
   * Format invoice data for JSON response
   */
  formatInvoiceJSON(invoice: InvoiceData): string {
    return JSON.stringify(invoice, null, 2);
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Create HTML representation of invoice
   */
  createInvoiceHTML(invoice: InvoiceData): string {
    const itemsHTML = invoice.items
      .map(
        (item) => `
      <tr>
        <td class="item-desc">${item.description}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${this.formatCurrency(item.unitPrice)}</td>
        <td class="right">${this.formatCurrency(item.amount)}</td>
      </tr>
    `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background-color: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 3px solid #0D9488;
      padding-bottom: 20px;
    }
    .company-info h1 {
      margin: 0;
      color: #0D9488;
      font-size: 28px;
    }
    .company-info p {
      margin: 4px 0;
      color: #666;
      font-size: 12px;
    }
    .invoice-number {
      text-align: right;
    }
    .invoice-number h2 {
      margin: 0;
      color: #333;
      font-size: 24px;
    }
    .invoice-number p {
      margin: 4px 0;
      color: #666;
      font-size: 12px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      background-color: #F0F9FF;
      padding: 10px;
      font-weight: bold;
      color: #0D9488;
      margin-bottom: 10px;
      border-left: 4px solid #0D9488;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    .info-block {
      font-size: 12px;
      line-height: 1.6;
    }
    .info-block p {
      margin: 3px 0;
    }
    .info-label {
      font-weight: bold;
      color: #333;
    }
    .info-value {
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background-color: #E0F2FE;
      color: #0D9488;
      padding: 12px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid #0D9488;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
    }
    tr:hover {
      background-color: #F9FAFB;
    }
    .item-desc {
      width: 50%;
    }
    .center {
      text-align: center;
    }
    .right {
      text-align: right;
    }
    .summary {
      margin-top: 20px;
      border-top: 2px solid #0D9488;
      padding-top: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .summary-label {
      min-width: 150px;
      text-align: right;
      padding-right: 20px;
      font-weight: 500;
      color: #333;
    }
    .summary-value {
      min-width: 100px;
      text-align: right;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: bold;
      color: #0D9488;
      padding-top: 10px;
      border-top: 2px solid #0D9488;
    }
    .total-label {
      min-width: 150px;
      text-align: right;
      padding-right: 20px;
    }
    .total-value {
      min-width: 100px;
      text-align: right;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 11px;
    }
    .footer p {
      margin: 5px 0;
    }
    .print-button {
      display: none;
    }
    @media print {
      body {
        background-color: white;
        padding: 0;
      }
      .invoice-container {
        box-shadow: none;
        padding: 0;
      }
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${invoice.vendorName}</h1>
        <p>${invoice.vendorAddress}, ${invoice.vendorCity}</p>
        <p>${invoice.vendorState} - ${invoice.vendorPincode}</p>
        <p>GST: ${invoice.vendorGST}</p>
        <p>✉️ ${invoice.vendorEmail}</p>
        <p>📞 ${invoice.vendorPhone}</p>
      </div>
      <div class="invoice-number">
        <h2>TAX INVOICE</h2>
        <p><strong>${invoice.invoiceNumber}</strong></p>
        <p>Date: ${invoice.invoiceDate}</p>
        <p>Due Date: ${invoice.dueDate}</p>
      </div>
    </div>

    <div class="section">
      <div class="info-grid">
        <div>
          <p class="section-title">Bill To (Customer)</p>
          <div class="info-block">
            <p><span class="info-label">Name:</span> <span class="info-value">${invoice.customerName}</span></p>
            ${invoice.customerAddress ? `<p><span class="info-value">${invoice.customerAddress}</span></p>` : ''}
            ${invoice.customerCity ? `<p><span class="info-value">${invoice.customerCity}, ${invoice.customerState} ${invoice.customerPincode}</span></p>` : ''}
            <p><span class="info-label">Email:</span> <span class="info-value">${invoice.customerEmail}</span></p>
            <p><span class="info-label">Phone:</span> <span class="info-value">${invoice.customerPhone}</span></p>
            ${invoice.customerGST ? `<p><span class="info-label">GST:</span> <span class="info-value">${invoice.customerGST}</span></p>` : ''}
          </div>
        </div>
        <div>
          <p class="section-title">Order Details</p>
          <div class="info-block">
            ${invoice.orderId ? `<p><span class="info-label">Order ID:</span> <span class="info-value">${invoice.orderId}</span></p>` : ''}
            ${invoice.paymentId ? `<p><span class="info-label">Payment ID:</span> <span class="info-value">${invoice.paymentId}</span></p>` : ''}
            ${invoice.paymentMethod ? `<p><span class="info-label">Payment Method:</span> <span class="info-value">${invoice.paymentMethod}</span></p>` : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="width: 10%">Qty</th>
            <th style="width: 15%">Unit Price</th>
            <th style="width: 15%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <div class="summary">
      <div class="summary-row">
        <div class="summary-label">Subtotal:</div>
        <div class="summary-value">${this.formatCurrency(invoice.subtotal)}</div>
      </div>
      
      ${
        invoice.sgst > 0
          ? `
      <div class="summary-row">
        <div class="summary-label">SGST (${this.config.gstRate / 2}%):</div>
        <div class="summary-value">${this.formatCurrency(invoice.sgst)}</div>
      </div>
      `
          : ''
      }
      
      ${
        invoice.cgst > 0
          ? `
      <div class="summary-row">
        <div class="summary-label">CGST (${this.config.gstRate / 2}%):</div>
        <div class="summary-value">${this.formatCurrency(invoice.cgst)}</div>
      </div>
      `
          : ''
      }
      
      ${
        invoice.igst > 0
          ? `
      <div class="summary-row">
        <div class="summary-label">IGST (${this.config.gstRate}%):</div>
        <div class="summary-value">${this.formatCurrency(invoice.igst)}</div>
      </div>
      `
          : ''
      }

      <div class="total-row">
        <div class="total-label">TOTAL:</div>
        <div class="total-value">${this.formatCurrency(invoice.total)}</div>
      </div>
    </div>

    ${
      invoice.notes
        ? `
    <div class="section">
      <p class="section-title">Notes</p>
      <p>${invoice.notes}</p>
    </div>
    `
        : ''
    }

    ${
      invoice.terms
        ? `
    <div class="section">
      <p class="section-title">Terms & Conditions</p>
      <p>${invoice.terms}</p>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p><strong>Payment Terms:</strong> ${invoice.terms || 'Net 7 days'}</p>
      <p><strong>Thank you for your business!</strong></p>
      <p style="margin-top: 20px; color: #999;">This is a computer-generated invoice. No signature required.</p>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Optional: auto-trigger print dialog
      // window.print();
    });
  </script>
</body>
</html>
    `;

    return html;
  }

  /**
   * Helper function to add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Create invoice configuration for Synvide Business Solutions
   */
  static createSynvideConfig(): InvoiceConfig {
    return {
      gstRate: 18,
      isInterState: false,
      vendorName: 'Synvide Business Solutions Private Limited',
      vendorAddress: 'KR Puram',
      vendorCity: 'Bangalore',
      vendorState: 'Karnataka',
      vendorPincode: '560036',
      vendorGST: '29ABKCS0463R1ZI',
      vendorEmail: 'info@synvide.com',
      vendorPhone: '+91 XXXXXXXXXX',
    };
  }
}

export default InvoiceService;
