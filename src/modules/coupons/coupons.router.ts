import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const couponsRouter = Router();

// GET /api/v1/coupons - List all public active offers & coupons
couponsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT id, code, badge, title, discount_type, discount_value, min_order_amount, max_discount_cap, valid_to
      FROM coupons
      WHERE is_active = true AND valid_to >= CURRENT_TIMESTAMP AND (max_uses_total IS NULL OR current_uses_count < max_uses_total)
      ORDER BY created_at DESC
    `;
    const result = await query(sql);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// POST /api/v1/coupons/validate - Validate coupon against cart subtotal & user usage limit
couponsRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal, userEmail } = req.body;

    if (!code || typeof subtotal !== 'number') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Coupon code and numeric subtotal are required.' });
    }

    const couponRes = await query('SELECT * FROM coupons WHERE code = $1 LIMIT 1', [code.toUpperCase().trim()]);
    if (couponRes.rowCount === 0) {
      return res.status(404).json({ success: false, valid: false, message: 'Invalid promo code.' });
    }

    const coupon = couponRes.rows[0];

    // 1. Active & Date check
    if (!coupon.is_active || new Date(coupon.valid_to) < new Date()) {
      return res.status(400).json({ success: false, valid: false, message: 'This promo coupon has expired.' });
    }

    // 2. Minimum Order Amount check
    if (subtotal < Number(coupon.min_order_amount)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Minimum cart value of ₹${coupon.min_order_amount} required to apply this coupon.`,
      });
    }

    // 3. Campaign total uses check
    if (coupon.max_uses_total && coupon.current_uses_count >= coupon.max_uses_total) {
      return res.status(400).json({ success: false, valid: false, message: 'Coupon usage limit reached.' });
    }

    // 4. Per-user redemption check
    if (userEmail && coupon.max_uses_per_user) {
      const redemptionsRes = await query(
        'SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = $1 AND user_email = $2',
        [coupon.id, userEmail]
      );
      const userRedemptions = Number(redemptionsRes.rows[0].count);
      if (userRedemptions >= coupon.max_uses_per_user) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'You have already utilized this offer the maximum allowed number of times.',
        });
      }
    }

    // 5. Calculate Discount
    let discountAmount = 0;
    if (coupon.discount_type === 'PERCENTAGE') {
      discountAmount = (subtotal * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount_cap && discountAmount > Number(coupon.max_discount_cap)) {
        discountAmount = Number(coupon.max_discount_cap);
      }
    } else {
      // FLAT discount
      discountAmount = Math.min(Number(coupon.discount_value), subtotal);
    }

    res.json({
      success: true,
      valid: true,
      data: {
        code: coupon.code,
        title: coupon.title,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountAmount: Math.round(discountAmount * 100) / 100,
        netPayable: Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'VALIDATION_ERROR', message: error.message });
  }
});

// POST /api/v1/coupons - Create coupon campaign (Manager & Admin only)
couponsRouter.post('/', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const {
      code,
      badge,
      title,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountCap,
      maxUsesTotal,
      maxUsesPerUser,
      validTo,
    } = req.body;

    const sql = `
      INSERT INTO coupons (
        code, badge, title, discount_type, discount_value, min_order_amount,
        max_discount_cap, max_uses_total, max_uses_per_user, valid_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await query(sql, [
      code.toUpperCase().trim(),
      badge || 'SPECIAL OFFER',
      title,
      discountType,
      discountValue,
      minOrderAmount || 0,
      maxDiscountCap || null,
      maxUsesTotal || 1000,
      maxUsesPerUser || 1,
      validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    ]);

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CREATE_FAILED', message: error.message });
  }
});
