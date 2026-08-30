import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Indian Store E-Commerce REST API',
    version: '1.0.0',
    description: `
**Enterprise E-Commerce Backend API** built with Express, TypeScript, PostgreSQL, Redis, and Keycloak IAM.

### Authentication & Authorization
- **Bearer Token**: Standard JWT access token issued by Keycloak or Auth server.
- **Dev Mode Authentication**: When running locally (\`DEV_AUTH_BYPASS=true\`), pass \`Bearer dev-token\` or use headers \`x-mock-role\` (\`Admin\`, \`Manager\`, \`Operations\`, \`Delivery\`, \`Customer\`) and \`x-mock-email\` to test role-guarded endpoints instantly.
    `,
    contact: {
      name: 'Indian Store Tech Team',
      email: 'tech@indianstore.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:5001',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Health', description: 'System health & liveness checks' },
    { name: 'Notifications', description: 'Operations warehouse alerts, real-time SSE stream & staff notification center' },
    { name: 'Storefront', description: 'Homepage aggregates, top announcement bar & promotional hero banners' },
    { name: 'Categories', description: 'Admin & Catalog Category and Sub-Category hierarchy management' },
    { name: 'Products', description: 'Catalog browsing, search, and product management' },
    { name: 'Inventory', description: 'Warehouse stock levels, atomic adjustments & audit logs' },
    { name: 'Coupons', description: 'Promotional discount campaigns & cart validation' },
    { name: 'Orders', description: 'Atomic checkout with stock lock, order tracking & state machine' },
    { name: 'Payments', description: 'Razorpay payment intent creation & webhook listener' },
    { name: 'Reports', description: 'Executive sales, category revenue & fulfillment SLA metrics' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token in Authorization header: Bearer <token>',
      },
      MockRoleHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-mock-role',
        description: 'Optional role for dev bypass: Admin, Manager, Operations, Delivery, Customer',
      },
      MockEmailHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-mock-email',
        description: 'Optional user email for dev bypass',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'NOT_FOUND' },
          message: { type: 'string', example: 'Resource not found' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '98a2caef-e90b-4531-a51d-0db316715205' },
          name: { type: 'string', example: 'Atta, rice & grains' },
          slug: { type: 'string', example: 'atta-rice-grains' },
          icon: { type: 'string', example: 'grain' },
          display_order: { type: 'integer', example: 1 },
          products_count: { type: 'integer', example: 4 },
          created_at: { type: 'string', format: 'date-time', example: '2026-08-29T10:00:00Z' },
          sub_categories: {
            type: 'array',
            items: { $ref: '#/components/schemas/SubCategory' },
          },
        },
      },
      CreateCategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Spices & Seasonings' },
          slug: { type: 'string', example: 'spices-seasonings' },
          icon: { type: 'string', example: 'flare' },
          displayOrder: { type: 'integer', example: 11 },
        },
      },
      SubCategory: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'cf83861b-e2f4-4fcb-a591-acd1cd1a0844' },
          category_id: { type: 'string', format: 'uuid', example: '98a2caef-e90b-4531-a51d-0db316715205' },
          category_name: { type: 'string', example: 'Atta, rice & grains' },
          name: { type: 'string', example: 'Rice' },
          slug: { type: 'string', example: 'rice' },
          display_order: { type: 'integer', example: 1 },
          products_count: { type: 'integer', example: 2 },
          created_at: { type: 'string', format: 'date-time', example: '2026-08-29T10:00:00Z' },
        },
      },
      CreateSubCategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Whole Spices' },
          slug: { type: 'string', example: 'whole-spices' },
          displayOrder: { type: 'integer', example: 1 },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'p-101a' },
          sku: { type: 'string', example: 'SKU-RICE-01' },
          name: { type: 'string', example: 'India Gate Nur Jahan Biryani Basmati Rice (5kg)' },
          slug: { type: 'string', example: 'india-gate-nur-jahan-biryani-basmati-rice-5kg' },
          category: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'Category UUID' },
          sub_category: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', description: 'Sub-Category UUID' },
          category_name: { type: 'string', example: 'Atta, rice & grains' },
          sub_category_name: { type: 'string', example: 'Rice' },
          price: { type: 'number', example: 999.00 },
          original_price: { type: 'number', example: 1200.00 },
          rating: { type: 'number', example: 4.9 },
          reviews_count: { type: 'integer', example: 184 },
          image_url: { type: 'string', example: 'https://images.unsplash.com/photo-1586201375761-83865001e31c' },
          description: { type: 'string', example: 'Extra long grain premium biryani basmati rice with exquisite aroma.' },
          weight: { type: 'string', example: '5kg Bag' },
          stock: { type: 'integer', example: 65 },
          low_stock_threshold: { type: 'integer', example: 10 },
          is_organic: { type: 'boolean', example: false },
          is_bestseller: { type: 'boolean', example: true },
          origin_region: { type: 'string', example: 'Punjab, India' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['Basmati Rice', 'Biryani', 'Pantry'],
          },
        },
      },
      CreateProductInput: {
        type: 'object',
        required: ['name', 'price', 'imageUrl', 'description', 'weight'],
        properties: {
          id: { type: 'string', example: 'p-105' },
          sku: { type: 'string', example: 'RICE-BAS-005' },
          name: { type: 'string', example: 'Royal Basmati Rice 5kg' },
          slug: { type: 'string', example: 'royal-basmati-rice-5kg' },
          category: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', description: 'Category UUID' },
          subCategory: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', description: 'Sub-Category UUID' },
          price: { type: 'number', example: 499.00 },
          originalPrice: { type: 'number', example: 599.00 },
          rating: { type: 'number', example: 4.9 },
          reviewsCount: { type: 'integer', example: 80 },
          imageUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1586201375761-83865001e31c' },
          description: { type: 'string', example: 'Aged long-grain aromatic Royal Basmati rice.' },
          weight: { type: 'string', example: '5 kg' },
          stock: { type: 'integer', example: 50 },
          lowStockThreshold: { type: 'integer', example: 10 },
          isOrganic: { type: 'boolean', example: false },
          isBestseller: { type: 'boolean', example: true },
          originRegion: { type: 'string', example: 'Punjab' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['rice', 'basmati', 'staples'],
          },
        },
      },
      ProductDiscountInput: {
        type: 'object',
        properties: {
          originalPrice: { type: 'number', example: 1200.00, description: 'Original MRP before discount' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FLAT'], example: 'PERCENTAGE' },
          discountValue: { type: 'number', example: 15, description: 'Percentage (e.g. 15 for 15%) or flat amount (e.g. 100 for ₹100)' },
          price: { type: 'number', example: 1020.00, description: 'Optional explicit discounted selling price' },
        },
      },
      StockAdjustmentInput: {
        type: 'object',
        required: ['changeQty'],
        properties: {
          changeQty: { type: 'integer', example: 25, description: 'Positive to add stock, negative to deduct' },
          reason: { type: 'string', example: 'RESTOCK_SHIPMENT_RECEIVED' },
          referenceId: { type: 'string', example: 'PO-2026-091' },
        },
      },
      Coupon: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          code: { type: 'string', example: 'WELCOME50' },
          badge: { type: 'string', example: '50% OFF' },
          title: { type: 'string', example: 'Get 50% off up to ₹150 on your first order' },
          discount_type: { type: 'string', enum: ['PERCENTAGE', 'FLAT'], example: 'PERCENTAGE' },
          discount_value: { type: 'number', example: 50.00 },
          min_order_amount: { type: 'number', example: 299.00 },
          max_discount_cap: { type: 'number', example: 150.00 },
          valid_to: { type: 'string', format: 'date-time', example: '2026-12-31T23:59:59Z' },
        },
      },
      CouponValidationInput: {
        type: 'object',
        required: ['code', 'subtotal'],
        properties: {
          code: { type: 'string', example: 'DIWALI200' },
          subtotal: { type: 'number', example: 1250.00 },
          userEmail: { type: 'string', example: 'customer@example.com' },
        },
      },
      CreateCouponInput: {
        type: 'object',
        required: ['code', 'title', 'discountType', 'discountValue'],
        properties: {
          code: { type: 'string', example: 'FESTIVE100' },
          badge: { type: 'string', example: 'FLAT ₹100 OFF' },
          title: { type: 'string', example: 'Flat ₹100 discount on orders over ₹800' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FLAT'], example: 'FLAT' },
          discountValue: { type: 'number', example: 100 },
          minOrderAmount: { type: 'number', example: 800 },
          maxDiscountCap: { type: 'number', example: 100 },
          maxUsesTotal: { type: 'integer', example: 500 },
          maxUsesPerUser: { type: 'integer', example: 1 },
          validTo: { type: 'string', format: 'date-time', example: '2026-10-31T23:59:59Z' },
        },
      },
      OrderItemInput: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', example: 'p-1' },
          quantity: { type: 'integer', example: 2 },
        },
      },
      ShippingAddressInput: {
        type: 'object',
        required: ['fullName', 'phone', 'addressLine', 'city', 'state', 'pincode'],
        properties: {
          fullName: { type: 'string', example: 'Aarav Sharma' },
          phone: { type: 'string', example: '+919876543210' },
          email: { type: 'string', example: 'aarav@example.com' },
          addressLine: { type: 'string', example: 'Flat 402, Lotus Residency, Indiranagar' },
          city: { type: 'string', example: 'Bengaluru' },
          state: { type: 'string', example: 'Karnataka' },
          pincode: { type: 'string', example: '560038' },
        },
      },
      CheckoutInput: {
        type: 'object',
        required: ['items', 'shippingAddress'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemInput' },
          },
          shippingAddress: { $ref: '#/components/schemas/ShippingAddressInput' },
          couponCode: { type: 'string', example: 'WELCOME50' },
          paymentMethod: { type: 'string', enum: ['UPI', 'Card', 'COD', 'NetBanking'], example: 'UPI' },
        },
      },
      OrderStatusUpdateInput: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['Placed', 'In Packing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Cancelled'],
            example: 'In Packing',
          },
          notes: { type: 'string', example: 'Items packed in warehouse box #12' },
          assignedDeliveryAgent: { type: 'string', example: 'Ramesh Kumar (+919811122233)' },
        },
      },
      PaymentIntentInput: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', example: 'ORD-2026-4589' },
        },
      },
      PaymentWebhookInput: {
        type: 'object',
        required: ['orderId', 'status'],
        properties: {
          orderId: { type: 'string', example: 'ORD-2026-4589' },
          paymentId: { type: 'string', example: 'pay_Hk829J109s' },
          gatewayOrderId: { type: 'string', example: 'order_rzp_98124' },
          status: { type: 'string', enum: ['Captured', 'Authorized', 'Failed'], example: 'Captured' },
          signature: { type: 'string', example: 'mock_sha256_signature_string' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Service Health & Liveness Probe',
        description: 'Returns the operational status, timestamp, and version of the API.',
        responses: {
          '200': {
            description: 'API is running normally',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'UP' },
                    timestamp: { type: 'string', example: '2026-08-29T10:15:00.000Z' },
                    service: { type: 'string', example: 'Indian Store Backend API' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List Staff & Operations Notifications',
        description: 'Fetch paginated order fulfillment alerts, stock warnings, and operations notifications for the authenticated role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', default: 'Operations' }, description: 'Target role filter' },
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean' }, description: 'Filter only unread alerts' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['NEW_ORDER', 'LOW_STOCK', 'ORDER_CANCELLED', 'URGENT_SLA'] }, description: 'Notification type filter' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'List of staff notifications with unread count',
          },
        },
      },
    },
    '/api/v1/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Get Unread Notification Count',
        description: 'Fast count of unread orders and alerts for Operations dashboard notification badge.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Unread counter badge payload',
          },
        },
      },
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark Notification as Read',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Notification UUID' },
        ],
        responses: {
          '200': { description: 'Notification marked as read' },
          '404': { description: 'Notification not found' },
        },
      },
    },
    '/api/v1/notifications/mark-all-read': {
      post: {
        tags: ['Notifications'],
        summary: 'Mark All Notifications as Read',
        description: 'Dismisses all unread alerts for the current staff/operations role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': { description: 'All notifications marked as read' },
        },
      },
    },
    '/api/v1/notifications/stream': {
      get: {
        tags: ['Notifications'],
        summary: 'Live Server-Sent Events (SSE) Stream',
        description: 'Real-time HTTP stream pushing instantaneous order packing and fulfillment alerts to Operations & Warehouse screens.',
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', default: 'Operations' } },
        ],
        responses: {
          '200': {
            description: 'SSE stream connection established (Content-Type: text/event-stream)',
          },
        },
      },
    },
    '/api/v1/storefront': {
      get: {
        tags: ['Storefront'],
        summary: 'Get Homepage Storefront Aggregate Data',
        description: 'Returns store announcement configuration, active promotional hero banners, delivery policy, and top categories.',
        responses: {
          '200': {
            description: 'Storefront aggregate payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        store: { type: 'object' },
                        announcement: {
                          type: 'object',
                          properties: {
                            text: { type: 'string', example: '🎉 Grand Festive Sale: Flat 15% OFF on all Authentic Groceries!' },
                            link: { type: 'string', example: '/offers' },
                            isActive: { type: 'boolean', example: true },
                          },
                        },
                        banners: { type: 'array', items: { type: 'object' } },
                        featuredCategories: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/storefront/config': {
      get: {
        tags: ['Storefront'],
        summary: 'Get Announcement Bar & Store Settings',
        description: 'Returns top announcement text, link, active flag, free shipping threshold, and support contacts.',
        responses: {
          '200': {
            description: 'Storefront configuration details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Storefront'],
        summary: 'Update Announcement Bar & Store Settings',
        description: 'Update announcement banner text, link, active toggle, delivery SLA, and policy. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  announcementText: { type: 'string', example: '⚡ Mega Flash Sale: 20% OFF on all Spices today!' },
                  announcementLink: { type: 'string', example: '/deals' },
                  isAnnouncementActive: { type: 'boolean', example: true },
                  freeShippingThreshold: { type: 'number', example: 999.00 },
                  deliverySla: { type: 'string', example: 'Fast 2-Hour Express Delivery' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Storefront configuration updated successfully',
          },
          '403': { description: 'Forbidden: Staff role required' },
        },
      },
    },
    '/api/v1/storefront/banners': {
      get: {
        tags: ['Storefront'],
        summary: 'List Promotional Hero Banners',
        description: 'Returns promotional carousel cards and hero banners. Public sees active banners; pass `?all=true` for admin dashboard management.',
        parameters: [
          { name: 'placement', in: 'query', schema: { type: 'string', enum: ['HERO', 'MIDDLE', 'POPUP', 'SIDEBAR'] }, description: 'Filter by banner placement area' },
          { name: 'all', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Include inactive banners for admin management' },
        ],
        responses: {
          '200': {
            description: 'List of promotional banners',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    totalCount: { type: 'integer', example: 3 },
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Storefront'],
        summary: 'Create Promotional Banner',
        description: 'Create a new promotional hero banner or section card. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'imageUrl'],
                properties: {
                  title: { type: 'string', example: 'Grand Diwali Sweet & Spice Hampers' },
                  subtitle: { type: 'string', example: 'Freshly prepared festive mithai and cold-pressed pure oils.' },
                  badge: { type: 'string', example: 'FESTIVE SALE' },
                  imageUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d' },
                  ctaText: { type: 'string', example: 'Explore Deals' },
                  ctaLink: { type: 'string', example: '/products' },
                  displayOrder: { type: 'integer', example: 1 },
                  isActive: { type: 'boolean', example: true },
                  placement: { type: 'string', example: 'HERO' },
                  bgGradient: { type: 'string', example: 'from-amber-700 to-orange-900' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Banner created successfully',
          },
          '400': { description: 'Missing required title or image URL' },
          '403': { description: 'Forbidden: Staff role required' },
        },
      },
    },
    '/api/v1/storefront/banners/{id}': {
      get: {
        tags: ['Storefront'],
        summary: 'Get Banner by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Banner UUID' },
        ],
        responses: {
          '200': { description: 'Banner found' },
          '404': { description: 'Banner not found' },
        },
      },
      put: {
        tags: ['Storefront'],
        summary: 'Update Promotional Banner',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Banner UUID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Updated Banner Title' },
                  subtitle: { type: 'string', example: 'Updated subtitle' },
                  badge: { type: 'string', example: 'LIMITED TIME' },
                  imageUrl: { type: 'string', example: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d' },
                  ctaText: { type: 'string', example: 'Shop Now' },
                  ctaLink: { type: 'string', example: '/products?category=Spices' },
                  displayOrder: { type: 'integer', example: 2 },
                  isActive: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Banner updated successfully' },
          '404': { description: 'Banner not found' },
        },
      },
      delete: {
        tags: ['Storefront'],
        summary: 'Delete Promotional Banner',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Banner UUID' },
        ],
        responses: {
          '200': { description: 'Banner deleted successfully' },
          '404': { description: 'Banner not found' },
        },
      },
    },
    '/api/v1/storefront/banners/{id}/toggle': {
      patch: {
        tags: ['Storefront'],
        summary: 'Toggle Banner Active Status',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Banner UUID' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isActive: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Banner status toggled successfully' },
          '404': { description: 'Banner not found' },
        },
      },
    },
    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List All Categories with Nested Sub-Categories',
        description: 'Fetch all store categories ordered by display order, each containing its nested sub-categories and live product counts.',
        responses: {
          '200': {
            description: 'List of categories with sub-categories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    totalCount: { type: 'integer', example: 10 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Category' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create Category',
        description: 'Create a new catalog category. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCategoryInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Category created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Category created successfully.' },
                    data: { $ref: '#/components/schemas/Category' },
                  },
                },
              },
            },
          },
          '409': { description: 'Category name or slug already exists' },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
        },
      },
    },
    '/api/v1/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get Category by ID or Slug',
        description: 'Fetch category details with all associated sub-categories.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Category UUID or Slug' },
        ],
        responses: {
          '200': {
            description: 'Category details found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Category' },
                  },
                },
              },
            },
          },
          '404': { description: 'Category not found' },
        },
      },
      put: {
        tags: ['Categories'],
        summary: 'Update Category',
        description: 'Update category name, slug, icon, or display order. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Category UUID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCategoryInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Category updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Category updated successfully.' },
                    data: { $ref: '#/components/schemas/Category' },
                  },
                },
              },
            },
          },
          '404': { description: 'Category not found' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete Category',
        description: 'Delete a category. If linked products exist, reassign products or pass \`?force=true\` to unlink and delete. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Category UUID' },
          { name: 'force', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Force delete and unlink linked products' },
        ],
        responses: {
          '200': {
            description: 'Category deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Category deleted successfully.' },
                    deletedCategoryId: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Category has linked products and force=true was not supplied' },
          '404': { description: 'Category not found' },
        },
      },
    },
    '/api/v1/categories/{categoryId}/sub-categories': {
      get: {
        tags: ['Categories'],
        summary: 'List Sub-Categories of Category',
        description: 'Fetch all sub-categories belonging to a specific parent category.',
        parameters: [
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'string' }, description: 'Parent Category UUID or slug' },
        ],
        responses: {
          '200': {
            description: 'List of sub-categories',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    totalCount: { type: 'integer', example: 4 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SubCategory' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create Sub-Category Under Category',
        description: 'Create a new sub-category for a given parent category. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'categoryId', in: 'path', required: true, schema: { type: 'string' }, description: 'Parent Category UUID or slug' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSubCategoryInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Sub-category created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Sub-category created successfully.' },
                    data: { $ref: '#/components/schemas/SubCategory' },
                  },
                },
              },
            },
          },
          '404': { description: 'Parent category not found' },
          '409': { description: 'Sub-category already exists in this category' },
        },
      },
    },
    '/api/v1/categories/sub-categories/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Update Sub-Category',
        description: 'Update sub-category name, slug, display order, or reassign parent category. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Sub-Category UUID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSubCategoryInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sub-category updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Sub-category updated successfully.' },
                    data: { $ref: '#/components/schemas/SubCategory' },
                  },
                },
              },
            },
          },
          '404': { description: 'Sub-category not found' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete Sub-Category',
        description: 'Delete a sub-category and unlinks product references. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Sub-Category UUID' },
        ],
        responses: {
          '200': {
            description: 'Sub-category deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Sub-category deleted successfully.' },
                    deletedSubCategoryId: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': { description: 'Sub-category not found' },
        },
      },
    },
    '/api/v1/products/admin/summary': {
      get: {
        tags: ['Products'],
        summary: 'Admin Products Dashboard Summary KPIs',
        description: 'Returns real-time catalog analytics: total distinct products, total units in stock, catalog valuation, out-of-stock count, low-stock count, and discount statistics. Requires staff role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Products summary metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        totalProducts: { type: 'integer', example: 125 },
                        totalUnitsInStock: { type: 'integer', example: 4500 },
                        totalCatalogValuation: { type: 'number', example: 890450.00 },
                        outOfStockCount: { type: 'integer', example: 2 },
                        lowStockCount: { type: 'integer', example: 8 },
                        discountedProductsCount: { type: 'integer', example: 45 },
                        organicProductsCount: { type: 'integer', example: 38 },
                        bestsellerProductsCount: { type: 'integer', example: 15 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'Search & Browse Product Catalog (with Pagination & Admin Filters)',
        description: 'Fetch products with multi-faceted filtering (category, sub-category, keyword search, organic, bestseller, stock status, discount status), sorting, and pagination.',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category name or UUID' },
          { name: 'subCategory', in: 'query', schema: { type: 'string' }, description: 'Filter by sub-category' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term for name, SKU, or tags' },
          { name: 'stockStatus', in: 'query', schema: { type: 'string', enum: ['in_stock', 'low_stock', 'out_of_stock'] }, description: 'Filter by inventory status' },
          { name: 'hasDiscount', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter discounted items' },
          { name: 'organic', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter organic products' },
          { name: 'bestseller', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter bestsellers' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price-low', 'price-high', 'name-asc', 'name-desc', 'stock-low', 'stock-high', 'rating', 'newest'] }, description: 'Sort ordering' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Items per page' },
        ],
        responses: {
          '200': {
            description: 'Paginated list of matching products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    totalCount: { type: 'integer', example: 12 },
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 50 },
                    totalPages: { type: 'integer', example: 1 },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Product' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create New Product',
        description: 'Add a new product to the catalog. Automatically calculates discounts, selling price, and generates unique SKU/slug if omitted. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Product created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Product created successfully with calculated discounts.' },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized / Missing token' },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
        },
      },
    },
    '/api/v1/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product By ID or SKU',
        description: 'Fetch complete details for a single product by its unique ID or SKU, including pricing, MRP, savings, and discount percentages.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID (e.g. "p-101a") or SKU' },
        ],
        responses: {
          '200': {
            description: 'Product details found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
          '404': { description: 'Product not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update Product Details & Pricing',
        description: 'Update catalog product information, prices, categories, and discounts. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Product updated successfully.' },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
          '404': { description: 'Product not found' },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Partial Product Update',
        description: 'Partially update product fields. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete Single Product',
        description: 'Delete product permanently from catalog. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        responses: {
          '200': {
            description: 'Product deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Product has been deleted.' },
                    deletedProductId: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/api/v1/products/{id}/discount': {
      patch: {
        tags: ['Products'],
        summary: 'Set Product Discount (Percentage or Flat Amount)',
        description: 'Admin can set the original MRP price, discount type (\`PERCENTAGE\` or \`FLAT\`), and discount value. The discounted selling price is automatically calculated and saved in the database. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductDiscountInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Discount applied and price recalculated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Discount applied successfully for "India Gate Basmati Rice".' },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/api/v1/products/{id}/stock': {
      patch: {
        tags: ['Products'],
        summary: 'Quick Stock Adjustment',
        description: 'Update warehouse stock directly with audit trail entry in inventory logs. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['stock'],
                properties: {
                  stock: { type: 'integer', example: 150 },
                  reason: { type: 'string', example: 'RESTOCK_SHIPMENT' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Stock updated to 150 units.' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/products/{id}/toggle': {
      patch: {
        tags: ['Products'],
        summary: 'Toggle Bestseller or Organic Status',
        description: 'Quick toggle for product highlight flags in admin grid. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID or SKU' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isBestseller: { type: 'boolean', example: true },
                  isOrganic: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Flags toggled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Flags updated for "Pure Desi Ghee".' },
                    data: { $ref: '#/components/schemas/Product' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/products/bulk/delete': {
      post: {
        tags: ['Products'],
        summary: 'Bulk Delete Products',
        description: 'Delete multiple products simultaneously from admin grid. Requires **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productIds'],
                properties: {
                  productIds: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['p-101a', 'p-101c'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Products deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    deletedCount: { type: 'integer', example: 2 },
                    deletedIds: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/products/bulk/import': {
      post: {
        tags: ['Products'],
        summary: 'Bulk Import Products (CSV or JSON Array)',
        description: 'Bulk insert or update (upsert) catalog products from either raw CSV text or an array of JSON product objects. Automatically calculates discounts, resolves category names/slugs, and tracks created vs updated counts. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csv: {
                    type: 'string',
                    example: "name,sku,price,original_price,stock,category\nRoyal Basmati Rice 5kg,SKU-RICE-09,499,599,50,Atta, rice & grains\nKashmiri Chili Powder,SKU-CHILI-01,180,200,80,Spices & Masalas",
                    description: 'Raw CSV text with header row',
                  },
                  items: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CreateProductInput' },
                    description: 'Alternatively, an array of JSON product objects',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Import summary and processed product list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Bulk import completed. 2 created, 0 updated, 0 failed.' },
                    summary: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 2 },
                        created: { type: 'integer', example: 2 },
                        updated: { type: 'integer', example: 0 },
                        failed: { type: 'integer', example: 0 },
                        errors: { type: 'array', items: { type: 'object' } },
                      },
                    },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Product' },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Bad Request - Missing or invalid payload' },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
        },
      },
    },
    '/api/v1/inventory': {
      get: {
        tags: ['Inventory'],
        summary: 'List Warehouse Inventory & Stock Health',
        description: 'View all product stock levels, low-stock warnings, and aggregate warehouse valuations. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'lowStockOnly', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter only low-stock alert items' },
        ],
        responses: {
          '200': {
            description: 'Inventory list with summary metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    metrics: {
                      type: 'object',
                      properties: {
                        totalDistinctSkus: { type: 'integer', example: 16 },
                        totalUnitsInWarehouse: { type: 'integer', example: 1250 },
                        totalWarehouseValuation: { type: 'number', example: 284500.00 },
                        lowStockAlertsCount: { type: 'integer', example: 3 },
                      },
                    },
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Requires staff role' },
        },
      },
    },
    '/api/v1/inventory/{productId}': {
      patch: {
        tags: ['Inventory'],
        summary: 'Atomic Stock Adjustment',
        description: 'Adjust product stock count with atomic row-locking and automatic audit trail insertion in \`inventory_logs\`. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'productId', in: 'path', required: true, schema: { type: 'string' }, description: 'Product ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StockAdjustmentInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock adjusted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Stock updated for Organic Toor Dal.' },
                    data: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string', example: 'p-1' },
                        productName: { type: 'string', example: 'Organic Toor Dal (Pigeon Pea)' },
                        previousStock: { type: 'integer', example: 85 },
                        newStock: { type: 'integer', example: 110 },
                        changeApplied: { type: 'integer', example: 25 },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid adjustment amount or insufficient stock' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/api/v1/inventory/audit-logs': {
      get: {
        tags: ['Inventory'],
        summary: 'Warehouse Movement & Audit History',
        description: 'Retrieve the latest 100 stock adjustment and fulfillment movement logs. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'List of audit log records',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/coupons': {
      get: {
        tags: ['Coupons'],
        summary: 'List Active Public Coupons',
        description: 'Fetch active promotional coupon codes and offers.',
        responses: {
          '200': {
            description: 'List of active coupons',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Coupon' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Coupons'],
        summary: 'Create Promotional Coupon Campaign',
        description: 'Create a new coupon code with usage caps, expiration dates, and minimum order requirements. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCouponInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Coupon created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Coupon created successfully' },
                    data: { $ref: '#/components/schemas/Coupon' },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
        },
      },
    },
    '/api/v1/coupons/validate': {
      post: {
        tags: ['Coupons'],
        summary: 'Validate Coupon Code Against Cart',
        description: 'Calculate real-time discount applicability, caps, and remaining net payable for cart subtotal.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CouponValidationInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Coupon valid and discount calculated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    valid: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'WELCOME50' },
                        title: { type: 'string', example: '50% off on first order' },
                        discountType: { type: 'string', example: 'PERCENTAGE' },
                        discountValue: { type: 'number', example: 50 },
                        discountAmount: { type: 'number', example: 150 },
                        netPayable: { type: 'number', example: 850 },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Coupon is expired, cart subtotal too low, or per-user cap exceeded' },
          '404': { description: 'Invalid promo code' },
        },
      },
    },
    '/api/v1/orders/checkout': {
      post: {
        tags: ['Orders'],
        summary: 'Atomic Checkout & Order Creation',
        description: 'Locks inventory rows atomically via \`FOR UPDATE\`, reserves stock, verifies coupon limits, records order items, initializes timeline, and enqueues async customer notifications.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CheckoutInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order placed and stock reserved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Order created and stock reserved successfully.' },
                    data: {
                      type: 'object',
                      properties: {
                        orderId: { type: 'string', example: 'ORD-2026-7821' },
                        subtotal: { type: 'number', example: 1240.00 },
                        discountAmount: { type: 'number', example: 150.00 },
                        shippingFee: { type: 'number', example: 0 },
                        taxAmount: { type: 'number', example: 62.00 },
                        totalAmount: { type: 'number', example: 1152.00 },
                        status: { type: 'string', example: 'Placed' },
                        paymentStatus: { type: 'string', example: 'Pending' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid address or empty cart' },
          '409': { description: 'Insufficient stock for one or more requested items' },
        },
      },
    },
    '/api/v1/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List Orders (with Filters & Pagination)',
        description: 'Retrieves orders with optional status, payment status, search query, and pagination. Regular customers only see their own orders; Staff (Operations, Manager, Admin, Delivery) view all orders.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by order status' },
          { name: 'paymentStatus', in: 'query', schema: { type: 'string' }, description: 'Filter by payment status' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by Order ID, customer name, phone, or email' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Items per page' },
        ],
        responses: {
          '200': {
            description: 'Paginated list of orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    totalCount: { type: 'integer', example: 45 },
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 50 },
                    totalPages: { type: 'integer', example: 1 },
                    data: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create Order / Atomic Checkout',
        description: 'Locks inventory rows atomically via `FOR UPDATE`, reserves stock, verifies coupon limits, records order items, initializes timeline, and enqueues async customer notifications.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CheckoutInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order placed and stock reserved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Order created and stock reserved successfully.' },
                    data: {
                      type: 'object',
                      properties: {
                        orderId: { type: 'string', example: 'ORD-2026-7821' },
                        subtotal: { type: 'number', example: 1240.00 },
                        discountAmount: { type: 'number', example: 150.00 },
                        shippingFee: { type: 'number', example: 0 },
                        taxAmount: { type: 'number', example: 62.00 },
                        totalAmount: { type: 'number', example: 1152.00 },
                        status: { type: 'string', example: 'Placed' },
                        paymentStatus: { type: 'string', example: 'Pending' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid address or empty cart' },
          '409': { description: 'Insufficient stock for one or more requested items' },
        },
      },
    },
    '/api/v1/orders/admin/summary': {
      get: {
        tags: ['Orders'],
        summary: 'Orders Dashboard Summary KPIs',
        description: 'Returns real-time orders aggregate KPIs: total orders, total revenue, placed, in-packing, out for delivery, delivered, and cancelled counts. Requires staff role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Orders summary metrics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        totalOrders: { type: 'integer', example: 250 },
                        totalRevenue: { type: 'number', example: 184500.00 },
                        placedCount: { type: 'integer', example: 12 },
                        inPackingCount: { type: 'integer', example: 8 },
                        readyForDispatchCount: { type: 'integer', example: 5 },
                        outForDeliveryCount: { type: 'integer', example: 14 },
                        deliveredCount: { type: 'integer', example: 205 },
                        cancelledCount: { type: 'integer', example: 6 },
                        pendingPaymentsCount: { type: 'integer', example: 15 },
                        paidOrdersCount: { type: 'integer', example: 235 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get Order Details, Items & Live Timeline',
        description: 'Fetch order information including line items, prices, shipping address, and fulfillment milestone timeline.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID (e.g. "ORD-2026-7821")' },
        ],
        responses: {
          '200': {
            description: 'Order found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'ORD-2026-7821' },
                        customer_name: { type: 'string', example: 'Aarav Sharma' },
                        total_amount: { type: 'number', example: 1152.00 },
                        status: { type: 'string', example: 'Placed' },
                        payment_status: { type: 'string', example: 'Paid' },
                        items: { type: 'array', items: { type: 'object' } },
                        timeline: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Access to another customer order is denied' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/v1/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Update Order Fulfillment State Machine',
        description: 'Advance order state (Placed -> In Packing -> Ready for Dispatch -> Out for Delivery -> Delivered / Cancelled), assign delivery agents, append notes to timeline, and dispatch customer alerts. Requires **Operations**, **Delivery**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrderStatusUpdateInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order status successfully transitioned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: "Order #ORD-2026-7821 status updated to 'In Packing'." },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid status transition value' },
          '403': { description: 'Forbidden: Staff role required' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/v1/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel Order & Restore Inventory',
        description: 'Cancel an order before it is out for delivery, automatically return items back to product stock in a transaction, write inventory audit log, and update timeline.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string', example: 'Customer requested cancellation before shipment.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order cancelled and stock restored',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Order #ORD-2026-7821 has been cancelled and stock has been restored.' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          '400': { description: 'Order cannot be cancelled (e.g. already Delivered)' },
          '403': { description: 'Forbidden: Not authorized' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/v1/orders/{id}/payment': {
      patch: {
        tags: ['Orders'],
        summary: 'Update Order Payment Status',
        description: 'Update payment status (Pending, Paid, Failed, Refunded) and payment method. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Order ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  paymentStatus: { type: 'string', enum: ['Pending', 'Paid', 'Failed', 'Refunded'], example: 'Paid' },
                  paymentMethod: { type: 'string', example: 'UPI' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment status updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: "Payment status for Order #ORD-2026-7821 updated to 'Paid'." },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid payment status' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/v1/payments/create-intent': {
      post: {
        tags: ['Payments'],
        summary: 'Create Razorpay Payment Order Intent',
        description: 'Initialize a payment gateway transaction for an existing pending order.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentIntentInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment intent created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        orderId: { type: 'string', example: 'ORD-2026-7821' },
                        gatewayOrderId: { type: 'string', example: 'order_rzp_9812491a' },
                        amount: { type: 'integer', example: 115200, description: 'Amount in paise' },
                        currency: { type: 'string', example: 'INR' },
                        keyId: { type: 'string', example: 'rzp_test_placeholder' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/api/v1/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Payment Webhook Callback',
        description: 'Handles server-to-server payment notifications from payment providers to mark orders as Paid.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentWebhookInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Webhook processed successfully' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/reports/sales-revenue': {
      get: {
        tags: ['Reports'],
        summary: 'Sales & Revenue Analytics (GMV, AOV, Top Sellers)',
        description: 'Aggregates sales metrics, Gross Merchandise Value (GMV), category breakdown, and top products sold. Requires **Manager** or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Sales BI Report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    summary: {
                      type: 'object',
                      properties: {
                        totalOrders: { type: 'integer', example: 154 },
                        gmv: { type: 'number', example: 198420.00 },
                        netSubtotal: { type: 'number', example: 189200.00 },
                        totalDiscountsGiven: { type: 'number', example: 8400.00 },
                        aov: { type: 'number', example: 1288.44 },
                      },
                    },
                    categoryBreakdown: { type: 'array', items: { type: 'object' } },
                    topSellingProducts: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Requires Manager or Admin role' },
        },
      },
    },
    '/api/v1/reports/inventory-turnover': {
      get: {
        tags: ['Reports'],
        summary: 'Inventory Health & Low-Stock Alerts Report',
        description: 'Categorized warehouse inventory distribution, valuation per category, and active low-stock alerts. Requires **Operations**, **Manager**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Inventory Turnover Report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    categoryInventorySummary: { type: 'array', items: { type: 'object' } },
                    lowStockAlerts: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Staff role required' },
        },
      },
    },
    '/api/v1/reports/delivery-sla': {
      get: {
        tags: ['Reports'],
        summary: 'Fulfillment & Delivery SLA Performance Report',
        description: 'Distribution of active order statuses and delivery agent active workloads. Requires **Manager**, **Operations**, or **Admin** role.',
        security: [{ BearerAuth: [] }, { MockRoleHeader: [] }],
        responses: {
          '200': {
            description: 'Delivery SLA Report',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    orderStatusDistribution: { type: 'array', items: { type: 'object' } },
                    agentActiveDeliveries: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          '403': { description: 'Forbidden: Staff role required' },
        },
      },
    },
  },
};

const customCss = `
  .swagger-ui .topbar {
    background-color: #0f172a;
    border-bottom: 2px solid #f97316;
  }
  .swagger-ui .topbar .topbar-wrapper img {
    content: url('https://img.icons8.com/color/48/curry.png');
    height: 36px;
    width: auto;
  }
  .swagger-ui .topbar .topbar-wrapper a span {
    color: #ffffff;
    font-weight: 700;
    font-size: 1.15rem;
    margin-left: 10px;
  }
  .swagger-ui .info .title {
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .swagger-ui .btn.authorize {
    background-color: #ea580c;
    border-color: #ea580c;
    color: #ffffff;
  }
  .swagger-ui .btn.authorize svg {
    fill: #ffffff;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #0284c7;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #16a34a;
  }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background: #d97706;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #dc2626;
  }
`;

export function setupSwagger(app: Application): void {
  // Raw OpenAPI Specification JSON Endpoint
  app.get('/api-docs/json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });

  // Interactive Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCss,
      customSiteTitle: 'Indian Store API Documentation | Swagger UI',
      customfavIcon: 'https://img.icons8.com/color/48/curry.png',
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );

  // Friendly alias for /docs
  app.get('/docs', (_req, res) => {
    res.redirect('/api-docs');
  });
}
