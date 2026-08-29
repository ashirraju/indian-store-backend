import { Router, Request, Response } from 'express';
import { query, getClient } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const inventoryRouter = Router();

// GET /api/v1/inventory - Stock levels, low stock warnings, and valuation (Operations, Manager, Admin)
inventoryRouter.get('/', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { lowStockOnly } = req.query;

    let sql = `
      SELECT 
        p.id, p.sku, p.name, p.category, p.sub_category,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        p.price, p.stock, p.low_stock_threshold,
        (p.stock <= p.low_stock_threshold) AS is_low_stock,
        (p.stock * p.price) AS total_inventory_valuation
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
    `;

    if (lowStockOnly === 'true') {
      sql += ' WHERE p.stock <= p.low_stock_threshold';
    }

    sql += ' ORDER BY p.stock ASC';

    const result = await query(sql);

    // Calculate aggregated inventory health metrics
    const totalUnits = result.rows.reduce((sum, r) => sum + Number(r.stock), 0);
    const totalValuation = result.rows.reduce((sum, r) => sum + Number(r.total_inventory_valuation), 0);
    const lowStockCount = result.rows.filter(r => r.is_low_stock).length;

    res.json({
      success: true,
      metrics: {
        totalDistinctSkus: result.rowCount,
        totalUnitsInWarehouse: totalUnits,
        totalWarehouseValuation: totalValuation,
        lowStockAlertsCount: lowStockCount,
      },
      data: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'INVENTORY_FETCH_ERROR', message: error.message });
  }
});

// PATCH /api/v1/inventory/:productId - Atomic stock adjustment with audit logging
inventoryRouter.patch('/:productId', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    const { productId } = req.params;
    const { changeQty, reason, referenceId } = req.body;

    if (typeof changeQty !== 'number' || changeQty === 0) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', message: 'changeQty must be a non-zero integer.' });
    }

    await client.query('BEGIN');

    // 1. Lock product row for update
    const prodRes = await client.query('SELECT id, name, stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (prodRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
    }

    const currentStock = prodRes.rows[0].stock;
    const newStock = currentStock + changeQty;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: `Cannot deduct ${Math.abs(changeQty)} units. Current stock is ${currentStock}.`,
      });
    }

    // 2. Update stock
    await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStock, productId]);

    // 3. Insert audit log
    await client.query(`
      INSERT INTO inventory_logs (
        product_id, change_qty, previous_stock, new_stock, reason, reference_id, adjusted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [productId, changeQty, currentStock, newStock, reason || 'MANUAL_ADJUSTMENT', referenceId || null, req.user?.name || 'Staff']);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Stock updated for ${prodRes.rows[0].name}.`,
      data: {
        productId,
        productName: prodRes.rows[0].name,
        previousStock: currentStock,
        newStock: newStock,
        changeApplied: changeQty,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: 'STOCK_ADJUSTMENT_FAILED', message: error.message });
  } finally {
    client.release();
  }
});

// GET /api/v1/inventory/audit-logs - View inventory movement history
inventoryRouter.get('/audit-logs', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        l.id, l.change_qty, l.previous_stock, l.new_stock, l.reason, l.reference_id, l.adjusted_by, l.created_at,
        p.name AS product_name, p.sku, p.category,
        COALESCE(c.name, 'Uncategorized') AS category_name
      FROM inventory_logs l
      JOIN products p ON l.product_id = p.id
      LEFT JOIN categories c ON p.category = c.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `;
    const result = await query(sql);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'LOGS_FETCH_ERROR', message: error.message });
  }
});
