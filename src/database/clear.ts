import { pool } from '../config/database.js';

async function clearDatabase() {
  console.log('⚠️  Clearing all data from database tables...');

  try {
    await pool.query(`
      TRUNCATE TABLE 
        coupon_redemptions,
        coupons,
        inventory_logs,
        notification_logs,
        order_items,
        order_timeline,
        payments,
        orders,
        products,
        sub_categories,
        categories,
        promotional_banners,
        staff_notifications,
        storefront_config,
        users
      CASCADE;
    `);

    console.log('✅ All data cleared successfully! (Table structures, constraints, and indexes preserved)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearDatabase();
