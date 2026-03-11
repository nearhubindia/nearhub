/**
 * Shared constants & sample data for Admin dashboard
 */

import type { Listing } from '../types/admin-types';
import { getApiUrl as getSharedApiUrl } from '@/lib/config';

export const chartData = [
  { name: 'Jan', users: 400, listings: 240 },
  { name: 'Feb', users: 600, listings: 380 },
  { name: 'Mar', users: 800, listings: 450 },
  { name: 'Apr', users: 1000, listings: 620 },
  { name: 'May', users: 1200, listings: 800 },
  { name: 'Jun', users: 1450, listings: 950 },
];

export const categoryData = [
  { name: 'Electronics', value: 25 },
  { name: 'Services', value: 20 },
  { name: 'Real Estate', value: 18 },
  { name: 'Vehicles', value: 15 },
  { name: 'Jobs', value: 12 },
  { name: 'Other', value: 10 },
];

export const COLORS = ['#0D9488', '#0F766E', '#065F56', '#1a5f54', '#186d60', '#1a7a6c'];

export const CATEGORY_MAP: Record<string, { id: number; icon: string }> = {
  Electronics: { id: 1, icon: '📱' },
  Vehicles: { id: 2, icon: '🚗' },
  'Real Estate': { id: 3, icon: '🏠' },
  Services: { id: 4, icon: '🛠️' },
  Jobs: { id: 5, icon: '💼' },
  Fashion: { id: 6, icon: '👕' },
  'Home & Garden': { id: 7, icon: '🏡' },
  Sports: { id: 8, icon: '⚽' },
  Books: { id: 9, icon: '📚' },
  Pets: { id: 10, icon: '🐾' },
  Food: { id: 11, icon: '🍕' },
  Other: { id: 12, icon: '📦' },
};

export function getApiUrl(): string {
  return getSharedApiUrl();
}

export function getAdminToken(): string | null {
  return localStorage.getItem('adminToken');
}

/**
 * Sample folder structure for listings
 */
export const folderStructure = [
  {
    id: 1,
    name: 'Electronics',
    icon: '📱',
    listingsCount: 15,
    listings: [] as Listing[],
  },
  {
    id: 2,
    name: 'Vehicles',
    icon: '🚗',
    listingsCount: 8,
    listings: [] as Listing[],
  },
  {
    id: 3,
    name: 'Real Estate',
    icon: '🏠',
    listingsCount: 12,
    listings: [] as Listing[],
  },
  {
    id: 4,
    name: 'Services',
    icon: '🛠️',
    listingsCount: 10,
    listings: [] as Listing[],
  },
];

/**
 * Sample users data
 */
export const sampleUsers = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+91-9876543210',
    listings: 12,
    status: 'active' as const,
    joined: '2023-01-15',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+91-9876543211',
    listings: 8,
    status: 'active' as const,
    joined: '2023-02-20',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    phone: '+91-9876543212',
    listings: 5,
    status: 'suspended' as const,
    joined: '2023-03-10',
  },
  {
    id: 4,
    name: 'Alice Brown',
    email: 'alice@example.com',
    phone: '+91-9876543213',
    listings: 20,
    status: 'active' as const,
    joined: '2023-04-05',
  },
];
