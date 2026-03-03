/**
 * Invoice Storage Utility
 * Handles loading, saving, and managing invoices in AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const INVOICES_STORAGE_KEY = '@nearhub_invoices';

export interface StoredInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  total: number;
  status: string;
  paymentId?: string;
  orderId?: string;
  gstAmount?: number;
  subTotal?: number;
  storedAt?: string;
}

/**
 * Store an invoice in AsyncStorage
 */
export async function storeInvoice(invoice: StoredInvoice): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(INVOICES_STORAGE_KEY);
    const invoices: StoredInvoice[] = stored ? JSON.parse(stored) : [];

    // Add storedAt timestamp if not present
    const invoiceToStore = {
      ...invoice,
      storedAt: invoice.storedAt || new Date().toISOString(),
    };

    // Check if invoice already exists (by invoiceNumber)
    const existingIndex = invoices.findIndex((i) => i.invoiceNumber === invoice.invoiceNumber);
    if (existingIndex >= 0) {
      invoices[existingIndex] = invoiceToStore;
    } else {
      invoices.push(invoiceToStore);
    }

    // Sort by date descending
    invoices.sort(
      (a, b) =>
        new Date(b.storedAt || b.invoiceDate).getTime() -
        new Date(a.storedAt || a.invoiceDate).getTime()
    );

    await AsyncStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
    console.log('[InvoiceStorage] Invoice stored:', invoice.invoiceNumber);
  } catch (error) {
    console.error('[InvoiceStorage] Error storing invoice:', error);
    throw error;
  }
}

/**
 * Get all stored invoices
 */
export async function getStoredInvoices(): Promise<StoredInvoice[]> {
  try {
    const stored = await AsyncStorage.getItem(INVOICES_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const invoices = JSON.parse(stored) as StoredInvoice[];
    // Sort by date descending
    return invoices.sort(
      (a, b) =>
        new Date(b.storedAt || b.invoiceDate).getTime() -
        new Date(a.storedAt || a.invoiceDate).getTime()
    );
  } catch (error) {
    console.error('[InvoiceStorage] Error retrieving invoices:', error);
    return [];
  }
}

/**
 * Get a single invoice by invoice number
 */
export async function getInvoiceByNumber(invoiceNumber: string): Promise<StoredInvoice | null> {
  try {
    const invoices = await getStoredInvoices();
    return invoices.find((i) => i.invoiceNumber === invoiceNumber) || null;
  } catch (error) {
    console.error('[InvoiceStorage] Error getting invoice:', error);
    return null;
  }
}

/**
 * Delete an invoice by invoice number
 */
export async function deleteInvoice(invoiceNumber: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(INVOICES_STORAGE_KEY);
    if (!stored) return;

    const invoices: StoredInvoice[] = JSON.parse(stored);
    const filtered = invoices.filter((i) => i.invoiceNumber !== invoiceNumber);
    await AsyncStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(filtered));
    console.log('[InvoiceStorage] Invoice deleted:', invoiceNumber);
  } catch (error) {
    console.error('[InvoiceStorage] Error deleting invoice:', error);
    throw error;
  }
}

/**
 * Extract invoice data from verification response
 */
export function extractInvoiceFromResponse(verifyResponse: any): StoredInvoice | null {
  if (!verifyResponse.invoice) {
    return null;
  }

  const invoice = verifyResponse.invoice;
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    customerName: invoice.customerName,
    total: invoice.total,
    status: 'paid',
    paymentId: verifyResponse.paymentId,
    orderId: verifyResponse.orderId,
    gstAmount: invoice.gstAmount,
    subTotal: invoice.subTotal,
  };
}
