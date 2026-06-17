import { useMemo, useState, type ReactElement } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download } from 'lucide-react';
import { LandingHeader, LandingFooter } from '@/shared/components';
import { getApiUrl } from '@/lib/config';
import { readStoredWebUser, type StoredWebUser } from '@/lib/web-auth-storage';
import { buildAuthRegisterPath } from '@/lib/auth-redirect';

type StoredUser = StoredWebUser;

type InvoiceItem = {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  total: number;
  status: string;
  paymentId?: string;
  orderId?: string;
  sellerName?: string;
  sellerCity?: string;
  sellerGstin?: string;
  storedAt?: string;
  invoiceHtmlUrl?: string;
  invoiceDownloadUrl?: string;
};

type InvoicesResponse = {
  success?: boolean;
  invoices?: InvoiceItem[];
  error?: string;
};

const LOCAL_HIDE_KEY = 'nearhub_web_deleted_invoice_ids';

function readHiddenInvoices(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_HIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeHiddenInvoices(values: string[]) {
  localStorage.setItem(LOCAL_HIDE_KEY, JSON.stringify(values));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

export default function InvoicesPage(): ReactElement {
  const location = useLocation();
  const user = readStoredWebUser() as StoredUser | null;
  const userId = String(user?.id || '').trim();
  const userPhone = String(user?.phone || '').trim();
  const [hiddenInvoiceIds, setHiddenInvoiceIds] = useState<string[]>(() => readHiddenInvoices());

  const invoicesQuery = useQuery({
    queryKey: ['user-invoices', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${getApiUrl()}/api/users/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-phone': userPhone,
        },
      });
      const payload = (await response.json()) as InvoicesResponse;
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Failed to load invoices');
      return payload.invoices || [];
    },
  });

  const invoices = useMemo(
    () =>
      (invoicesQuery.data || []).filter((item) => !hiddenInvoiceIds.includes(item.invoiceNumber)),
    [hiddenInvoiceIds, invoicesQuery.data]
  );

  const hideInvoice = (invoiceNumber: string) => {
    const next = [...hiddenInvoiceIds, invoiceNumber];
    setHiddenInvoiceIds(next);
    writeHiddenInvoices(next);
  };

  if (!userId)
    return <Navigate to={buildAuthRegisterPath(location.pathname, location.search)} replace />;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffef8_0%,#eef6ff_58%,#f8fbff_100%)] text-slate-900">
      <LandingHeader active="browse" />
      <main className="w-full px-3 pb-14 pt-28 sm:px-4 lg:px-5">
        <section className="rounded-3xl border border-[#1e5da8]/15 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(30,93,168,0.68)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#113965]">Invoices</h1>
            <Link to="/browse" className="text-sm font-semibold text-[#1e5da8] hover:underline">
              Back to Browse
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">{invoices.length} invoice(s)</p>
        </section>

        <section className="mt-5 space-y-3">
          {invoicesQuery.isLoading ? <p className="text-slate-600">Loading invoices...</p> : null}
          {invoicesQuery.isError ? <p className="text-red-600">Failed to load invoices.</p> : null}

          {invoices.map((item) => (
            <article
              key={item.invoiceNumber}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Invoice #{item.invoiceNumber}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.customerName || 'Customer'} • {item.sellerName || 'NearHub'}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                  {item.status || 'issued'}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  Total:{' '}
                  <span className="font-semibold text-[#113965]">{formatCurrency(item.total)}</span>
                </p>
                <p>
                  Date:{' '}
                  {item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString('en-IN') : '-'}
                </p>
                <p>Payment ID: {item.paymentId || 'NA'}</p>
                <p>Order ID: {item.orderId || 'NA'}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                {item.invoiceHtmlUrl ? (
                  <a
                    href={`${getApiUrl()}${item.invoiceHtmlUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#1e5da8] hover:underline"
                  >
                    <FileText size={14} /> View
                  </a>
                ) : null}
                {item.invoiceDownloadUrl ? (
                  <a
                    href={`${getApiUrl()}${item.invoiceDownloadUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#ff7b00] hover:underline"
                  >
                    <Download size={14} /> Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => hideInvoice(item.invoiceNumber)}
                  className="text-sm font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}

          {!invoicesQuery.isLoading && invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-slate-600">
              No invoices found yet.
            </div>
          ) : null}
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
