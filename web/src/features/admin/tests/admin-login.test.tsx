import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLogin from '../pages/AdminLogin';

describe('AdminLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows API validation errors and supports password visibility', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        json: async () => ({ success: false, message: 'Invalid credentials' }),
      })
    );
    const user = userEvent.setup();
    render(<AdminLogin />);

    const password = screen.getByPlaceholderText('••••••••');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.type(password, 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('shows a retry message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<AdminLogin />);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign In' }).closest('form')!);
    await waitFor(() =>
      expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument()
    );
  });
});
