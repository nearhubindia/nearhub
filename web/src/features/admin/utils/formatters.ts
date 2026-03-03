/**
 * Admin Feature Formatters
 * Utility functions for formatting data for display
 */

export const formatters = {
  /**
   * Format price with currency symbol
   */
  formatPrice(price: number | string): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(numPrice);
  },

  /**
   * Format date to readable format
   */
  formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  /**
   * Format date with time
   */
  formatDateTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  },

  /**
   * Format large numbers with K/M suffix
   */
  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  /**
   * Truncate text with ellipsis
   */
  truncateText(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  },

  /**
   * Format coupon code
   */
  formatCouponCode(code: string): string {
    return code.toUpperCase();
  },

  /**
   * Format status badge style
   */
  getStatusBadgeStyle(status: string): {
    bg: string;
    text: string;
  } {
    const styles: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800' },
      inactive: { bg: 'bg-red-100', text: 'text-red-800' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800' },
      suspended: { bg: 'bg-purple-100', text: 'text-purple-800' },
    };
    return styles[status] || { bg: 'bg-slate-100', text: 'text-slate-800' };
  },

  /**
   * Format listing status
   */
  getListingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending Approval',
      expired: 'Expired',
      deleted: 'Deleted',
    };
    return labels[status] || status;
  },

  /**
   * Format tier type
   */
  getTierTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      image: 'Image Listing',
      video: 'Video Listing',
      premium: 'Premium Tier',
      basic: 'Basic Tier',
    };
    return labels[type] || type;
  },
};

export default formatters;
