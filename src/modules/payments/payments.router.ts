import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';

export const paymentsRouter = Router();

// POST /api/v1/payments/create-intent - Initialize payment gateway order
paymentsRouter.post('/create-intent', authGuard, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    const orderRes = await query('SELECT id, total_amount, payment_status FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    const gatewayOrderId = 'order_rzp_' + Math.random().toString(36).substring(2, 12);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        gatewayOrderId,
        amount: Math.round(Number(order.total_amount) * 100), // in paise / cents
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_123',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'INTENT_CREATION_FAILED', message: error.message });
  }
});

// POST /api/v1/payments/webhook - Payment confirmation webhook
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, gatewayOrderId, status, signature } = req.body;

    // Record payment entry
    await query(`
      INSERT INTO payments (order_id, gateway, gateway_payment_id, gateway_order_id, amount, currency, status, signature_verified, payload)
      VALUES ($1, 'Razorpay', $2, $3, (SELECT total_amount FROM orders WHERE id = $1), 'INR', $4, true, $5)
    `, [orderId, paymentId || 'pay_' + Date.now(), gatewayOrderId || null, status || 'Captured', JSON.stringify(req.body)]);

    if (status === 'Captured' || status === 'Authorized') {
      await query("UPDATE orders SET payment_status = 'Paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [orderId]);
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'WEBHOOK_FAILED', message: error.message });
  }
});
