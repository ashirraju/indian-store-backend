import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const categoriesRouter = Router();

// Helper to generate URL-safe slug from name
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ==========================================
// 1. CATEGORIES CRUD ENDPOINTS
// ==========================================

// GET /api/v1/categories - List all categories with nested sub-categories and product counts
categoriesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const catSql = `
      SELECT 
        c.id, c.name, c.slug, c.icon, c.display_order, c.created_at,
        COUNT(DISTINCT p.id) AS products_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.id
      GROUP BY c.id, c.name, c.slug, c.icon, c.display_order, c.created_at
      ORDER BY c.display_order ASC, c.name ASC
    `;
    const catRes = await query(catSql);

    const subCatSql = `
      SELECT 
        sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at,
        COUNT(DISTINCT p.id) AS products_count
      FROM sub_categories sc
      LEFT JOIN products p ON p.sub_category = sc.id
      GROUP BY sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at
      ORDER BY sc.display_order ASC, sc.name ASC
    `;
    const subCatRes = await query(subCatSql);

    // Map sub-categories under parent category
    const subCatMap = new Map<string, any[]>();
    for (const sc of subCatRes.rows) {
      const list = subCatMap.get(sc.category_id) || [];
      list.push({
        id: sc.id,
        name: sc.name,
        slug: sc.slug,
        display_order: Number(sc.display_order || 0),
        products_count: Number(sc.products_count || 0),
        created_at: sc.created_at,
      });
      subCatMap.set(sc.category_id, list);
    }

    const data = catRes.rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      display_order: Number(c.display_order || 0),
      products_count: Number(c.products_count || 0),
      created_at: c.created_at,
      sub_categories: subCatMap.get(c.id) || [],
    }));

    res.json({
      success: true,
      totalCount: data.length,
      data,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_FAILED', message: error.message });
  }
});

// GET /api/v1/categories/:id - Single category with its sub-categories
categoriesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const catSql = `
      SELECT 
        c.id, c.name, c.slug, c.icon, c.display_order, c.created_at,
        COUNT(DISTINCT p.id) AS products_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.id
      WHERE c.id::text = $1 OR c.slug = $1
      GROUP BY c.id, c.name, c.slug, c.icon, c.display_order, c.created_at
      LIMIT 1
    `;
    const catRes = await query(catSql, [id]);

    if (catRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Category not found.' });
    }

    const category = catRes.rows[0];

    const subCatSql = `
      SELECT 
        sc.id, sc.name, sc.slug, sc.display_order, sc.created_at,
        COUNT(DISTINCT p.id) AS products_count
      FROM sub_categories sc
      LEFT JOIN products p ON p.sub_category = sc.id
      WHERE sc.category_id = $1
      GROUP BY sc.id, sc.name, sc.slug, sc.display_order, sc.created_at
      ORDER BY sc.display_order ASC, sc.name ASC
    `;
    const subCatRes = await query(subCatSql, [category.id]);

    res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        display_order: Number(category.display_order || 0),
        products_count: Number(category.products_count || 0),
        created_at: category.created_at,
        sub_categories: subCatRes.rows.map((sc) => ({
          id: sc.id,
          name: sc.name,
          slug: sc.slug,
          display_order: Number(sc.display_order || 0),
          products_count: Number(sc.products_count || 0),
          created_at: sc.created_at,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_FAILED', message: error.message });
  }
});

// POST /api/v1/categories - Create category (Manager & Admin only)
categoriesRouter.post('/', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, displayOrder } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Category name is required.' });
    }

    const catSlug = slug ? generateSlug(slug) : generateSlug(name);

    // Check unique name / slug
    const existing = await query('SELECT id FROM categories WHERE name ILIKE $1 OR slug = $2 LIMIT 1', [name.trim(), catSlug]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ success: false, error: 'CONFLICT', message: 'Category with this name or slug already exists.' });
    }

    const insertSql = `
      INSERT INTO categories (name, slug, icon, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(insertSql, [name.trim(), catSlug, icon || null, Number(displayOrder || 0)]);

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: {
        ...result.rows[0],
        products_count: 0,
        sub_categories: [],
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CREATE_FAILED', message: error.message });
  }
});

// PUT /api/v1/categories/:id - Update category (Manager & Admin only)
categoriesRouter.put('/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, icon, displayOrder } = req.body;

    const catRes = await query('SELECT * FROM categories WHERE id::text = $1 LIMIT 1', [id]);
    if (catRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Category not found.' });
    }
    const current = catRes.rows[0];

    const newName = name ? name.trim() : current.name;
    const newSlug = slug ? generateSlug(slug) : (name ? generateSlug(name) : current.slug);
    const newIcon = icon !== undefined ? icon : current.icon;
    const newOrder = displayOrder !== undefined ? Number(displayOrder) : current.display_order;

    const updateSql = `
      UPDATE categories
      SET name = $1, slug = $2, icon = $3, display_order = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await query(updateSql, [newName, newSlug, newIcon, newOrder, current.id]);

    res.json({
      success: true,
      message: 'Category updated successfully.',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// DELETE /api/v1/categories/:id - Delete category (Manager & Admin only)
categoriesRouter.delete('/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const catRes = await query('SELECT * FROM categories WHERE id::text = $1 LIMIT 1', [id]);
    if (catRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Category not found.' });
    }
    const category = catRes.rows[0];

    // Optional safety: Check if products are linked
    const prodCountRes = await query('SELECT COUNT(*) AS count FROM products WHERE category = $1', [category.id]);
    const linkedProducts = Number(prodCountRes.rows[0].count);

    if (linkedProducts > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'HAS_LINKED_PRODUCTS',
        message: `Category has ${linkedProducts} linked products. Reassign products or pass ?force=true to unlink and delete.`,
      });
    }

    // If force delete or no products: Unlink products category reference first if needed
    if (linkedProducts > 0) {
      await query('UPDATE products SET category = NULL, sub_category = NULL WHERE category = $1', [category.id]);
    }

    await query('DELETE FROM categories WHERE id = $1', [category.id]);

    res.json({
      success: true,
      message: `Category "${category.name}" deleted successfully.`,
      deletedCategoryId: category.id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'DELETE_FAILED', message: error.message });
  }
});


// ==========================================
// 2. SUB-CATEGORIES CRUD ENDPOINTS
// ==========================================

// GET /api/v1/sub-categories - List all sub-categories with parent category details
categoriesRouter.get('/sub-categories/all', async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at,
        c.name AS category_name, c.slug AS category_slug,
        COUNT(DISTINCT p.id) AS products_count
      FROM sub_categories sc
      JOIN categories c ON sc.category_id = c.id
      LEFT JOIN products p ON p.sub_category = sc.id
      GROUP BY sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at, c.name, c.slug
      ORDER BY c.display_order ASC, sc.display_order ASC, sc.name ASC
    `;
    const result = await query(sql);

    res.json({
      success: true,
      totalCount: result.rowCount,
      data: result.rows.map((r) => ({
        id: r.id,
        category_id: r.category_id,
        category_name: r.category_name,
        category_slug: r.category_slug,
        name: r.name,
        slug: r.slug,
        display_order: Number(r.display_order || 0),
        products_count: Number(r.products_count || 0),
        created_at: r.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_FAILED', message: error.message });
  }
});

// GET /api/v1/categories/:categoryId/sub-categories - List subcategories of a specific category
categoriesRouter.get('/:categoryId/sub-categories', async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const sql = `
      SELECT 
        sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at,
        c.name AS category_name,
        COUNT(DISTINCT p.id) AS products_count
      FROM sub_categories sc
      JOIN categories c ON sc.category_id = c.id
      LEFT JOIN products p ON p.sub_category = sc.id
      WHERE sc.category_id::text = $1 OR c.slug = $1
      GROUP BY sc.id, sc.category_id, sc.name, sc.slug, sc.display_order, sc.created_at, c.name
      ORDER BY sc.display_order ASC, sc.name ASC
    `;
    const result = await query(sql, [categoryId]);

    res.json({
      success: true,
      totalCount: result.rowCount,
      data: result.rows.map((r) => ({
        id: r.id,
        category_id: r.category_id,
        category_name: r.category_name,
        name: r.name,
        slug: r.slug,
        display_order: Number(r.display_order || 0),
        products_count: Number(r.products_count || 0),
        created_at: r.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_FAILED', message: error.message });
  }
});

// POST /api/v1/categories/:categoryId/sub-categories or POST /api/v1/categories/sub-categories - Create subcategory (Manager & Admin only)
categoriesRouter.post('/:categoryId/sub-categories', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { name, slug, displayOrder } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Sub-category name is required.' });
    }

    // Verify parent category exists
    const catRes = await query('SELECT id, name FROM categories WHERE id::text = $1 OR slug = $1 LIMIT 1', [categoryId]);
    if (catRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'CATEGORY_NOT_FOUND', message: 'Parent category not found.' });
    }
    const parentCat = catRes.rows[0];

    const scSlug = slug ? generateSlug(slug) : generateSlug(name);

    // Check unique slug within parent category
    const existing = await query('SELECT id FROM sub_categories WHERE category_id = $1 AND (name ILIKE $2 OR slug = $3) LIMIT 1', [
      parentCat.id,
      name.trim(),
      scSlug,
    ]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ success: false, error: 'CONFLICT', message: 'Sub-category already exists in this category.' });
    }

    const insertSql = `
      INSERT INTO sub_categories (category_id, name, slug, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(insertSql, [parentCat.id, name.trim(), scSlug, Number(displayOrder || 0)]);

    res.status(201).json({
      success: true,
      message: 'Sub-category created successfully.',
      data: {
        ...result.rows[0],
        category_name: parentCat.name,
        products_count: 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CREATE_FAILED', message: error.message });
  }
});

// PUT /api/v1/categories/sub-categories/:id - Update subcategory (Manager & Admin only)
categoriesRouter.put('/sub-categories/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, displayOrder, categoryId } = req.body;

    const scRes = await query('SELECT * FROM sub_categories WHERE id::text = $1 LIMIT 1', [id]);
    if (scRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Sub-category not found.' });
    }
    const current = scRes.rows[0];

    const newCategoryId = categoryId || current.category_id;
    const newName = name ? name.trim() : current.name;
    const newSlug = slug ? generateSlug(slug) : (name ? generateSlug(name) : current.slug);
    const newOrder = displayOrder !== undefined ? Number(displayOrder) : current.display_order;

    const updateSql = `
      UPDATE sub_categories
      SET category_id = $1, name = $2, slug = $3, display_order = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await query(updateSql, [newCategoryId, newName, newSlug, newOrder, current.id]);

    res.json({
      success: true,
      message: 'Sub-category updated successfully.',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// DELETE /api/v1/categories/sub-categories/:id - Delete subcategory (Manager & Admin only)
categoriesRouter.delete('/sub-categories/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const scRes = await query('SELECT * FROM sub_categories WHERE id::text = $1 LIMIT 1', [id]);
    if (scRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Sub-category not found.' });
    }
    const subCat = scRes.rows[0];

    // Unlink any products using this subcategory
    await query('UPDATE products SET sub_category = NULL WHERE sub_category = $1', [subCat.id]);
    await query('DELETE FROM sub_categories WHERE id = $1', [subCat.id]);

    res.json({
      success: true,
      message: `Sub-category "${subCat.name}" deleted successfully.`,
      deletedSubCategoryId: subCat.id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'DELETE_FAILED', message: error.message });
  }
});
