import type { Request } from 'express';

type OpenApiSpec = Record<string, unknown>;

function getBaseUrl(req?: Request): string {
  if (!req) return process.env.PUBLIC_API_BASE_URL || 'http://localhost:5000';
  const forwardedProto = req.header('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol || 'http';
  const forwardedHost = req.header('x-forwarded-host');
  const host = forwardedHost || req.get('host') || 'localhost:5000';
  return `${protocol}://${host}`;
}

export function buildOpenApiSpec(req?: Request): OpenApiSpec {
  const baseUrl = getBaseUrl(req);

  return {
    openapi: '3.0.3',
    info: {
      title: 'NearHub Backend API',
      version: '1.0.0',
      description:
        'NearHub backend APIs for authentication, listings, subscriptions, upgrades, coupons, and admin operations.',
    },
    servers: [
      {
        url: baseUrl,
        description: 'Current server',
      },
    ],
    tags: [
      { name: 'Health' },
      { name: 'Auth' },
      { name: 'Listings' },
      { name: 'Subscriptions' },
      { name: 'Upgrade' },
      { name: 'Contact' },
      { name: 'Admin' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        userIdHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-user-id',
          description: 'User identity header used by mobile app/server APIs.',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'OK' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Something went wrong' },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Service healthy',
            },
          },
        },
      },
      '/api/auth/send-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Send OTP to phone',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    phone: { type: 'string', example: '+919999999999' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'OTP sent' },
            '400': { description: 'Invalid payload' },
          },
        },
      },
      '/api/auth/verify-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Verify OTP and authenticate user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone', 'otp'],
                  properties: {
                    phone: { type: 'string', example: '+919999999999' },
                    otp: { type: 'string', example: '123456' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'OTP verified' },
            '401': { description: 'Invalid OTP' },
          },
        },
      },
      '/api/listings': {
        get: {
          tags: ['Listings'],
          summary: 'Get listings',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'minPrice', in: 'query', schema: { type: 'number' } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          ],
          responses: {
            '200': { description: 'Listings fetched' },
          },
        },
      },
      '/api/subscriptions': {
        get: {
          tags: ['Subscriptions'],
          summary: 'Get user subscriptions',
          security: [{ userIdHeader: [] }],
          responses: {
            '200': { description: 'Subscriptions fetched' },
            '401': { description: 'Authentication required' },
          },
        },
        post: {
          tags: ['Subscriptions'],
          summary: 'Create subscription',
          security: [{ userIdHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tierId'],
                  properties: {
                    tierId: { type: 'string' },
                    duration: { type: 'integer', example: 30 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Subscription created' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/subscriptions/upgrade-listing/checkout': {
        post: {
          tags: ['Upgrade'],
          summary: 'Create Razorpay order for listing upgrade',
          security: [{ userIdHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['listingId', 'duration', 'price'],
                  properties: {
                    listingId: { type: 'string' },
                    duration: { type: 'integer', enum: [45, 90, 180] },
                    price: { type: 'number', example: 99 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Checkout order created' },
            '400': { description: 'Validation error' },
            '401': { description: 'Authentication required' },
            '404': { description: 'Listing not found' },
          },
        },
      },
      '/api/subscriptions/upgrade-listing/verify-payment': {
        post: {
          tags: ['Upgrade'],
          summary: 'Verify payment and upgrade listing',
          security: [{ userIdHeader: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'listingId',
                    'duration',
                    'price',
                    'razorpay_order_id',
                    'razorpay_payment_id',
                    'razorpay_signature',
                  ],
                  properties: {
                    listingId: { type: 'string' },
                    duration: { type: 'integer', enum: [45, 90, 180] },
                    price: { type: 'number', example: 99 },
                    razorpay_order_id: { type: 'string' },
                    razorpay_payment_id: { type: 'string' },
                    razorpay_signature: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Listing upgraded' },
            '400': { description: 'Payment verification failed / invalid payload' },
            '401': { description: 'Authentication required' },
            '404': { description: 'Listing not found' },
          },
        },
      },
      '/api/contact': {
        post: {
          tags: ['Contact'],
          summary: 'Submit contact form',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'subject', 'message'],
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    subject: { type: 'string' },
                    message: { type: 'string' },
                    source: { type: 'string', example: 'web' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Submission saved' },
            '400': { description: 'Validation error' },
          },
        },
      },
      '/api/admin/listings': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin listings',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'userId', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Admin listings fetched' },
            '401': { description: 'Authentication required' },
          },
        },
        post: {
          tags: ['Admin'],
          summary: 'Create listing (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '201': { description: 'Listing created' },
            '400': { description: 'Validation error' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/listings/{id}': {
        get: {
          tags: ['Admin'],
          summary: 'Get listing by ID (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Listing fetched' },
            '404': { description: 'Listing not found' },
            '401': { description: 'Authentication required' },
          },
        },
        patch: {
          tags: ['Admin'],
          summary: 'Update listing (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Listing updated' },
            '404': { description: 'Listing not found' },
            '401': { description: 'Authentication required' },
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete listing (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Listing deleted' },
            '404': { description: 'Listing not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/listings/{id}/toggle-status': {
        patch: {
          tags: ['Admin'],
          summary: 'Toggle listing status (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Status toggled' },
            '404': { description: 'Listing not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'Get users (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Users fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/users/{id}': {
        get: {
          tags: ['Admin'],
          summary: 'Get user by ID (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'User fetched' },
            '404': { description: 'User not found' },
            '401': { description: 'Authentication required' },
          },
        },
        put: {
          tags: ['Admin'],
          summary: 'Update user (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'User updated' },
            '404': { description: 'User not found' },
            '401': { description: 'Authentication required' },
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete user (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'User deleted' },
            '404': { description: 'User not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/contact-submissions': {
        get: {
          tags: ['Admin'],
          summary: 'Get contact submissions (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
          responses: {
            '200': { description: 'Submissions fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/contact-submissions/{id}': {
        patch: {
          tags: ['Admin'],
          summary: 'Update contact submission (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Submission updated' },
            '404': { description: 'Submission not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/contact-submissions/{id}/comments': {
        post: {
          tags: ['Admin'],
          summary: 'Add submission comment (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '201': { description: 'Comment created' },
            '404': { description: 'Submission not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/contact-submissions/{id}/comments/{commentId}': {
        patch: {
          tags: ['Admin'],
          summary: 'Edit submission comment (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'commentId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Comment updated' },
            '404': { description: 'Comment not found' },
            '401': { description: 'Authentication required' },
          },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete submission comment (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'commentId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Comment deleted' },
            '404': { description: 'Comment not found' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/reports/growth': {
        get: {
          tags: ['Admin'],
          summary: 'Growth report (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Growth report fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/reports/performance': {
        get: {
          tags: ['Admin'],
          summary: 'Performance report (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Performance report fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/reports/transaction': {
        get: {
          tags: ['Admin'],
          summary: 'Transaction report (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Transaction report fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/admin/reports/moderation': {
        get: {
          tags: ['Admin'],
          summary: 'Moderation report (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Moderation report fetched' },
            '401': { description: 'Authentication required' },
          },
        },
      },
    },
  };
}
