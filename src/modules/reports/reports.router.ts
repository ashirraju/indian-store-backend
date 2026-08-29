import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const reportsRouter = Router();

// GET /api/v1/reports/sales-revenue - Executive Sales, GMV, and Revenue BI Metrics (Manager & Admin)
reportsRouter.get('/sales-revenue', authGuard, roleGuard('Manager', 'Admin'), async (_req: Request, res: Response) => {
  try {
    // 1. Overall Revenue KPIs
    const kpiRes = await query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS gross_merchandise_value,
        COALESCE(SUM(subtotal), 0) AS net_subtotal,
        COALESCE(SUM(discount_amount), 0) AS total_discounts_given,
        COALESCE(AVG(total_amount), 0) AS average_order_value
      FROM orders
      WHERE status != 'Cancelled'
    `);

    // 2. Revenue grouped by Product Category
    const catRevenueRes = await query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS category_name,
        p.category AS category_id,
        COUNT(oi.id) AS units_sold,
        COALESCE(SUM(oi.total_price), 0) AS category_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'Cancelled'
      GROUP BY c.name, p.category
      ORDER BY category_revenue DESC
    `);

    // 3. Top 5 Best-Selling Products
    const topProductsRes = await query(`
      SELECT 
        oi.product_name,
        SUM(oi.quantity) AS total_quantity_sold,
        SUM(oi.total_price) AS total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'Cancelled'
      GROUP BY oi.product_name
      ORDER BY total_quantity_sold DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      summary: {
        totalOrders: Number(kpiRes.rows[0].total_orders),
        gmv: Number(kpiRes.rows[0].gross_merchandise_value),
        netSubtotal: Number(kpiRes.rows[0].net_subtotal),
        totalDiscountsGiven: Number(kpiRes.rows[0].total_discounts_given),
        aov: Math.round(Number(kpiRes.rows[0].average_order_value) * 100) / 100,
      },
      categoryBreakdown: catRevenueRes.rows,
      topSellingProducts: topProductsRes.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'REPORT_FAILED', message: error.message });
  }
});

// GET /api/v1/reports/inventory-turnover - Stock health & alerts (Operations, Manager, Admin)
reportsRouter.get('/inventory-turnover', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (_req: Request, res: Response) => {
  try {
    const stockRes = await query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') AS category_name,
        p.category AS category_id,
        COUNT(*) AS distinct_products,
        SUM(p.stock) AS total_stock_on_hand,
        SUM(p.stock * p.price) AS total_category_valuation,
        COUNT(CASE WHEN p.stock <= p.low_stock_threshold THEN 1 END) AS low_stock_items_count
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      GROUP BY c.name, p.category
      ORDER BY total_stock_on_hand ASC
    `);

    const lowStockAlerts = await query(`
      SELECT 
        p.id, p.sku, p.name, p.category, p.sub_category,
        COALESCE(c.name, 'Uncategorized') AS category_name,
        p.stock, p.low_stock_threshold, p.price
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      WHERE p.stock <= p.low_stock_threshold
      ORDER BY p.stock ASC
    `);

    res.json({
      success: true,
      categoryInventorySummary: stockRes.rows,
      lowStockAlerts: lowStockAlerts.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'REPORT_FAILED', message: error.message });
  }
});

// GET /api/v1/reports/delivery-sla - Fulfillment & Delivery SLA report (Manager, Operations, Admin)
reportsRouter.get('/delivery-sla', authGuard, roleGuard('Manager', 'Operations', 'Admin'), async (_req: Request, res: Response) => {
  try {
    const statusBreakdown = await query(`
      SELECT status, COUNT(*) AS count
      FROM orders
      GROUP BY status
    `);

    const agentWorkload = await query(`
      SELECT assigned_delivery_agent, COUNT(*) AS active_deliveries
      FROM orders
      WHERE status IN ('Ready for Dispatch', 'Out for Delivery') AND assigned_delivery_agent != 'Unassigned'
      GROUP BY assigned_delivery_agent
    `);

    res.json({
      success: true,
      orderStatusDistribution: statusBreakdown.rows,
      agentActiveDeliveries: agentWorkload.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'REPORT_FAILED', message: error.message });
  }
});
