import { Router, Request, Response } from 'express';
import { query, getClient } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';

export const productsRouter = Router();

// Helper to compute discount fields and stock status for Frontend presentation
function formatProductResponse(p: any) {
  const originalPrice = p.original_price != null ? Number(p.original_price) : Number(p.price);
  const sellingPrice = Number(p.price);
  const savingsAmount = Math.max(0, Math.round((originalPrice - sellingPrice) * 100) / 100);
  const hasDiscount = savingsAmount > 0;

  let discountPercent = 0;
  if (hasDiscount && originalPrice > 0) {
    discountPercent = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
  }

  const stock = Number(p.stock || 0);
  const lowStockThreshold = Number(p.low_stock_threshold || 10);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= lowStockThreshold;

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    category: p.category,
    sub_category: p.sub_category,
    category_name: p.category_name || null,
    category_slug: p.category_slug || null,
    sub_category_name: p.sub_category_name || null,
    sub_category_slug: p.sub_category_slug || null,

    // Pricing & Discount details for Frontend UI
    price: sellingPrice,
    discounted_price: sellingPrice,
    original_price: originalPrice,
    discount_type: p.discount_type || (hasDiscount ? 'PERCENTAGE' : 'NONE'),
    discount_value: p.discount_value != null ? Number(p.discount_value) : (hasDiscount ? discountPercent : 0),
    discount_percent: discountPercent,
    savings_amount: savingsAmount,
    has_discount: hasDiscount,

    // Stock & Inventory Health
    stock: stock,
    low_stock_threshold: lowStockThreshold,
    is_low_stock: isLowStock,
    is_out_of_stock: isOutOfStock,
    stock_status: isOutOfStock ? 'OUT_OF_STOCK' : (isLowStock ? 'LOW_STOCK' : 'IN_STOCK'),

    // Catalog & Metadata
    rating: Number(p.rating || 5.0),
    reviews_count: Number(p.reviews_count || 0),
    image_url: p.image_url,
    description: p.description,
    weight: p.weight,
    is_organic: Boolean(p.is_organic),
    is_bestseller: Boolean(p.is_bestseller),
    origin_region: p.origin_region,
    tags: p.tags || [],
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

// Helper to calculate original and discounted prices from input
function calculatePrices(input: {
  originalPrice?: number;
  price?: number;
  discountType?: string;
  discountValue?: number;
}) {
  let originalPrice = input.originalPrice ? Number(input.originalPrice) : undefined;
  let price = input.price ? Number(input.price) : undefined;
  let discountType = input.discountType ? input.discountType.toUpperCase() : undefined;
  let discountValue = input.discountValue != null ? Number(input.discountValue) : undefined;

  // 1. If discountType & discountValue provided with originalPrice
  if (originalPrice != null && discountType && discountValue != null && discountValue > 0) {
    if (discountType === 'PERCENTAGE') {
      const discountAmount = (originalPrice * discountValue) / 100;
      price = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);
    } else if (discountType === 'FLAT') {
      price = Math.max(0, Math.round((originalPrice - discountValue) * 100) / 100);
    }
  } else if (originalPrice != null && price != null) {
    // 2. If both originalPrice and price provided, deduce discount
    if (originalPrice > price) {
      discountType = 'PERCENTAGE';
      discountValue = Math.round(((originalPrice - price) / originalPrice) * 10000) / 100;
    } else {
      discountType = 'NONE';
      discountValue = 0;
    }
  } else if (price != null && originalPrice == null) {
    // 3. Only selling price provided
    originalPrice = price;
    discountType = 'NONE';
    discountValue = 0;
  } else if (originalPrice != null && price == null) {
    // 4. Only original price provided with no discount
    price = originalPrice;
    discountType = 'NONE';
    discountValue = 0;
  }

  return {
    originalPrice: originalPrice ?? 0,
    price: price ?? 0,
    discountType: discountType || 'NONE',
    discountValue: discountValue ?? 0,
  };
}

// ==========================================
// 1. ADMIN PRODUCTS DASHBOARD SUMMARY
// ==========================================

// GET /api/v1/products/admin/summary - Top-level metrics for admin products management page
productsRouter.get('/admin/summary', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (_req: Request, res: Response) => {
  try {
    const summarySql = `
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(stock), 0) AS total_units_in_stock,
        COALESCE(SUM(stock * price), 0) AS total_catalog_valuation,
        COUNT(CASE WHEN stock <= 0 THEN 1 END) AS out_of_stock_count,
        COUNT(CASE WHEN stock > 0 AND stock <= low_stock_threshold THEN 1 END) AS low_stock_count,
        COUNT(CASE WHEN original_price > price THEN 1 END) AS discounted_products_count,
        COUNT(CASE WHEN is_organic = true THEN 1 END) AS organic_products_count,
        COUNT(CASE WHEN is_bestseller = true THEN 1 END) AS bestseller_products_count
      FROM products
    `;
    const summaryRes = await query(summarySql);
    const row = summaryRes.rows[0];

    res.json({
      success: true,
      data: {
        totalProducts: Number(row.total_products),
        totalUnitsInStock: Number(row.total_units_in_stock),
        totalCatalogValuation: Number(row.total_catalog_valuation),
        outOfStockCount: Number(row.out_of_stock_count),
        lowStockCount: Number(row.low_stock_count),
        discountedProductsCount: Number(row.discounted_products_count),
        organicProductsCount: Number(row.organic_products_count),
        bestsellerProductsCount: Number(row.bestseller_products_count),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SUMMARY_FAILED', message: error.message });
  }
});

// ==========================================
// 2. PRODUCT CATALOG LIST WITH PAGINATION
// ==========================================

// GET /api/v1/products - Browse catalog with filters, search, sorting & pagination
productsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      subCategory,
      search,
      organic,
      bestseller,
      stockStatus, // 'in_stock', 'low_stock', 'out_of_stock'
      hasDiscount, // 'true', 'false'
      sort,
      page,
      limit,
    } = req.query;

    let baseFilterSql = ' WHERE 1=1';
    const params: any[] = [];

    if (category && category !== 'All Categories' && category !== 'All') {
      params.push(category);
      baseFilterSql += ` AND (p.category::text = $${params.length} OR c.name ILIKE $${params.length} OR c.slug ILIKE $${params.length})`;
    }

    if (subCategory && subCategory !== 'All') {
      params.push(`%${subCategory}%`);
      baseFilterSql += ` AND (sc.name ILIKE $${params.length} OR sc.slug ILIKE $${params.length} OR p.name ILIKE $${params.length} OR $${params.length} = ANY(p.tags))`;
    }

    if (search) {
      params.push(`%${search}%`);
      baseFilterSql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.origin_region ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    if (organic === 'true') {
      baseFilterSql += ' AND p.is_organic = true';
    }

    if (bestseller === 'true') {
      baseFilterSql += ' AND p.is_bestseller = true';
    }

    if (stockStatus === 'out_of_stock') {
      baseFilterSql += ' AND p.stock <= 0';
    } else if (stockStatus === 'low_stock') {
      baseFilterSql += ' AND p.stock > 0 AND p.stock <= p.low_stock_threshold';
    } else if (stockStatus === 'in_stock') {
      baseFilterSql += ' AND p.stock > 0';
    }

    if (hasDiscount === 'true') {
      baseFilterSql += ' AND p.original_price > p.price';
    }

    // Get total matching count
    const countSql = `
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      ${baseFilterSql}
    `;
    const countRes = await query(countSql, params);
    const totalCount = Number(countRes.rows[0].total);

    let sql = `
      SELECT 
        p.id, p.sku, p.name, p.slug, p.category, p.sub_category,
        c.name AS category_name, c.slug AS category_slug,
        sc.name AS sub_category_name, sc.slug AS sub_category_slug,
        p.price, p.original_price, p.discount_type, p.discount_value,
        p.rating, p.reviews_count, p.image_url,
        p.description, p.weight, p.stock, p.low_stock_threshold,
        p.is_organic, p.is_bestseller, p.origin_region, p.tags,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      ${baseFilterSql}
    `;

    // Sorting
    switch (sort) {
      case 'price-low':
        sql += ' ORDER BY p.price ASC';
        break;
      case 'price-high':
        sql += ' ORDER BY p.price DESC';
        break;
      case 'name-asc':
        sql += ' ORDER BY p.name ASC';
        break;
      case 'name-desc':
        sql += ' ORDER BY p.name DESC';
        break;
      case 'stock-low':
        sql += ' ORDER BY p.stock ASC';
        break;
      case 'stock-high':
        sql += ' ORDER BY p.stock DESC';
        break;
      case 'rating':
        sql += ' ORDER BY p.rating DESC';
        break;
      case 'newest':
        sql += ' ORDER BY p.created_at DESC';
        break;
      default:
        sql += ' ORDER BY p.is_bestseller DESC, p.reviews_count DESC, p.created_at DESC';
    }

    // Server-side Pagination
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const limitNum = limit ? Math.min(200, Math.max(1, Number(limit))) : 50;
    const offset = (pageNum - 1) * limitNum;

    if (page || limit) {
      params.push(limitNum, offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const result = await query(sql, params);
    const formattedProducts = result.rows.map(formatProductResponse);

    res.json({
      success: true,
      totalCount,
      page: page ? pageNum : 1,
      limit: limit ? limitNum : totalCount,
      totalPages: Math.ceil(totalCount / (limit ? limitNum : Math.max(1, totalCount))),
      data: formattedProducts,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CATALOG_FETCH_FAILED', message: error.message });
  }
});

// ==========================================
// 2. PRODUCT SEARCH & AUTOCOMPLETE SUGGESTIONS
// ==========================================

// GET /api/v1/products/search/suggestions - Instant typeahead suggestions for search bar dropdown
productsRouter.get('/search/suggestions', async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.q || req.query.search || req.query.query || '') as string;
    const q = rawQuery.trim();

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        query: q,
        suggestions: [],
        categories: [],
      });
    }

    const searchPattern = `%${q}%`;

    // 1. Matched products (searches product name, SKU, category, sub-category, and tags)
    const productSql = `
      SELECT 
        p.id, p.name, p.slug, p.price, p.original_price, p.image_url, p.weight, p.stock, p.low_stock_threshold,
        c.name AS category_name, c.slug AS category_slug,
        sc.name AS sub_category_name, sc.slug AS sub_category_slug
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      WHERE (
        p.name ILIKE $1 OR 
        p.sku ILIKE $1 OR 
        c.name ILIKE $1 OR 
        c.slug ILIKE $1 OR 
        sc.name ILIKE $1 OR 
        sc.slug ILIKE $1 OR 
        $1 = ANY(p.tags)
      )
      ORDER BY 
        CASE 
          WHEN p.name ILIKE $2 THEN 0 
          WHEN p.name ILIKE $1 THEN 1 
          WHEN sc.name ILIKE $1 THEN 2
          WHEN c.name ILIKE $1 THEN 3
          ELSE 4 
        END,
        p.is_bestseller DESC,
        p.rating DESC
      LIMIT 8
    `;

    // 2. Matched categories (limit 3)
    const categorySql = `
      SELECT id, name, slug
      FROM categories
      WHERE name ILIKE $1 OR slug ILIKE $1
      ORDER BY display_order ASC
      LIMIT 3
    `;

    // 3. Matched sub-categories (limit 3, includes parent category context)
    const subCategorySql = `
      SELECT 
        sc.id, sc.name, sc.slug,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug
      FROM sub_categories sc
      JOIN categories c ON sc.category_id = c.id
      WHERE sc.name ILIKE $1 OR sc.slug ILIKE $1
      ORDER BY sc.display_order ASC
      LIMIT 3
    `;

    const [productRes, categoryRes, subCategoryRes] = await Promise.all([
      query(productSql, [searchPattern, `${q}%`]),
      query(categorySql, [searchPattern]),
      query(subCategorySql, [searchPattern]),
    ]);

    const suggestions = productRes.rows.map((p) => {
      const originalPrice = p.original_price != null ? Number(p.original_price) : Number(p.price);
      const sellingPrice = Number(p.price);
      const hasDiscount = originalPrice > sellingPrice;
      const discountPercent = hasDiscount ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100) : 0;
      const stock = Number(p.stock || 0);

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: sellingPrice,
        originalPrice: originalPrice,
        discountPercent,
        hasDiscount,
        imageUrl: p.image_url,
        weight: p.weight,
        isOutOfStock: stock <= 0,
        categoryName: p.category_name,
        categorySlug: p.category_slug,
        subCategoryName: p.sub_category_name,
        subCategorySlug: p.sub_category_slug,
      };
    });

    res.json({
      success: true,
      query: q,
      totalSuggestions: suggestions.length,
      suggestions,
      categories: categoryRes.rows,
      subCategories: subCategoryRes.rows,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SUGGESTIONS_FAILED', message: error.message });
  }
});

// GET /api/v1/products/search - Full catalog search with relevance sorting and filters
productsRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.q || req.query.search || req.query.query || '') as string;
    const q = rawQuery.trim();
    const { category, subCategory, minPrice, maxPrice, organic, inStock, sort, page, limit } = req.query;

    const params: any[] = [];
    let filterSql = ' WHERE 1=1';

    let qIdx = 0;
    if (q) {
      params.push(`%${q}%`);
      qIdx = params.length;

      filterSql += ` AND (
        p.name ILIKE $${qIdx} OR 
        p.sku ILIKE $${qIdx} OR 
        p.description ILIKE $${qIdx} OR 
        p.origin_region ILIKE $${qIdx} OR 
        c.name ILIKE $${qIdx} OR 
        c.slug ILIKE $${qIdx} OR 
        sc.name ILIKE $${qIdx} OR 
        sc.slug ILIKE $${qIdx} OR 
        $${qIdx} = ANY(p.tags)
      )`;
    }

    if (category && category !== 'All' && category !== 'All Categories') {
      params.push(category);
      filterSql += ` AND (p.category::text = $${params.length} OR c.slug ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    if (subCategory && subCategory !== 'All' && subCategory !== 'All Sub-Categories') {
      params.push(subCategory);
      filterSql += ` AND (p.sub_category::text = $${params.length} OR sc.slug ILIKE $${params.length} OR sc.name ILIKE $${params.length})`;
    }

    if (minPrice != null && minPrice !== '') {
      params.push(Number(minPrice));
      filterSql += ` AND p.price >= $${params.length}`;
    }

    if (maxPrice != null && maxPrice !== '') {
      params.push(Number(maxPrice));
      filterSql += ` AND p.price <= $${params.length}`;
    }

    if (organic === 'true') {
      filterSql += ' AND p.is_organic = true';
    }

    if (inStock === 'true') {
      filterSql += ' AND p.stock > 0';
    }

    // Total count query with exact filter params
    const countSql = `
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      ${filterSql}
    `;
    const countRes = await query(countSql, [...params]);
    const totalCount = Number(countRes.rows[0].total);

    // Main query
    let sql = `
      SELECT 
        p.id, p.sku, p.name, p.slug, p.category, p.sub_category,
        c.name AS category_name, c.slug AS category_slug,
        sc.name AS sub_category_name, sc.slug AS sub_category_slug,
        p.price, p.original_price, p.discount_type, p.discount_value,
        p.rating, p.reviews_count, p.image_url,
        p.description, p.weight, p.stock, p.low_stock_threshold,
        p.is_organic, p.is_bestseller, p.origin_region, p.tags,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      ${filterSql}
    `;

    // Relevance and Sorting
    if (sort === 'price-asc') {
      sql += ' ORDER BY p.price ASC';
    } else if (sort === 'price-desc') {
      sql += ' ORDER BY p.price DESC';
    } else if (sort === 'rating') {
      sql += ' ORDER BY p.rating DESC, p.reviews_count DESC';
    } else if (sort === 'newest') {
      sql += ' ORDER BY p.created_at DESC';
    } else if (q) {
      params.push(`${q}%`);
      const prefixIdx = params.length;
      sql += ` ORDER BY 
        CASE 
          WHEN p.name ILIKE $${prefixIdx} THEN 0 
          WHEN p.name ILIKE $${qIdx} THEN 1 
          WHEN sc.name ILIKE $${qIdx} OR sc.slug ILIKE $${qIdx} THEN 2
          WHEN c.name ILIKE $${qIdx} OR c.slug ILIKE $${qIdx} THEN 3
          ELSE 4 
        END,
        p.is_bestseller DESC,
        p.rating DESC,
        p.reviews_count DESC`;
    } else {
      sql += ' ORDER BY p.is_bestseller DESC, p.rating DESC, p.created_at DESC';
    }



    // Pagination
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, Number(limit))) : 20;
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(sql, params);
    const formatted = result.rows.map(formatProductResponse);

    res.json({
      success: true,
      query: q,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: formatted,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SEARCH_FAILED', message: error.message });
  }
});

// ==========================================
// 3. PRODUCT CRUD & ADMIN OPERATIONS
// ==========================================

// GET /api/v1/products/:id - Single product details
productsRouter.get('/:id', async (req: Request, res: Response) => {

  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        p.id, p.sku, p.name, p.slug, p.category, p.sub_category,
        c.name AS category_name, c.slug AS category_slug,
        sc.name AS sub_category_name, sc.slug AS sub_category_slug,
        p.price, p.original_price, p.discount_type, p.discount_value,
        p.rating, p.reviews_count, p.image_url,
        p.description, p.weight, p.stock, p.low_stock_threshold,
        p.is_organic, p.is_bestseller, p.origin_region, p.tags,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category = c.id
      LEFT JOIN sub_categories sc ON p.sub_category = sc.id
      WHERE p.id = $1 OR p.sku = $1 OR p.slug = $1
      LIMIT 1
    `;
    const result = await query(sql, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }

    res.json({ success: true, data: formatProductResponse(result.rows[0]) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// POST /api/v1/products - Create product (Manager & Admin only)
productsRouter.post('/', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const {
      id,
      sku,
      name,
      slug,
      category,
      categoryId,
      subCategory,
      subCategoryId,
      originalPrice,
      price,
      discountType,
      discountValue,
      rating,
      reviewsCount,
      imageUrl,
      description,
      weight,
      stock,
      lowStockThreshold,
      isOrganic,
      isBestseller,
      originRegion,
      tags,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Product name is required.' });
    }

    const prodId = id || 'p-' + Date.now();
    const prodSku = sku || 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const prodSlug = slug || (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substring(2, 6));
    const prodCategory = category || categoryId || null;
    const prodSubCategory = subCategory || subCategoryId || null;

    // Compute pricing and discounts
    const pricing = calculatePrices({ originalPrice, price, discountType, discountValue });

    const sql = `
      INSERT INTO products (
        id, sku, name, slug, category, sub_category, price, original_price,
        discount_type, discount_value,
        rating, reviews_count, image_url, description, weight, stock, low_stock_threshold,
        is_organic, is_bestseller, origin_region, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;

    const values = [
      prodId, prodSku, name.trim(), prodSlug, prodCategory, prodSubCategory,
      pricing.price, pricing.originalPrice, pricing.discountType, pricing.discountValue,
      rating || 5.0, reviewsCount || 0,
      imageUrl || '',
      description || '', weight || '1 Unit', Number(stock || 0), Number(lowStockThreshold || 10),
      Boolean(isOrganic), Boolean(isBestseller), originRegion || 'India', tags || []
    ];

    const result = await query(sql, values);
    res.status(201).json({
      success: true,
      message: 'Product created successfully with calculated discounts.',
      data: formatProductResponse(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'CREATE_FAILED', message: error.message });
  }
});

// PUT /api/v1/products/:id or PATCH /api/v1/products/:id - Update product details (Manager & Admin only)
productsRouter.put('/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      slug,
      category,
      categoryId,
      subCategory,
      subCategoryId,
      originalPrice,
      price,
      discountType,
      discountValue,
      imageUrl,
      description,
      weight,
      stock,
      lowStockThreshold,
      isOrganic,
      isBestseller,
      originRegion,
      tags,
    } = req.body;

    const prodRes = await query('SELECT * FROM products WHERE id = $1 OR sku = $1 LIMIT 1', [id]);
    if (prodRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }
    const current = prodRes.rows[0];

    const pricing = calculatePrices({
      originalPrice: originalPrice != null ? Number(originalPrice) : (current.original_price != null ? Number(current.original_price) : Number(current.price)),
      price: price != null ? Number(price) : (current.price != null ? Number(current.price) : undefined),
      discountType: discountType || current.discount_type,
      discountValue: discountValue != null ? Number(discountValue) : (current.discount_value != null ? Number(current.discount_value) : undefined),
    });

    const updateSql = `
      UPDATE products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        slug = COALESCE($3, slug),
        category = COALESCE($4, category),
        sub_category = COALESCE($5, sub_category),
        price = $6,
        original_price = $7,
        discount_type = $8,
        discount_value = $9,
        image_url = COALESCE($10, image_url),
        description = COALESCE($11, description),
        weight = COALESCE($12, weight),
        stock = COALESCE($13, stock),
        low_stock_threshold = COALESCE($14, low_stock_threshold),
        is_organic = COALESCE($15, is_organic),
        is_bestseller = COALESCE($16, is_bestseller),
        origin_region = COALESCE($17, origin_region),
        tags = COALESCE($18, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
    `;

    const updatedRes = await query(updateSql, [
      name || null,
      sku || null,
      slug || null,
      category || categoryId || null,
      subCategory || subCategoryId || null,
      pricing.price,
      pricing.originalPrice,
      pricing.discountType,
      pricing.discountValue,
      imageUrl || null,
      description || null,
      weight || null,
      stock != null ? Number(stock) : null,
      lowStockThreshold != null ? Number(lowStockThreshold) : null,
      isOrganic != null ? Boolean(isOrganic) : null,
      isBestseller != null ? Boolean(isBestseller) : null,
      originRegion || null,
      tags || null,
      current.id,
    ]);

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: formatProductResponse(updatedRes.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// PATCH /api/v1/products/:id - Partial updates
productsRouter.patch('/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prodRes = await query('SELECT * FROM products WHERE id = $1 OR sku = $1 LIMIT 1', [id]);
    if (prodRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }
    const current = prodRes.rows[0];

    const {
      name,
      sku,
      slug,
      category,
      categoryId,
      subCategory,
      subCategoryId,
      originalPrice,
      price,
      discountType,
      discountValue,
      imageUrl,
      description,
      weight,
      stock,
      lowStockThreshold,
      isOrganic,
      isBestseller,
      originRegion,
      tags,
    } = req.body;

    const pricing = calculatePrices({
      originalPrice: originalPrice != null ? Number(originalPrice) : (current.original_price != null ? Number(current.original_price) : Number(current.price)),
      price: price != null ? Number(price) : (current.price != null ? Number(current.price) : undefined),
      discountType: discountType || current.discount_type,
      discountValue: discountValue != null ? Number(discountValue) : (current.discount_value != null ? Number(current.discount_value) : undefined),
    });

    const updateSql = `
      UPDATE products SET
        name = COALESCE($1, name),
        sku = COALESCE($2, sku),
        slug = COALESCE($3, slug),
        category = COALESCE($4, category),
        sub_category = COALESCE($5, sub_category),
        price = $6,
        original_price = $7,
        discount_type = $8,
        discount_value = $9,
        image_url = COALESCE($10, image_url),
        description = COALESCE($11, description),
        weight = COALESCE($12, weight),
        stock = COALESCE($13, stock),
        low_stock_threshold = COALESCE($14, low_stock_threshold),
        is_organic = COALESCE($15, is_organic),
        is_bestseller = COALESCE($16, is_bestseller),
        origin_region = COALESCE($17, origin_region),
        tags = COALESCE($18, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
    `;

    const updatedRes = await query(updateSql, [
      name || null,
      sku || null,
      slug || null,
      category || categoryId || null,
      subCategory || subCategoryId || null,
      pricing.price,
      pricing.originalPrice,
      pricing.discountType,
      pricing.discountValue,
      imageUrl || null,
      description || null,
      weight || null,
      stock != null ? Number(stock) : null,
      lowStockThreshold != null ? Number(lowStockThreshold) : null,
      isOrganic != null ? Boolean(isOrganic) : null,
      isBestseller != null ? Boolean(isBestseller) : null,
      originRegion || null,
      tags || null,
      current.id,
    ]);

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: formatProductResponse(updatedRes.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// PATCH /api/v1/products/:id/discount - Set or update product discount (Manager & Admin only)
productsRouter.patch('/:id/discount', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { originalPrice, discountType, discountValue, price } = req.body;

    const prodRes = await query('SELECT * FROM products WHERE id = $1 OR sku = $1 LIMIT 1', [id]);
    if (prodRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }

    const currentProd = prodRes.rows[0];
    const targetOriginalPrice = originalPrice != null ? Number(originalPrice) : Number(currentProd.original_price || currentProd.price);

    const pricing = calculatePrices({
      originalPrice: targetOriginalPrice,
      price: price != null ? Number(price) : undefined,
      discountType: discountType || (discountValue != null ? 'PERCENTAGE' : undefined),
      discountValue: discountValue != null ? Number(discountValue) : undefined,
    });

    const updateSql = `
      UPDATE products
      SET price = $1, original_price = $2, discount_type = $3, discount_value = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const updatedRes = await query(updateSql, [pricing.price, pricing.originalPrice, pricing.discountType, pricing.discountValue, currentProd.id]);

    res.json({
      success: true,
      message: `Discount applied successfully for "${currentProd.name}".`,
      data: formatProductResponse(updatedRes.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'DISCOUNT_UPDATE_FAILED', message: error.message });
  }
});

// PATCH /api/v1/products/:id/stock - Quick stock count update for Admin
productsRouter.patch('/:id/stock', authGuard, roleGuard('Operations', 'Manager', 'Admin'), async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { stock, reason } = req.body;

    if (stock == null || typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Valid non-negative numeric stock is required.' });
    }

    await client.query('BEGIN');

    const prodRes = await client.query('SELECT id, name, stock FROM products WHERE id = $1 OR sku = $1 FOR UPDATE', [id]);
    if (prodRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }

    const currentStock = Number(prodRes.rows[0].stock);
    const changeQty = stock - currentStock;

    await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [stock, prodRes.rows[0].id]);

    await client.query(`
      INSERT INTO inventory_logs (product_id, change_qty, previous_stock, new_stock, reason, adjusted_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [prodRes.rows[0].id, changeQty, currentStock, stock, reason || 'ADMIN_DIRECT_STOCK_SET', req.user?.name || 'Admin']);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Stock updated to ${stock} units for ${prodRes.rows[0].name}.`,
      data: {
        productId: prodRes.rows[0].id,
        previousStock: currentStock,
        newStock: stock,
        difference: changeQty,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: 'STOCK_UPDATE_FAILED', message: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/v1/products/:id/toggle - Toggle bestseller or organic status
productsRouter.patch('/:id/toggle', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isBestseller, isOrganic } = req.body;

    const prodRes = await query('SELECT id, name, is_bestseller, is_organic FROM products WHERE id = $1 OR sku = $1 LIMIT 1', [id]);
    if (prodRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }

    const current = prodRes.rows[0];
    const newBestseller = isBestseller !== undefined ? Boolean(isBestseller) : current.is_bestseller;
    const newOrganic = isOrganic !== undefined ? Boolean(isOrganic) : current.is_organic;

    const updateRes = await query(`
      UPDATE products
      SET is_bestseller = $1, is_organic = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [newBestseller, newOrganic, current.id]);

    res.json({
      success: true,
      message: `Flags updated for "${current.name}".`,
      data: formatProductResponse(updateRes.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'TOGGLE_FAILED', message: error.message });
  }
});

// DELETE /api/v1/products/:id - Delete single product (Manager & Admin only)
productsRouter.delete('/:id', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const prodRes = await query('SELECT id, name FROM products WHERE id = $1 OR sku = $1 LIMIT 1', [id]);
    if (prodRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Product not found.' });
    }

    const prod = prodRes.rows[0];
    await query('DELETE FROM products WHERE id = $1', [prod.id]);

    res.json({
      success: true,
      message: `Product "${prod.name}" has been deleted.`,
      deletedProductId: prod.id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'DELETE_FAILED', message: error.message });
  }
});

// POST /api/v1/products/bulk/delete - Delete multiple products at once (Admin only)
productsRouter.post('/bulk/delete', authGuard, roleGuard('Admin'), async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Array of productIds is required.' });
    }

    const deleteRes = await query('DELETE FROM products WHERE id = ANY($1::varchar[]) RETURNING id', [productIds]);

    res.json({
      success: true,
      message: `${deleteRes.rowCount} products deleted successfully.`,
      deletedCount: deleteRes.rowCount,
      deletedIds: deleteRes.rows.map((r) => r.id),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'BULK_DELETE_FAILED', message: error.message });
  }
});

// Helper: Parse RFC-compliant CSV text into array of key-value records
export function parseCSVText(csvText: string): Record<string, any>[] {
  if (!csvText || typeof csvText !== 'string') return [];

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' || char === "'") {
      if (inQuotes && nextChar === char) {
        currentCell += char;
        i++; // Escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) {
        matrix.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      matrix.push(currentRow);
    }
  }

  if (matrix.length === 0) return [];

  const rawHeaders = matrix[0];
  const normalizeKey = (k: string): string => {
    const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['productname', 'name', 'title'].includes(clean)) return 'name';
    if (['sku', 'productsku', 'itemcode', 'code'].includes(clean)) return 'sku';
    if (['price', 'sellingprice', 'discountedprice', 'saleprice'].includes(clean)) return 'price';
    if (['originalprice', 'mrp', 'regularprice', 'listprice'].includes(clean)) return 'originalPrice';
    if (['discounttype', 'discount_type', 'type'].includes(clean)) return 'discountType';
    if (['discountvalue', 'discount_value', 'discount', 'discountpercent'].includes(clean)) return 'discountValue';
    if (['category', 'categoryid', 'categoryname', 'categoryslug'].includes(clean)) return 'category';
    if (['subcategory', 'subcategoryid', 'subcategoryname', 'subcat'].includes(clean)) return 'subCategory';
    if (['stock', 'quantity', 'qty', 'inventory', 'units'].includes(clean)) return 'stock';
    if (['lowstockthreshold', 'lowstock', 'threshold', 'minstock'].includes(clean)) return 'lowStockThreshold';
    if (['imageurl', 'image', 'photo', 'img'].includes(clean)) return 'imageUrl';
    if (['description', 'desc', 'details'].includes(clean)) return 'description';
    if (['weight', 'size', 'unit', 'netweight'].includes(clean)) return 'weight';
    if (['isorganic', 'organic'].includes(clean)) return 'isOrganic';
    if (['isbestseller', 'bestseller', 'featured'].includes(clean)) return 'isBestseller';
    if (['originregion', 'origin', 'region', 'state'].includes(clean)) return 'originRegion';
    if (['tags', 'keywords', 'labels'].includes(clean)) return 'tags';
    if (['rating'].includes(clean)) return 'rating';
    if (['reviewscount', 'reviews', 'ratingscount'].includes(clean)) return 'reviewsCount';
    return clean;
  };

  const headers = rawHeaders.map(normalizeKey);
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const rawValues = matrix[r];
    if (rawValues.every((v) => !v)) continue; // skip blank line

    const rowObj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const val = rawValues[idx] !== undefined ? rawValues[idx] : '';
      if (['price', 'originalPrice', 'discountValue', 'stock', 'lowStockThreshold', 'rating', 'reviewsCount'].includes(h)) {
        rowObj[h] = val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
      } else if (['isOrganic', 'isBestseller'].includes(h)) {
        const lower = String(val).toLowerCase().trim();
        rowObj[h] = ['true', 'yes', '1', 'y'].includes(lower);
      } else if (h === 'tags') {
        rowObj[h] = val ? String(val).split(/[;|]/).map((t: string) => t.trim()).filter(Boolean) : [];
      } else {
        rowObj[h] = val;
      }
    });

    rows.push(rowObj);
  }

  return rows;
}

// Handler for bulk products import (supports array of items or raw CSV)
async function handleBulkImport(req: Request, res: Response) {
  try {
    let itemsToProcess: any[] = [];

    if (Array.isArray(req.body)) {
      itemsToProcess = req.body;
    } else if (Array.isArray(req.body.products)) {
      itemsToProcess = req.body.products;
    } else if (Array.isArray(req.body.items)) {
      itemsToProcess = req.body.items;
    } else if (typeof req.body.csv === 'string' && req.body.csv.trim() !== '') {
      itemsToProcess = parseCSVText(req.body.csv);
    } else if (typeof req.body === 'string' && req.body.trim() !== '') {
      itemsToProcess = parseCSVText(req.body);
    } else {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Please provide either a "csv" string or an array of "items"/"products" in the request body.',
      });
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_PAYLOAD',
        message: 'No product records found to import.',
      });
    }

    // Build Category & Sub-Category in-memory lookup cache for fast matching
    const catLookup = new Map<string, string>();
    const subCatLookup = new Map<string, string>();

    try {
      const catRes = await query('SELECT id, name, slug FROM categories');
      for (const c of catRes.rows) {
        catLookup.set(String(c.id).toLowerCase(), c.id);
        catLookup.set(String(c.name).toLowerCase(), c.id);
        catLookup.set(String(c.slug).toLowerCase(), c.id);
      }

      const subCatRes = await query('SELECT id, name, slug FROM sub_categories');
      for (const sc of subCatRes.rows) {
        subCatLookup.set(String(sc.id).toLowerCase(), sc.id);
        subCatLookup.set(String(sc.name).toLowerCase(), sc.id);
        subCatLookup.set(String(sc.slug).toLowerCase(), sc.id);
      }
    } catch (e) {
      // Non-fatal if categories table is empty or error occurs
    }

    const processedResults: any[] = [];
    const errors: { row: number; name?: string; sku?: string; error: string }[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const rowIndex = i + 1;

      try {
        const name = (item.name || item.title || '').toString().trim();
        if (!name) {
          errors.push({ row: rowIndex, error: 'Product name is required.' });
          continue;
        }

        const prodId = item.id || 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const prodSku = item.sku ? item.sku.toString().trim() : 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const prodSlug = item.slug || (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substring(2, 6));

        // Resolve Category UUID
        let resolvedCategory: string | null = null;
        const catInput = (item.category || item.categoryId || item.category_name || item.category_slug || '').toString().trim();
        if (catInput) {
          resolvedCategory = catLookup.get(catInput.toLowerCase()) || (catInput.length === 36 ? catInput : null);
        }

        // Resolve Sub-Category UUID
        let resolvedSubCategory: string | null = null;
        const subCatInput = (item.subCategory || item.subCategoryId || item.sub_category || item.sub_category_name || '').toString().trim();
        if (subCatInput) {
          resolvedSubCategory = subCatLookup.get(subCatInput.toLowerCase()) || (subCatInput.length === 36 ? subCatInput : null);
        }

        // Pricing calculation
        const pricing = calculatePrices({
          originalPrice: item.originalPrice ?? item.original_price ?? item.mrp,
          price: item.price ?? item.selling_price ?? item.discounted_price,
          discountType: item.discountType || item.discount_type,
          discountValue: item.discountValue ?? item.discount_value,
        });

        // Tags parsing
        let tags: string[] = [];
        if (Array.isArray(item.tags)) {
          tags = item.tags;
        } else if (typeof item.tags === 'string' && item.tags.trim()) {
          tags = item.tags.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean);
        }

        const upsertSql = `
          INSERT INTO products (
            id, sku, name, slug, category, sub_category, price, original_price,
            discount_type, discount_value,
            rating, reviews_count, image_url, description, weight, stock, low_stock_threshold,
            is_organic, is_bestseller, origin_region, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (sku) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            category = COALESCE(EXCLUDED.category, products.category),
            sub_category = COALESCE(EXCLUDED.sub_category, products.sub_category),
            price = EXCLUDED.price,
            original_price = EXCLUDED.original_price,
            discount_type = EXCLUDED.discount_type,
            discount_value = EXCLUDED.discount_value,
            rating = EXCLUDED.rating,
            reviews_count = EXCLUDED.reviews_count,
            image_url = CASE WHEN EXCLUDED.image_url IS NOT NULL AND EXCLUDED.image_url != '' THEN EXCLUDED.image_url ELSE products.image_url END,
            description = CASE WHEN EXCLUDED.description IS NOT NULL AND EXCLUDED.description != '' THEN EXCLUDED.description ELSE products.description END,
            weight = CASE WHEN EXCLUDED.weight IS NOT NULL AND EXCLUDED.weight != '' THEN EXCLUDED.weight ELSE products.weight END,
            stock = EXCLUDED.stock,
            low_stock_threshold = EXCLUDED.low_stock_threshold,
            is_organic = EXCLUDED.is_organic,
            is_bestseller = EXCLUDED.is_bestseller,
            origin_region = CASE WHEN EXCLUDED.origin_region IS NOT NULL AND EXCLUDED.origin_region != '' THEN EXCLUDED.origin_region ELSE products.origin_region END,
            tags = CASE WHEN array_length(EXCLUDED.tags, 1) > 0 THEN EXCLUDED.tags ELSE products.tags END,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *, (xmax = 0) AS is_inserted
        `;

        const values = [
          prodId,
          prodSku,
          name,
          prodSlug,
          resolvedCategory,
          resolvedSubCategory,
          pricing.price,
          pricing.originalPrice,
          pricing.discountType,
          pricing.discountValue,
          Number(item.rating || 5.0),
          Number(item.reviewsCount || item.reviews_count || 0),
          item.imageUrl || item.image_url || item.image || '',
          item.description || '',
          item.weight || '1 Unit',
          Number(item.stock || 0),
          Number(item.lowStockThreshold || item.low_stock_threshold || 10),
          Boolean(item.isOrganic || item.is_organic),
          Boolean(item.isBestseller || item.is_bestseller),
          item.originRegion || item.origin_region || 'India',
          tags
        ];

        const dbRes = await query(upsertSql, values);
        const row = dbRes.rows[0];
        if (row.is_inserted) {
          createdCount++;
        } else {
          updatedCount++;
        }
        processedResults.push(formatProductResponse(row));
      } catch (err: any) {
        errors.push({
          row: rowIndex,
          name: item.name,
          sku: item.sku,
          error: err.message || 'Failed to save product row',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk import completed. ${createdCount} created, ${updatedCount} updated, ${errors.length} failed.`,
      summary: {
        total: itemsToProcess.length,
        created: createdCount,
        updated: updatedCount,
        failed: errors.length,
        errors,
      },
      data: processedResults,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'IMPORT_FAILED', message: error.message });
  }
}

// POST /api/v1/products/bulk/import - Bulk import products via JSON array or CSV string (Manager & Admin only)
productsRouter.post('/bulk/import', authGuard, roleGuard('Manager', 'Admin'), handleBulkImport);

// POST /api/v1/products/import-csv - CSV import alias endpoint (Manager & Admin only)
productsRouter.post('/import-csv', authGuard, roleGuard('Manager', 'Admin'), handleBulkImport);

