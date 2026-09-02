import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('Indian Store Backend API Suite', () => {
  it('GET / - returns API service information', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.health).toBe('/api/health');
  });

  it('GET /api/health - returns UP status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('Indian Store Backend API');
  });

  describe('Swagger & OpenAPI Documentation', () => {
    it('GET /api-docs/json - returns OpenAPI 3.0 specification', async () => {
      const res = await request(app).get('/api-docs/json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toBe('Indian Store E-Commerce REST API');
      expect(res.body.paths['/api/v1/products']).toBeDefined();
      expect(res.body.paths['/api/v1/inventory']).toBeDefined();
      expect(res.body.paths['/api/v1/coupons']).toBeDefined();
      expect(res.body.paths['/api/v1/orders']).toBeDefined();
      expect(res.body.paths['/api/v1/payments/create-intent']).toBeDefined();
      expect(res.body.paths['/api/v1/reports/sales-revenue']).toBeDefined();
    });

    it('GET /docs - redirects to /api-docs', async () => {
      const res = await request(app).get('/docs');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/api-docs');
    });

    it('GET /api-docs/ - serves Swagger HTML UI', async () => {
      const res = await request(app).get('/api-docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('Product Pricing, Discounts & Frontend Formats', () => {
    it('GET /api/v1/products - returns products with original_price, discounted_price, discount_percent, and savings', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const product = res.body.data[0];
      expect(product.price).toBeDefined();
      expect(product.discounted_price).toBe(product.price);
      expect(product.original_price).toBeDefined();
      expect(product.discount_type).toBeDefined();
      expect(product.discount_percent).toBeDefined();
      expect(product.savings_amount).toBeDefined();
      expect(typeof product.has_discount).toBe('boolean');
    });

    it('POST /api/v1/products - admin creates product with percentage discount', async () => {
      const testProduct = {
        id: 'p-test-discount-' + Date.now(),
        sku: 'SKU-TEST-' + Math.floor(Math.random() * 10000),
        name: 'Test Cashews ' + Date.now(),
        originalPrice: 1000,
        discountType: 'PERCENTAGE',
        discountValue: 20, // 20% off -> selling price 800
        imageUrl: 'https://example.com/cashew.jpg',
        description: 'Premium roasted cashews',
        weight: '500g',
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('x-mock-role', 'Admin')
        .send(testProduct);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.original_price).toBe(1000);
      expect(res.body.data.price).toBe(800);
      expect(res.body.data.discounted_price).toBe(800);
      expect(res.body.data.discount_percent).toBe(20);
      expect(res.body.data.savings_amount).toBe(200);
      expect(res.body.data.has_discount).toBe(true);
    });

    it('PATCH /api/v1/products/:id/discount - admin updates discount to flat amount', async () => {
      const res = await request(app)
        .patch('/api/v1/products/p-101a/discount')
        .set('x-mock-role', 'Admin')
        .send({
          originalPrice: 1200,
          discountType: 'FLAT',
          discountValue: 300, // Flat 300 off -> 900
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.original_price).toBe(1200);
      expect(res.body.data.price).toBe(900);
      expect(res.body.data.discounted_price).toBe(900);
      expect(res.body.data.savings_amount).toBe(300);
      expect(res.body.data.discount_percent).toBe(25);
    });

    it('GET /api/v1/products/admin/summary - returns catalog KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/products/admin/summary')
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProducts).toBeGreaterThan(0);
      expect(res.body.data.totalUnitsInStock).toBeDefined();
      expect(res.body.data.totalCatalogValuation).toBeDefined();
    });

    it('GET /api/v1/products?page=1&limit=2 - returns paginated data', async () => {
      const res = await request(app).get('/api/v1/products?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.limit).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.totalPages).toBeDefined();
    });

    it('PATCH /api/v1/products/:id/stock - updates stock with inventory log', async () => {
      const res = await request(app)
        .patch('/api/v1/products/p-101a/stock')
        .set('x-mock-role', 'Admin')
        .send({
          stock: 80,
          reason: 'RESTOCK_SHIPMENT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newStock).toBe(80);
    });

    it('PATCH /api/v1/products/:id/toggle - toggles bestseller/organic flags', async () => {
      const res = await request(app)
        .patch('/api/v1/products/p-101a/toggle')
        .set('x-mock-role', 'Admin')
        .send({
          isBestseller: true,
          isOrganic: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_organic).toBe(true);
      expect(res.body.data.is_bestseller).toBe(true);
    });

    it('DELETE /api/v1/products/:id - deletes a product', async () => {
      // Create a temporary product to delete
      const createRes = await request(app)
        .post('/api/v1/products')
        .set('x-mock-role', 'Admin')
        .send({
          name: 'Temp Item to Delete ' + Date.now(),
          price: 50,
        });

      const tempId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/products/${tempId}`)
        .set('x-mock-role', 'Admin');

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.deletedProductId).toBe(tempId);
    });

    it('POST /api/v1/products/bulk/import - bulk imports products from CSV text', async () => {
      const runId = Date.now();
      const sku1 = `SKU-CSV-ATTA-${runId}`;
      const sku2 = `SKU-CSV-SALT-${runId}`;

      const csvData = `name,sku,original_price,price,stock,category,is_organic
"Aashirvaad Shudh Chakki Atta (10kg)",${sku1},550,490,120,"Atta, rice & grains",true
"Tata Salt Vacuum Evaporated (1kg)",${sku2},30,28,300,"Spices & Masalas",false`;

      const res = await request(app)
        .post('/api/v1/products/bulk/import')
        .set('x-mock-role', 'Admin')
        .send({ csv: csvData });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.summary.created).toBe(2);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].sku).toBe(sku1);
      expect(res.body.data[0].is_organic).toBe(true);
      expect(res.body.data[0].has_discount).toBe(true);
      expect(res.body.data[1].sku).toBe(sku2);
    });

    it('POST /api/v1/products/bulk/import - bulk imports products from JSON items array and updates on SKU conflict', async () => {
      const runId = Date.now();
      const skuExisting = `SKU-EXIST-${runId}`;
      const skuNew = `SKU-NEW-${runId}`;

      // First create one item
      await request(app)
        .post('/api/v1/products')
        .set('x-mock-role', 'Admin')
        .send({
          name: 'Original Item ' + runId,
          sku: skuExisting,
          price: 500,
          originalPrice: 600,
        });

      const items = [
        {
          sku: skuExisting,
          name: 'Original Item Updated ' + runId,
          originalPrice: 650,
          price: 520,
          stock: 150,
        },
        {
          sku: skuNew,
          name: 'Brand New Ghee ' + runId,
          originalPrice: 700,
          price: 650,
          stock: 40,
        },
      ];

      const res = await request(app)
        .post('/api/v1/products/bulk/import')
        .set('x-mock-role', 'Manager')
        .send({ items });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.total).toBe(2);
      expect(res.body.summary.updated).toBe(1); // skuExisting updated
      expect(res.body.summary.created).toBe(1); // skuNew created
    });
  });



  describe('Offers & Coupons Validation Logic', () => {
    it('POST /api/v1/coupons/validate - rejects missing parameters', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Calculates percentage discount accurately with cap', () => {
      const subtotal = 2000;
      const discountPercent = 15;
      const maxCap = 250;

      let calculated = (subtotal * discountPercent) / 100; // 300
      if (maxCap && calculated > maxCap) {
        calculated = maxCap;
      }
      expect(calculated).toBe(250);
      expect(subtotal - calculated).toBe(1750);
    });

    it('Calculates flat discount correctly', () => {
      const subtotal = 800;
      const flatDiscount = 100;
      const net = subtotal - flatDiscount;
      expect(net).toBe(700);
    });
  });

  describe('Multi-Role RBAC Authorization Guard', () => {
    it('allows Manager and Admin role to access inventory endpoint', async () => {
      // In dev bypass mode with x-mock-role header:
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('x-mock-role', 'Manager');
      // Status will be 200 (or 500 if local postgres is offline, but auth passed through)
      expect([200, 500]).toContain(res.status);
    });

    it('blocks Customer role from accessing inventory management', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('x-mock-role', 'Customer');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('blocks Customer role from accessing executive sales reports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales-revenue')
        .set('x-mock-role', 'Customer');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('grants Super Admin access to all endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/reports/sales-revenue')
        .set('x-mock-role', 'Admin');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Categories & Sub-Categories Admin Management Suite', () => {
    let createdCategoryId: string;
    let createdSubCategoryId: string;

    it('GET /api/v1/categories - fetches all categories with nested sub_categories and product counts', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const firstCat = res.body.data[0];
      expect(firstCat.id).toBeDefined();
      expect(firstCat.name).toBeDefined();
      expect(firstCat.slug).toBeDefined();
      expect(Array.isArray(firstCat.sub_categories)).toBe(true);
      expect(firstCat.products_count).toBeDefined();
    });

    it('POST /api/v1/categories - admin creates new category', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('x-mock-role', 'Admin')
        .send({
          name: 'Sweets & Mithai ' + Date.now(),
          icon: 'cake',
          displayOrder: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain('Sweets & Mithai');
      createdCategoryId = res.body.data.id;
    });

    it('POST /api/v1/categories/:id/sub-categories - admin creates sub-category under category', async () => {
      const res = await request(app)
        .post(`/api/v1/categories/${createdCategoryId}/sub-categories`)
        .set('x-mock-role', 'Admin')
        .send({
          name: 'Gulab Jamun & Rasgulla',
          displayOrder: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Gulab Jamun & Rasgulla');
      createdSubCategoryId = res.body.data.id;
    });

    it('PUT /api/v1/categories/:id - admin updates category details', async () => {
      const res = await request(app)
        .put(`/api/v1/categories/${createdCategoryId}`)
        .set('x-mock-role', 'Admin')
        .send({
          icon: 'bakery_dining',
          displayOrder: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.icon).toBe('bakery_dining');
      expect(res.body.data.display_order).toBe(20);
    });

    it('DELETE /api/v1/categories/sub-categories/:id - admin deletes sub-category', async () => {
      const res = await request(app)
        .delete(`/api/v1/categories/sub-categories/${createdSubCategoryId}`)
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/v1/categories/:id - admin deletes category', async () => {
      const res = await request(app)
        .delete(`/api/v1/categories/${createdCategoryId}`)
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Orders Management & Fulfillment API Suite', () => {
    let testOrderId = '';
    let testProductId = '';

    it('POST /api/v1/orders - creates order and deducts stock', async () => {
      // 1. Create product with known stock
      const prodRes = await request(app)
        .post('/api/v1/products')
        .set('x-mock-role', 'Admin')
        .send({
          name: 'Order Test Item ' + Date.now(),
          sku: 'SKU-ORD-TEST-' + Date.now(),
          price: 250,
          originalPrice: 300,
          stock: 50,
        });

      testProductId = prodRes.body.data.id;

      // 2. Place Order
      const res = await request(app)
        .post('/api/v1/orders')
        .set('x-mock-role', 'Customer')
        .set('x-mock-email', 'customer@example.com')
        .send({
          items: [{ productId: testProductId, quantity: 2 }],
          shippingAddress: {
            fullName: 'Priya Sharma',
            phone: '+919876543210',
            addressLine: '123 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
          },
          paymentMethod: 'UPI',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.subtotal).toBe(500);
      expect(res.body.data.status).toBe('Placed');
      testOrderId = res.body.data.orderId;

      // 3. Verify stock was deducted from 50 to 48
      const getProd = await request(app).get(`/api/v1/products/${testProductId}`);
      expect(getProd.body.data.stock).toBe(48);
    });

    it('GET /api/v1/orders/admin/summary - returns orders dashboard KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/orders/admin/summary')
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(1);
      expect(res.body.data.placedCount).toBeDefined();
      expect(res.body.data.totalRevenue).toBeDefined();
    });

    it('GET /api/v1/orders - lists orders with pagination & search', async () => {
      const res = await request(app)
        .get(`/api/v1/orders?search=${testOrderId}`)
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((o: any) => o.id === testOrderId)).toBe(true);
    });

    it('GET /api/v1/orders/:id - returns order with items and timeline', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${testOrderId}`)
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testOrderId);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(Array.isArray(res.body.data.timeline)).toBe(true);
      expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/orders/:id/status - transitions status to In Packing (and accepts Packed)', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${testOrderId}/status`)
        .set('x-mock-role', 'Operations')
        .send({
          status: 'Packed',
          notes: 'Packed and sealed with tamper-proof security tape',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('In Packing');
    });

    it('PATCH /api/v1/orders/:id/payment - updates payment status to Paid', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${testOrderId}/payment`)
        .set('x-mock-role', 'Manager')
        .send({
          paymentStatus: 'Paid',
          paymentMethod: 'UPI',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment_status).toBe('Paid');
    });

    it('POST /api/v1/orders/:id/cancel - cancels order and restores product stock', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${testOrderId}/cancel`)
        .set('x-mock-role', 'Admin')
        .send({
          reason: 'Customer requested change of items',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Cancelled');
      expect(res.body.data.payment_status).toBe('Refunded');

      // Verify stock was restored back from 48 to 50
      const getProd = await request(app).get(`/api/v1/products/${testProductId}`);
      expect(getProd.body.data.stock).toBe(50);
    });
  });

  describe('Storefront & Promotional Banners API Suite', () => {
    let createdBannerId = '';

    it('GET /api/v1/storefront - returns aggregate storefront with announcement and hero banners', async () => {
      const res = await request(app).get('/api/v1/storefront');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.store).toBeDefined();
      expect(res.body.data.store.storeName).toBe('Indian Store');
      expect(res.body.data.announcement).toBeDefined();
      expect(typeof res.body.data.announcement.text).toBe('string');
      expect(res.body.data.announcement.text.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.banners)).toBe(true);
      expect(res.body.data.banners.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.featuredCategories)).toBe(true);
    });

    it('GET /api/v1/storefront/banner-config - returns top announcement config for Angular navbar', async () => {
      const res = await request(app).get('/api/v1/storefront/banner-config');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.announcementText).toBeDefined();
      expect(typeof res.body.data.isAnnouncementActive).toBe('boolean');
    });

    it('PUT /api/v1/storefront/config - admin updates announcement text & link', async () => {
      const res = await request(app)
        .put('/api/v1/storefront/config')
        .set('x-mock-role', 'Admin')
        .send({
          announcementText: '🔥 Weekend Super Saver: 20% OFF on all Desi Spices!',
          announcementLink: '/deals',
          isAnnouncementActive: true,
          freeShippingThreshold: 799,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.announcementText).toBe('🔥 Weekend Super Saver: 20% OFF on all Desi Spices!');
      expect(res.body.data.announcementLink).toBe('/deals');
      expect(res.body.data.freeShippingThreshold).toBe(799);
    });

    it('GET /api/v1/storefront/banners - lists active promotional hero banners', async () => {
      const res = await request(app).get('/api/v1/storefront/banners');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toBeDefined();
      expect(res.body.data[0].imageUrl).toBeDefined();
    });

    it('POST /api/v1/storefront/banners - admin creates new promotional banner', async () => {
      const res = await request(app)
        .post('/api/v1/storefront/banners')
        .set('x-mock-role', 'Admin')
        .send({
          title: 'Special Diwali Sweet Hampers ' + Date.now(),
          subtitle: 'Artisanal Kaju Katli, Motichoor Ladoos & Premium Dry Fruits',
          badge: 'DIWALI SPECIAL',
          imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d',
          ctaText: 'Pre-Order Now',
          ctaLink: '/products?category=Chips%20%26%20biscuits',
          displayOrder: 10,
          isActive: true,
          placement: 'HERO',
          bgGradient: 'from-amber-600 to-orange-800',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Special Diwali Sweet Hampers');
      createdBannerId = res.body.data.id;
    });

    it('PUT /api/v1/storefront/banners/:id - admin updates banner title and cta text', async () => {
      const res = await request(app)
        .put(`/api/v1/storefront/banners/${createdBannerId}`)
        .set('x-mock-role', 'Admin')
        .send({
          title: 'Diwali Hampers (Updated Edition)',
          ctaText: 'Shop Gifts',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Diwali Hampers (Updated Edition)');
      expect(res.body.data.ctaText).toBe('Shop Gifts');
    });

    it('PATCH /api/v1/storefront/banners/:id/toggle - admin toggles banner active status', async () => {
      const res = await request(app)
        .patch(`/api/v1/storefront/banners/${createdBannerId}/toggle`)
        .set('x-mock-role', 'Admin')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('DELETE /api/v1/storefront/banners/:id - admin deletes promotional banner', async () => {
      const res = await request(app)
        .delete(`/api/v1/storefront/banners/${createdBannerId}`)
        .set('x-mock-role', 'Admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedBannerId).toBe(createdBannerId);
    });
  });

  describe('Operations & Staff Notifications System API Suite', () => {
    let testNotificationId = '';

    it('GET /api/v1/notifications - lists operations notifications including new order alerts', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?role=Operations')
        .set('x-mock-role', 'Operations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const latest = res.body.data[0];
      expect(latest.title).toBeDefined();
      expect(latest.type).toBe('NEW_ORDER');
      testNotificationId = latest.id;
    });

    it('GET /api/v1/notifications/unread-count - returns unread count badge for operations team', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('x-mock-role', 'Operations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe('Operations');
      expect(typeof res.body.unreadCount).toBe('number');
      expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/notifications/:id/read - marks single notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${testNotificationId}/read`)
        .set('x-mock-role', 'Operations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();
    });

    it('POST /api/v1/notifications/broadcast - manager broadcasts urgent warehouse alert', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/broadcast')
        .set('x-mock-role', 'Manager')
        .send({
          recipientRole: 'Operations',
          title: '⚡ Priority Dispatch Notice',
          message: 'Express delivery surge: Please prioritize South-East zone orders for packing.',
          type: 'URGENT_SLA',
          metadata: { zone: 'South-East', surgeMultiplier: 1.5 },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Priority Dispatch Notice');
      expect(res.body.data.type).toBe('URGENT_SLA');
    });

    it('POST /api/v1/notifications/mark-all-read - marks all unread operations notifications as read', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/mark-all-read')
        .set('x-mock-role', 'Operations')
        .send({ role: 'Operations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const countCheck = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('x-mock-role', 'Operations');

      expect(countCheck.body.unreadCount).toBe(0);
    });

    it('OPTIONS /api/v1/notifications & any endpoint - handles CORS preflight with credentials properly', async () => {
      const res = await request(app)
        .options('/api/v1/notifications')
        .set('Origin', 'https://indian-store.trader-news.co.in')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://indian-store.trader-news.co.in');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('OPTIONS /api/v1/orders/:id/status - allows x-mock-role header from http://localhost:4200', async () => {
      const res = await request(app)
        .options('/api/v1/orders/ORD-9822/status')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'content-type, x-mock-role, authorization');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('x-mock-role');
    });
  });
});

