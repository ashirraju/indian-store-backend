import { Router, Request, Response } from 'express';
import { getClient, query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import { NotificationService } from '../notifications/notifications.service.js';

export const ordersRouter = Router();

// POST /api/v1/orders/checkout - Atomic checkout with stock reservation
// Handler: Atomic Checkout & Order Creation
async function handleCheckout(req: Request, res: Response) {
  const client = await getClient();
  try {
    const {
      items, // [{ productId, quantity }]
      shippingAddress,
      couponCode,
      paymentMethod,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'EMPTY_CART', message: 'Cart items cannot be empty.' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.addressLine) {
      return res.status(400).json({ success: false, error: 'INVALID_ADDRESS', message: 'Full shipping address and contact details required.' });
    }

    await client.query('BEGIN');

    // 1. Fetch & lock product rows atomically
    const productIds = items.map((i: any) => i.productId);
    const prodRes = await client.query(
      'SELECT id, name, price, stock, image_url FROM products WHERE id = ANY($1::varchar[]) FOR UPDATE',
      [productIds]
    );

    const productMap = new Map<string, any>();
    prodRes.rows.forEach(p => productMap.set(p.id, p));

    // Verify all items exist and have enough stock
    let subtotal = 0;
    const orderItemsToInsert: any[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'ITEM_NOT_FOUND', message: `Product ${item.productId} not found.` });
      }

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Item "${product.name}" only has ${product.stock} units remaining (requested ${item.quantity}).`,
        });
      }

      const itemTotal = Number(product.price) * item.quantity;
      subtotal += itemTotal;

      orderItemsToInsert.push({
        productId: product.id,
        name: product.name,
        image: product.image_url,
        unitPrice: Number(product.price),
        quantity: item.quantity,
        totalPrice: itemTotal,
      });
    }

    // 2. Validate Coupon if provided
    let discountAmount = 0;
    let appliedCoupon: any = null;

    if (couponCode) {
      const cRes = await client.query('SELECT * FROM coupons WHERE code = $1 AND is_active = true FOR UPDATE', [couponCode.toUpperCase().trim()]);
      if (cRes.rowCount && cRes.rowCount > 0) {
        const c = cRes.rows[0];
        if (new Date(c.valid_to) >= new Date() && subtotal >= Number(c.min_order_amount)) {
          if (c.discount_type === 'PERCENTAGE') {
            discountAmount = (subtotal * Number(c.discount_value)) / 100;
            if (c.max_discount_cap) {
              discountAmount = Math.min(discountAmount, Number(c.max_discount_cap));
            }
          } else {
            discountAmount = Math.min(Number(c.discount_value), subtotal);
          }
          appliedCoupon = c;

          // Increment coupon usage
          await client.query('UPDATE coupons SET current_uses_count = current_uses_count + 1 WHERE id = $1', [c.id]);
        }
      }
    }

    const shippingFee = subtotal > 999 ? 0 : 49;
    const taxAmount = Math.round((subtotal * 0.05) * 100) / 100; // 5% GST on groceries
    const finalTotal = Math.round((subtotal - discountAmount + shippingFee + taxAmount) * 100) / 100;
    const orderId = 'ORD-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    // 3. Deduct Stock & write inventory logs
    for (const item of items) {
      const product = productMap.get(item.productId);
      const newStock = product.stock - item.quantity;

      await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, item.productId]);
      await client.query(`
        INSERT INTO inventory_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id, adjusted_by)
        VALUES ($1, $2, $3, $4, 'ORDER_PLACED', $5, $6)
      `, [item.productId, -item.quantity, product.stock, newStock, orderId, req.user?.name || 'Customer Checkout']);
    }

    // 4. Create Order
    await client.query(`
      INSERT INTO orders (
        id, customer_name, customer_email, customer_phone, shipping_address,
        subtotal, discount_amount, tax_amount, shipping_fee, total_amount,
        coupon_code, status, payment_status, payment_method, assigned_delivery_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Placed', 'Pending', $12, 'Unassigned')
    `, [
      orderId,
      shippingAddress.fullName,
      req.user?.email || shippingAddress.email || 'guest@indianstore.com',
      shippingAddress.phone,
      JSON.stringify(shippingAddress),
      subtotal,
      discountAmount,
      taxAmount,
      shippingFee,
      finalTotal,
      couponCode || null,
      paymentMethod || 'UPI',
    ]);

    // 5. Insert Order Items
    for (const oi of orderItemsToInsert) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price, quantity, total_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [orderId, oi.productId, oi.name, oi.image, oi.unitPrice, oi.quantity, oi.totalPrice]);
    }

    // 6. Insert Timeline Initial Entry
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await client.query(`
      INSERT INTO order_timeline (order_id, status, notes, timestamp, is_completed)
      VALUES ($1, 'Placed', 'Order verified and sent to fulfillment center', $2, true)
    `, [orderId, nowTime]);

    // 7. Log Coupon Redemption if applied
    if (appliedCoupon) {
      await client.query(`
        INSERT INTO coupon_redemptions (coupon_id, user_email, order_id, discount_applied)
        VALUES ($1, $2, $3, $4)
      `, [appliedCoupon.id, req.user?.email || shippingAddress.email, orderId, discountAmount]);
    }

    await client.query('COMMIT');

    // Asynchronously dispatch notifications without blocking response
    NotificationService.sendOrderEventNotification('ORDER_PLACED', {
      orderId,
      customerName: shippingAddress.fullName,
      customerEmail: req.user?.email || shippingAddress.email,
      customerPhone: shippingAddress.phone,
      totalAmount: finalTotal,
      status: 'Placed',
      itemsCount: items.length,
    }).catch(e => console.error('Notification worker failed', e));

    res.status(201).json({
      success: true,
      message: 'Order created and stock reserved successfully.',
      data: {
        orderId,
        subtotal,
        discountAmount,
        shippingFee,
        taxAmount,
        totalAmount: finalTotal,
        status: 'Placed',
        paymentStatus: 'Pending',
        paymentMethod: paymentMethod || 'UPI',
        items: orderItemsToInsert,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: 'CHECKOUT_FAILED', message: error.message });
  } finally {
    client.release();
  }
}

// POST /api/v1/orders - Create Order / Checkout (Standard REST endpoint)
ordersRouter.post('/', authGuard, handleCheckout);

// POST /api/v1/orders/checkout - Alias for checkout
ordersRouter.post('/checkout', authGuard, handleCheckout);

// GET /api/v1/orders/admin/summary - Top-level order KPIs for admin/operations dashboard
ordersRouter.get('/admin/summary', authGuard, roleGuard('Operations', 'Delivery', 'Manager', 'Admin'), async (_req: Request, res: Response) => {
  try {
    const summarySql = `
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COUNT(CASE WHEN status = 'Placed' THEN 1 END) AS placed_count,
        COUNT(CASE WHEN status = 'In Packing' THEN 1 END) AS in_packing_count,
        COUNT(CASE WHEN status = 'Ready for Dispatch' THEN 1 END) AS ready_for_dispatch_count,
        COUNT(CASE WHEN status = 'Out for Delivery' THEN 1 END) AS out_for_delivery_count,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) AS delivered_count,
        COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) AS cancelled_count,
        COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) AS pending_payments_count,
        COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) AS paid_orders_count
      FROM orders
    `;
    const summaryRes = await query(summarySql);
    const row = summaryRes.rows[0];

    res.json({
      success: true,
      data: {
        totalOrders: Number(row.total_orders),
        totalRevenue: Number(row.total_revenue),
        placedCount: Number(row.placed_count),
        inPackingCount: Number(row.in_packing_count),
        readyForDispatchCount: Number(row.ready_for_dispatch_count),
        outForDeliveryCount: Number(row.out_for_delivery_count),
        deliveredCount: Number(row.delivered_count),
        cancelledCount: Number(row.cancelled_count),
        pendingPaymentsCount: Number(row.pending_payments_count),
        paidOrdersCount: Number(row.paid_orders_count),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SUMMARY_FAILED', message: error.message });
  }
});

// GET /api/v1/orders - Retrieve orders list (with search, status filter, and pagination)
ordersRouter.get('/', authGuard, async (req: Request, res: Response) => {
  try {
    const isStaff = ['Manager', 'Operations', 'Delivery', 'Admin'].includes(req.user?.role || '');
    const { status, paymentStatus, search, page = '1', limit = '50' } = req.query;

    let baseSql = ' WHERE 1=1';
    const params: any[] = [];

    // Customers only see their own orders
    if (!isStaff) {
      params.push(req.user?.email);
      baseSql += ` AND customer_email = $${params.length}`;
    }

    if (status && status !== 'All') {
      params.push(status);
      baseSql += ` AND status = $${params.length}`;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      params.push(paymentStatus);
      baseSql += ` AND payment_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      baseSql += ` AND (id ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR customer_phone ILIKE $${params.length} OR customer_email ILIKE $${params.length})`;
    }

    // Count query
    const countRes = await query(`SELECT COUNT(*) AS total FROM orders ${baseSql}`, params);
    const totalCount = Number(countRes.rows[0].total);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const dataSql = `
      SELECT * FROM orders 
      ${baseSql}
      ORDER BY placed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const result = await query(dataSql, [...params, limitNum, offset]);

    res.json({
      success: true,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      data: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// GET /api/v1/orders/:id - Single order details with items and timeline
ordersRouter.get('/:id', authGuard, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const orderRes = await query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [id]);
    if (orderRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    const order = orderRes.rows[0];

    // Check authorization
    const isStaff = ['Manager', 'Operations', 'Delivery', 'Admin'].includes(req.user?.role || '');
    if (!isStaff && order.customer_email !== req.user?.email) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You are not authorized to view this order.' });
    }

    const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    const timelineRes = await query('SELECT * FROM order_timeline WHERE order_id = $1 ORDER BY created_at ASC', [id]);

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsRes.rows,
        timeline: timelineRes.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// PATCH /api/v1/orders/:id/status - Update fulfillment state machine (Operations, Delivery, Manager, Admin)
ordersRouter.patch('/:id/status', authGuard, roleGuard('Operations', 'Delivery', 'Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedDeliveryAgent } = req.body;

    const validStatuses = ['Placed', 'In Packing', 'Ready for Dispatch', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    let updateSql = 'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (assignedDeliveryAgent) {
      params.push(assignedDeliveryAgent);
      updateSql += `, assigned_delivery_agent = $${params.length}`;
    }

    params.push(id);
    updateSql += ` WHERE id = $${params.length} RETURNING *`;

    const updatedRes = await query(updateSql, params);
    if (updatedRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    const order = updatedRes.rows[0];

    // Append to timeline
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await query(`
      INSERT INTO order_timeline (order_id, status, notes, timestamp, is_completed)
      VALUES ($1, $2, $3, $4, true)
    `, [id, status, notes || `Status updated to ${status} by ${req.user?.name}`, nowTime]);

    // Send customer notification on major status transitions
    let eventName: 'ORDER_PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | null = null;
    if (status === 'In Packing') eventName = 'ORDER_PACKED';
    if (status === 'Out for Delivery') eventName = 'OUT_FOR_DELIVERY';
    if (status === 'Delivered') eventName = 'DELIVERED';

    if (eventName) {
      NotificationService.sendOrderEventNotification(eventName, {
        orderId: id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        totalAmount: Number(order.total_amount),
        status: status,
        itemsCount: 1,
        deliveryAgent: order.assigned_delivery_agent,
      }).catch(e => console.error('Notification dispatch error', e));
    }

    res.json({
      success: true,
      message: `Order #${id} status updated to '${status}'.`,
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'STATUS_UPDATE_FAILED', message: error.message });
  }
});

// POST /api/v1/orders/:id/cancel - Cancel order & atomically restore inventory
ordersRouter.post('/:id/cancel', authGuard, async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    const isStaff = ['Manager', 'Operations', 'Delivery', 'Admin'].includes(req.user?.role || '');

    // Customer can only cancel their own orders
    if (!isStaff && order.customer_email !== req.user?.email) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You are not authorized to cancel this order.' });
    }

    if (['Delivered', 'Cancelled'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'CANNOT_CANCEL',
        message: `Order cannot be cancelled because it is already '${order.status}'.`,
      });
    }

    // 1. Fetch order items to restore stock
    const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);

    for (const item of itemsRes.rows) {
      if (item.product_id) {
        const prodRes = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
        if (prodRes.rowCount && prodRes.rowCount > 0) {
          const currentStock = Number(prodRes.rows[0].stock);
          const newStock = currentStock + Number(item.quantity);

          await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, item.product_id]);
          await client.query(`
            INSERT INTO inventory_logs (product_id, change_qty, previous_stock, new_stock, reason, reference_id, adjusted_by)
            VALUES ($1, $2, $3, $4, 'CANCELLED_RESTORE', $5, $6)
          `, [item.product_id, item.quantity, currentStock, newStock, id, req.user?.name || 'Order Cancellation']);
        }
      }
    }

    // 2. Update order status
    const updateRes = await client.query(`
      UPDATE orders 
      SET status = 'Cancelled', 
          payment_status = CASE WHEN payment_status = 'Paid' THEN 'Refunded' ELSE payment_status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    // 3. Append timeline entry
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await client.query(`
      INSERT INTO order_timeline (order_id, status, notes, timestamp, is_completed)
      VALUES ($1, 'Cancelled', $2, $3, true)
    `, [id, reason || `Order cancelled by ${req.user?.name || req.user?.email || 'User'}. Inventory restored.`, nowTime]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Order #${id} has been cancelled and stock has been restored.`,
      data: updateRes.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: 'CANCEL_FAILED', message: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/v1/orders/:id/payment - Update order payment status (Staff & Webhook)
ordersRouter.patch('/:id/payment', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod } = req.body;

    const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded'];
    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAYMENT_STATUS',
        message: `Payment status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    let updateSql = 'UPDATE orders SET updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [];

    if (paymentStatus) {
      params.push(paymentStatus);
      updateSql += `, payment_status = $${params.length}`;
    }

    if (paymentMethod) {
      params.push(paymentMethod);
      updateSql += `, payment_method = $${params.length}`;
    }

    params.push(id);
    updateSql += ` WHERE id = $${params.length} RETURNING *`;

    const result = await query(updateSql, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    res.json({
      success: true,
      message: `Payment status for Order #${id} updated to '${paymentStatus || result.rows[0].payment_status}'.`,
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'PAYMENT_UPDATE_FAILED', message: error.message });
  }
});

