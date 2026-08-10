import type { FormEvent, ReactNode } from 'react';
import AdminDrawer from './AdminDrawer';

type AdminListingModalFrameProps = {
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

export function AdminListingModalFrame({
  onClose,
  onSubmit,
  header,
  children,
  footer,
}: AdminListingModalFrameProps) {
  return (
    <AdminDrawer
      onClose={onClose}
      onSubmit={onSubmit}
      header={header}
      footer={footer}
      ariaLabel="Listing form"
    >
      {children}
    </AdminDrawer>
  );
}
