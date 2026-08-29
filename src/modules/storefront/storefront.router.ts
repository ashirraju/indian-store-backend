import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const storefrontRouter = Router();

// Helper to format storefront configuration response
function formatStorefrontConfig(row: any) {
  if (!row) {
    return {
      storeName: 'Indian Store',
      tagline: 'Authentic Indian Groceries & Essentials Delivered Fast',
      announcementText: '🎉 Grand Festive Sale: Flat 15% OFF on all Authentic Groceries! Use Code FESTIVE15',
      announcementLink: '/offers',
      isAnnouncementActive: true,
      freeShippingThreshold: 999.00,
      supportPhone: '+91 98765 43210',
      supportEmail: 'support@indianstore.com',
      deliverySla: 'Fast 2-Hour Express Delivery',
      currencySymbol: '₹',
      currencyCode: 'INR',
      metadata: {},
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    storeName: row.store_name,
    tagline: row.tagline,
    announcementText: row.announcement_text,
    announcementLink: row.announcement_link,
    isAnnouncementActive: Boolean(row.is_announcement_active),
    freeShippingThreshold: Number(row.free_shipping_threshold || 999.00),
    supportPhone: row.support_phone,
    supportEmail: row.support_email,
    deliverySla: row.delivery_sla,
    currencySymbol: row.currency_symbol || '₹',
    currencyCode: row.currency_code || 'INR',
    metadata: row.metadata || {},
    updatedAt: row.updated_at,
  };
}

// Helper to format promotional banner item
function formatBanner(b: any) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    badge: b.badge,
    imageUrl: b.image_url,
    ctaText: b.cta_text || 'Explore Deals',
    ctaLink: b.cta_link || '/products',
    displayOrder: Number(b.display_order || 0),
    isActive: Boolean(b.is_active),
    placement: b.placement || 'HERO',
    bgGradient: b.bg_gradient || 'from-amber-700 to-orange-900',
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

// ==========================================
// 1. PUBLIC STOREFRONT AGGREGATE DATA
// ==========================================

// GET /api/v1/storefront - Full aggregate storefront data (store config, active banners, announcements)
storefrontRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // 1. Fetch Storefront Configuration
    const configRes = await query('SELECT * FROM storefront_config WHERE id = $1 LIMIT 1', ['default']);
    const configData = formatStorefrontConfig(configRes.rows[0]);

    // 2. Fetch Active Promotional Hero Banners
    const bannersRes = await query(`
      SELECT * FROM promotional_banners 
      WHERE is_active = true 
      ORDER BY display_order ASC, created_at DESC
    `);
    const banners = bannersRes.rows.map(formatBanner);

    // 3. Quick categories list for storefront navigation
    const catRes = await query(`
      SELECT id, name, slug, icon, display_order 
      FROM categories 
      ORDER BY display_order ASC 
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        store: configData,
        announcement: {
          text: configData.announcementText,
          link: configData.announcementLink,
          isActive: configData.isAnnouncementActive,
        },
        banners,
        featuredCategories: catRes.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// ==========================================
// 2. STOREFRONT CONFIG & ANNOUNCEMENT BAR
// ==========================================

// GET /api/v1/storefront/config or /api/v1/storefront/banner-config - Current top bar & store settings
storefrontRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const configRes = await query('SELECT * FROM storefront_config WHERE id = $1 LIMIT 1', ['default']);
    res.json({
      success: true,
      data: formatStorefrontConfig(configRes.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// Alias for frontend matching store.bannerConfig()
storefrontRouter.get('/banner-config', async (_req: Request, res: Response) => {
  try {
    const configRes = await query('SELECT * FROM storefront_config WHERE id = $1 LIMIT 1', ['default']);
    const formatted = formatStorefrontConfig(configRes.rows[0]);
    res.json({
      success: true,
      data: {
        announcementText: formatted.announcementText,
        announcementLink: formatted.announcementLink,
        isAnnouncementActive: formatted.isAnnouncementActive,
        freeShippingThreshold: formatted.freeShippingThreshold,
        deliverySla: formatted.deliverySla,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// PUT /api/v1/storefront/config or PATCH /api/v1/storefront/config - Update announcement bar & store settings (Manager & Admin only)
const handleUpdateConfig = async (req: Request, res: Response) => {
  try {
    const {
      storeName,
      tagline,
      announcementText,
      announcementLink,
      isAnnouncementActive,
      freeShippingThreshold,
      supportPhone,
      supportEmail,
      deliverySla,
      currencySymbol,
      currencyCode,
      metadata,
    } = req.body;

    const upsertSql = `
      INSERT INTO storefront_config (
        id, store_name, tagline, announcement_text, announcement_link, is_announcement_active,
        free_shipping_threshold, support_phone, support_email, delivery_sla, currency_symbol, currency_code, metadata, updated_at
      ) VALUES (
        'default',
        COALESCE($1::varchar, 'Indian Store'),
        COALESCE($2::varchar, 'Authentic Indian Groceries & Essentials Delivered Fast'),
        COALESCE($3::text, '🎉 Grand Festive Sale: Flat 15% OFF on all Authentic Groceries! Use Code FESTIVE15'),
        $4::varchar,
        COALESCE($5::boolean, true),
        COALESCE($6::numeric, 999.00),
        COALESCE($7::varchar, '+91 98765 43210'),
        COALESCE($8::varchar, 'support@indianstore.com'),
        COALESCE($9::varchar, 'Fast 2-Hour Express Delivery'),
        COALESCE($10::varchar, '₹'),
        COALESCE($11::varchar, 'INR'),
        COALESCE($12::jsonb, '{}'::jsonb),
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        store_name = COALESCE($1::varchar, storefront_config.store_name),
        tagline = COALESCE($2::varchar, storefront_config.tagline),
        announcement_text = COALESCE($3::text, storefront_config.announcement_text),
        announcement_link = CASE WHEN $4 IS NOT NULL THEN $4::varchar ELSE storefront_config.announcement_link END,
        is_announcement_active = COALESCE($5::boolean, storefront_config.is_announcement_active),
        free_shipping_threshold = COALESCE($6::numeric, storefront_config.free_shipping_threshold),
        support_phone = COALESCE($7::varchar, storefront_config.support_phone),
        support_email = COALESCE($8::varchar, storefront_config.support_email),
        delivery_sla = COALESCE($9::varchar, storefront_config.delivery_sla),
        currency_symbol = COALESCE($10::varchar, storefront_config.currency_symbol),
        currency_code = COALESCE($11::varchar, storefront_config.currency_code),
        metadata = COALESCE($12::jsonb, storefront_config.metadata),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      storeName,
      tagline,
      announcementText,
      announcementLink !== undefined ? announcementLink : null,
      isAnnouncementActive !== undefined ? Boolean(isAnnouncementActive) : null,
      freeShippingThreshold !== undefined ? Number(freeShippingThreshold) : null,
      supportPhone || null,
      supportEmail || null,
      deliverySla || null,
      currencySymbol || null,
      currencyCode || null,
      metadata ? JSON.stringify(metadata) : null,
    ];

    const result = await query(upsertSql, values);
    res.json({
      success: true,
      message: 'Storefront configuration updated successfully.',
      data: formatStorefrontConfig(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
};

storefrontRouter.put('/config', authGuard, roleGuard('Manager', 'Admin'), handleUpdateConfig);
storefrontRouter.patch('/config', authGuard, roleGuard('Manager', 'Admin'), handleUpdateConfig);

// ==========================================
// 3. PROMOTIONAL HERO BANNERS MANAGEMENT
// ==========================================

// GET /api/v1/storefront/banners - List all banners (Public sees active only, Admin can request ?all=true)
storefrontRouter.get('/banners', async (req: Request, res: Response) => {
  try {
    const { placement, all } = req.query;

    let sql = 'SELECT * FROM promotional_banners WHERE 1=1';
    const params: any[] = [];

    if (all !== 'true') {
      sql += ' AND is_active = true';
    }

    if (placement) {
      params.push(placement);
      sql += ` AND placement = $${params.length}`;
    }

    sql += ' ORDER BY display_order ASC, created_at DESC';

    const result = await query(sql, params);
    res.json({
      success: true,
      totalCount: result.rowCount,
      data: result.rows.map(formatBanner),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// GET /api/v1/storefront/banners/:id - Get single banner details
storefrontRouter.get('/banners/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM promotional_banners WHERE id::text = $1 LIMIT 1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Banner not found.' });
    }

    res.json({
      success: true,
      data: formatBanner(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// POST /api/v1/storefront/banners - Create new promotional banner (Manager & Admin only)
storefrontRouter.post('/banners', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const {
      title,
      subtitle,
      badge,
      imageUrl,
      ctaText,
      ctaLink,
      displayOrder,
      isActive,
      placement,
      bgGradient,
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Banner title is required.' });
    }

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Banner image URL is required.' });
    }

    const insertSql = `
      INSERT INTO promotional_banners (
        title, subtitle, badge, image_url, cta_text, cta_link, display_order, is_active, placement, bg_gradient
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      title.trim(),
      subtitle || '',
      badge || null,
      imageUrl.trim(),
      ctaText || 'Explore Deals',
      ctaLink || '/products',
      displayOrder !== undefined ? Number(displayOrder) : 0,
      isActive !== undefined ? Boolean(isActive) : true,
      placement || 'HERO',
      bgGradient || 'from-amber-700 to-orange-900',
    ];

    const result = await query(insertSql, values);
    res.status(201).json({
      success: true,
      message: 'Promotional banner created successfully.',
      data: formatBanner(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CREATE_FAILED', message: error.message });
  }
});

// PUT /api/v1/storefront/banners/:id - Update banner (Manager & Admin only)
storefrontRouter.put('/banners/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      badge,
      imageUrl,
      ctaText,
      ctaLink,
      displayOrder,
      isActive,
      placement,
      bgGradient,
    } = req.body;

    const checkRes = await query('SELECT * FROM promotional_banners WHERE id::text = $1 LIMIT 1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Banner not found.' });
    }

    const updateSql = `
      UPDATE promotional_banners SET
        title = COALESCE($1::varchar, title),
        subtitle = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE subtitle END,
        badge = CASE WHEN $3::varchar IS NOT NULL THEN $3::varchar ELSE badge END,
        image_url = COALESCE($4::text, image_url),
        cta_text = COALESCE($5::varchar, cta_text),
        cta_link = COALESCE($6::varchar, cta_link),
        display_order = COALESCE($7::int, display_order),
        is_active = COALESCE($8::boolean, is_active),
        placement = COALESCE($9::varchar, placement),
        bg_gradient = COALESCE($10::varchar, bg_gradient),
        updated_at = CURRENT_TIMESTAMP
      WHERE id::text = $11
      RETURNING *
    `;

    const values = [
      title !== undefined ? title.trim() : null,
      subtitle !== undefined ? subtitle : null,
      badge !== undefined ? badge : null,
      imageUrl !== undefined ? imageUrl.trim() : null,
      ctaText !== undefined ? ctaText : null,
      ctaLink !== undefined ? ctaLink : null,
      displayOrder !== undefined ? Number(displayOrder) : null,
      isActive !== undefined ? Boolean(isActive) : null,
      placement !== undefined ? placement : null,
      bgGradient !== undefined ? bgGradient : null,
      id,
    ];

    const result = await query(updateSql, values);
    res.json({
      success: true,
      message: 'Promotional banner updated successfully.',
      data: formatBanner(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// PATCH /api/v1/storefront/banners/:id/toggle - Toggle banner active state (Manager & Admin only)
storefrontRouter.patch('/banners/:id/toggle', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    let updateSql = '';
    let values: any[] = [];

    if (isActive !== undefined) {
      updateSql = 'UPDATE promotional_banners SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2 RETURNING *';
      values = [Boolean(isActive), id];
    } else {
      updateSql = 'UPDATE promotional_banners SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id::text = $1 RETURNING *';
      values = [id];
    }

    const result = await query(updateSql, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Banner not found.' });
    }

    const updated = result.rows[0];
    res.json({
      success: true,
      message: `Banner "${updated.title}" is now ${updated.is_active ? 'active' : 'inactive'}.`,
      data: formatBanner(updated),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'TOGGLE_FAILED', message: error.message });
  }
});

// DELETE /api/v1/storefront/banners/:id - Delete promotional banner (Manager & Admin only)
storefrontRouter.delete('/banners/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT id, title FROM promotional_banners WHERE id::text = $1 LIMIT 1', [id]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Banner not found.' });
    }

    const banner = checkRes.rows[0];
    await query('DELETE FROM promotional_banners WHERE id::text = $1', [id]);

    res.json({
      success: true,
      message: `Promotional banner "${banner.title}" has been deleted.`,
      deletedBannerId: banner.id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'DELETE_FAILED', message: error.message });
  }
});
