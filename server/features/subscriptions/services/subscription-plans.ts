/**
 * Subscription Plans Service
 * Manages subscription plans with customizable features
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SubscriptionPlan {
  id: string;
  name: string;
  type: 'image' | 'video' | 'general';
  price: number;
  offerPrice?: number; // Discounted price, if any
  days: number;
  features: {
    maxListings: number;
    topSearchPlacement: boolean;
    featuredBadge: boolean;
    verifiedBadge: boolean;
    priorityListing: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
  highlight: boolean; // Is it the "most popular" plan?
  createdAt: Date;
  updatedAt: Date;
}

const PLANS_FILE = path.join(__dirname, '../data/subscription-plans.json');

// Ensure data directory exists
const dataDir = path.dirname(PLANS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default plans
const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'image-basic',
    name: 'Image Basic',
    type: 'image',
    price: 99,
    days: 30,
    features: {
      maxListings: 5,
      topSearchPlacement: false,
      featuredBadge: false,
      verifiedBadge: false,
      priorityListing: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
    highlight: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'image-standard',
    name: 'Image Standard',
    type: 'image',
    price: 199,
    days: 30,
    features: {
      maxListings: 25,
      topSearchPlacement: false,
      featuredBadge: true,
      verifiedBadge: false,
      priorityListing: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
    highlight: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'image-premium',
    name: 'Image Premium',
    type: 'image',
    price: 399,
    days: 30,
    features: {
      maxListings: -1, // Unlimited
      topSearchPlacement: true,
      featuredBadge: true,
      verifiedBadge: true,
      priorityListing: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
    highlight: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'video-basic',
    name: 'Video Basic',
    type: 'video',
    price: 199,
    days: 30,
    features: {
      maxListings: 3,
      topSearchPlacement: false,
      featuredBadge: false,
      verifiedBadge: false,
      priorityListing: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
    highlight: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'video-standard',
    name: 'Video Standard',
    type: 'video',
    price: 399,
    days: 30,
    features: {
      maxListings: 10,
      topSearchPlacement: false,
      featuredBadge: true,
      verifiedBadge: false,
      priorityListing: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
    highlight: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'video-premium',
    name: 'Video Premium',
    type: 'video',
    price: 799,
    days: 30,
    features: {
      maxListings: -1, // Unlimited
      topSearchPlacement: true,
      featuredBadge: true,
      verifiedBadge: true,
      priorityListing: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
    highlight: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let plansCache: SubscriptionPlan[] | null = null;

function loadPlans(): SubscriptionPlan[] {
  if (plansCache) {
    return plansCache;
  }

  try {
    if (fs.existsSync(PLANS_FILE)) {
      const data = fs.readFileSync(PLANS_FILE, 'utf-8');
      plansCache = JSON.parse(data) as SubscriptionPlan[];
      return plansCache;
    }
  } catch (error) {
    console.error('[Plans] Error loading plans:', error);
  }

  // Initialize with default plans
  plansCache = DEFAULT_PLANS;
  savePlans(DEFAULT_PLANS);
  return DEFAULT_PLANS;
}

function savePlans(plans: SubscriptionPlan[]): void {
  try {
    fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf-8');
    plansCache = plans;
  } catch (error) {
    console.error('[Plans] Error saving plans:', error);
    throw error;
  }
}

export function getAllPlans(): SubscriptionPlan[] {
  return loadPlans();
}

export function getPlansByType(type: 'image' | 'video' | 'general'): SubscriptionPlan[] {
  const plans = loadPlans();
  return plans.filter((p) => p.type === type);
}

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return loadPlans().find((p) => p.id === id);
}

export function createPlan(
  plan: Omit<SubscriptionPlan, 'createdAt' | 'updatedAt' | 'id'>
): SubscriptionPlan {
  const plans = loadPlans();
  const newPlan: SubscriptionPlan = {
    ...plan,
    id: `${plan.type}-${plan.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  plans.push(newPlan);
  savePlans(plans);
  return newPlan;
}

export function updatePlan(
  id: string,
  updates: Partial<SubscriptionPlan>
): SubscriptionPlan | undefined {
  const plans = loadPlans();
  const index = plans.findIndex((p) => p.id === id);

  if (index === -1) {
    return undefined;
  }

  const updatedPlan: SubscriptionPlan = {
    ...plans[index],
    ...updates,
    id: plans[index].id, // Don't allow ID changes
    createdAt: plans[index].createdAt, // Don't allow creation date changes
    updatedAt: new Date(),
  };

  // Ensure only one plan is highlighted per type
  if (updatedPlan.highlight) {
    plans.forEach((p) => {
      if (p.id !== id && p.type === updatedPlan.type) {
        p.highlight = false;
      }
    });
  }

  plans[index] = updatedPlan;
  savePlans(plans);
  return updatedPlan;
}

export function deletePlan(id: string): boolean {
  const plans = loadPlans();
  const index = plans.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  plans.splice(index, 1);
  savePlans(plans);
  return true;
}

export function clearPlansCache(): void {
  plansCache = null;
}
