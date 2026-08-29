import { pool } from '../config/database.js';

async function seed() {
  console.log('🌱 Seeding PostgreSQL Database with Authentic Indian Store Data...');

  try {
    // 1. Seed Categories
    const categories = [
      { name: 'Atta, rice & grains', slug: 'atta-rice-grains', icon: 'grain', order: 1 },
      { name: 'Dal & pulses', slug: 'dal-pulses', icon: 'rice_bowl', order: 2 },
      { name: 'Oil & ghee', slug: 'oil-ghee', icon: 'opacity', order: 3 },
      { name: 'Tea & coffee', slug: 'tea-coffee', icon: 'coffee', order: 4 },
      { name: 'Chips & biscuits', slug: 'chips-biscuits', icon: 'cookie', order: 5 },
      { name: 'Bath & body', slug: 'bath-body', icon: 'soap', order: 6 },
      { name: 'Make up & cosmetics', slug: 'make-up-cosmetics', icon: 'face_retouching_natural', order: 7 },
      { name: 'Laundry detergents', slug: 'laundry-detergents', icon: 'local_laundry_service', order: 8 },
      { name: 'Baby care', slug: 'baby-care', icon: 'child_care', order: 9 },
      { name: 'Pet care', slug: 'pet-care', icon: 'pets', order: 10 },
    ];

    const categoryMap = new Map<string, string>();

    for (const cat of categories) {
      const res = await pool.query(`
        INSERT INTO categories (name, slug, icon, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon, display_order = EXCLUDED.display_order
        RETURNING id, name
      `, [cat.name, cat.slug, cat.icon, cat.order]);
      categoryMap.set(res.rows[0].name, res.rows[0].id);
    }
    console.log(`✅ Seeded ${categories.length} Categories.`);

    // 2. Seed Sub-Categories
    const subCategories = [
      { categoryName: 'Atta, rice & grains', name: 'Rice', slug: 'rice', order: 1 },
      { categoryName: 'Atta, rice & grains', name: 'Atta & flours', slug: 'atta-flours', order: 2 },
      { categoryName: 'Atta, rice & grains', name: 'Poha', slug: 'poha', order: 3 },
      { categoryName: 'Atta, rice & grains', name: 'Millet & other flours', slug: 'millet-other-flours', order: 4 },
      { categoryName: 'Dal & pulses', name: 'Toor & Arhar Dal', slug: 'toor-arhar-dal', order: 1 },
      { categoryName: 'Dal & pulses', name: 'Moong Dal', slug: 'moong-dal', order: 2 },
      { categoryName: 'Oil & ghee', name: 'Pure Desi Ghee', slug: 'pure-desi-ghee', order: 1 },
      { categoryName: 'Oil & ghee', name: 'Mustard & Cooking Oil', slug: 'mustard-cooking-oil', order: 2 },
      { categoryName: 'Tea & coffee', name: 'Chai Tea Leaves', slug: 'chai-tea-leaves', order: 1 },
      { categoryName: 'Chips & biscuits', name: 'Namkeen & Snacks', slug: 'namkeen-snacks', order: 1 },
    ];

    const subCategoryMap = new Map<string, string>();

    for (const sc of subCategories) {
      const catId = categoryMap.get(sc.categoryName);
      if (catId) {
        const res = await pool.query(`
          INSERT INTO sub_categories (category_id, name, slug, display_order)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (category_id, slug) DO UPDATE SET name = EXCLUDED.name, display_order = EXCLUDED.display_order
          RETURNING id, name, category_id
        `, [catId, sc.name, sc.slug, sc.order]);
        subCategoryMap.set(`${sc.categoryName}:::${sc.name}`, res.rows[0].id);
      }
    }
    console.log(`✅ Seeded ${subCategories.length} Sub-Categories.`);

    // 3. Seed Coupons
    const coupons = [
      {
        code: 'FESTIVE15',
        badge: 'FESTIVE SPECIAL',
        title: 'Flat 15% OFF on all Authentic Groceries',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minOrderAmount: 499,
        maxDiscountCap: 300,
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'DIWALI2026',
        badge: 'GRAND DIWALI',
        title: 'Grand Diwali Sweet & Spice Hampers 25% OFF',
        discountType: 'PERCENTAGE',
        discountValue: 25,
        minOrderAmount: 999,
        maxDiscountCap: 500,
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'SUPER100',
        badge: 'WELCOME BONUS',
        title: 'Flat ₹100 Cashback on First Order',
        discountType: 'FLAT',
        discountValue: 100,
        minOrderAmount: 599,
        validTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const c of coupons) {
      await pool.query(`
        INSERT INTO coupons (code, badge, title, discount_type, discount_value, min_order_amount, max_discount_cap, valid_to)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (code) DO NOTHING
      `, [c.code, c.badge, c.title, c.discountType, c.discountValue, c.minOrderAmount, c.maxDiscountCap || null, c.validTo]);
    }
    console.log(`✅ Seeded ${coupons.length} Active Promo Coupons.`);

    // 4. Seed Initial Products with Original Price, Discounts, and Calculated Selling Price
    const products = [
      {
        id: 'p-101a',
        sku: 'SKU-RICE-01',
        name: 'India Gate Nur Jahan Biryani Basmati Rice (5kg)',
        slug: 'india-gate-nur-jahan-biryani-basmati-rice-5kg',
        categoryName: 'Atta, rice & grains',
        subCategoryName: 'Rice',
        originalPrice: 1200,
        discountType: 'PERCENTAGE',
        discountValue: 16.75,
        price: 999,
        rating: 4.9,
        reviewsCount: 184,
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
        description: 'Extra long grain premium biryani basmati rice with exquisite aroma and fluffy non-sticky texture.',
        weight: '5kg Bag',
        stock: 65,
        lowStockThreshold: 10,
        isOrganic: false,
        isBestseller: true,
        originRegion: 'Punjab, India',
        tags: ['Basmati Rice', 'Biryani', 'Pantry'],
      },
      {
        id: 'p-101c',
        sku: 'SKU-ATTA-01',
        name: 'Aashirvaad Superior MP Sharbati Atta (10kg)',
        slug: 'aashirvaad-superior-mp-sharbati-atta-10kg',
        categoryName: 'Atta, rice & grains',
        subCategoryName: 'Atta & flours',
        originalPrice: 899,
        discountType: 'FLAT',
        discountValue: 100,
        price: 799,
        rating: 4.9,
        reviewsCount: 340,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
        description: '100% pure Sharbati wheat grains from the fertile fields of Sehore Madhya Pradesh.',
        weight: '10kg Bag',
        stock: 110,
        lowStockThreshold: 15,
        isOrganic: true,
        isBestseller: true,
        originRegion: 'Madhya Pradesh, India',
        tags: ['Sharbati Atta', 'Aashirvaad', 'Whole grains'],
      },
      {
        id: 'p-101h',
        sku: 'SKU-POHA-01',
        name: 'Tata Sampann High Protein Organic Poha (500g)',
        slug: 'tata-sampann-high-protein-organic-poha-500g',
        categoryName: 'Atta, rice & grains',
        subCategoryName: 'Poha',
        originalPrice: 90,
        discountType: 'FLAT',
        discountValue: 15,
        price: 75,
        rating: 4.9,
        reviewsCount: 160,
        imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
        description: 'Thick beaten rice flakes from organic rice paddy, source of natural dietary iron.',
        weight: '500g Pack',
        stock: 120,
        lowStockThreshold: 20,
        isOrganic: true,
        isBestseller: true,
        originRegion: 'Maharashtra, India',
        tags: ['Poha', 'Tata Sampann', 'Organic'],
      },
      {
        id: 'p-103d-millet',
        sku: 'SKU-MILLET-01',
        name: 'Pure Desi Bajra & Jowar Millet Flour (1kg)',
        slug: 'pure-desi-bajra-jowar-millet-flour-1kg',
        categoryName: 'Atta, rice & grains',
        subCategoryName: 'Millet & other flours',
        originalPrice: 165,
        discountType: 'PERCENTAGE',
        discountValue: 15.75,
        price: 139,
        rating: 4.9,
        reviewsCount: 128,
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
        description: 'Gluten-free traditional pearl millet flour rich in dietary iron, magnesium, and dietary fiber.',
        weight: '1kg Bag',
        stock: 70,
        lowStockThreshold: 10,
        isOrganic: true,
        isBestseller: true,
        originRegion: 'Gujarat, India',
        tags: ['Millet', 'Jowar', 'Bajra', 'Millet & other flours'],
      },
      {
        id: 'p-104',
        sku: 'SKU-DAL-01',
        name: 'Tata Sampann Unpolished Toor Dal (1kg)',
        slug: 'tata-sampann-unpolished-toor-dal-1kg',
        categoryName: 'Dal & pulses',
        subCategoryName: 'Toor & Arhar Dal',
        originalPrice: 220,
        discountType: 'PERCENTAGE',
        discountValue: 14.09,
        price: 189,
        rating: 4.8,
        reviewsCount: 230,
        imageUrl: 'https://images.unsplash.com/photo-1585994192701-f2f216cfdc5f?w=600&auto=format&fit=crop&q=80',
        description: 'Nutritious unpolished toor dal rich in plant protein, without artificial water, oil, or leather polish.',
        weight: '1kg Pack',
        stock: 140,
        lowStockThreshold: 15,
        isOrganic: true,
        isBestseller: true,
        originRegion: 'Maharashtra, India',
        tags: ['Toor Dal', 'Pulses'],
      },
      {
        id: 'p-106',
        sku: 'SKU-GHEE-01',
        name: 'Amul Pure Desi Ghee (1L Tin)',
        slug: 'amul-pure-desi-ghee-1l-tin',
        categoryName: 'Oil & ghee',
        subCategoryName: 'Pure Desi Ghee',
        originalPrice: 720,
        discountType: 'FLAT',
        discountValue: 35,
        price: 685,
        rating: 4.9,
        reviewsCount: 420,
        imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80',
        description: 'Traditional golden clarified butter with rich granular texture and authentic aroma.',
        weight: '1L Tin',
        stock: 95,
        lowStockThreshold: 12,
        isOrganic: false,
        isBestseller: true,
        originRegion: 'Gujarat, India',
        tags: ['Desi Ghee', 'Amul'],
      },
    ];

    for (const p of products) {
      const categoryId = categoryMap.get(p.categoryName) || null;
      const subCategoryId = subCategoryMap.get(`${p.categoryName}:::${p.subCategoryName}`) || null;

      await pool.query(`
        INSERT INTO products (
          id, sku, name, slug, category, sub_category, price, original_price,
          discount_type, discount_value,
          rating, reviews_count, image_url, description, weight, stock, low_stock_threshold,
          is_organic, is_bestseller, origin_region, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (id) DO UPDATE SET 
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          price = EXCLUDED.price,
          original_price = EXCLUDED.original_price,
          discount_type = EXCLUDED.discount_type,
          discount_value = EXCLUDED.discount_value,
          stock = EXCLUDED.stock
      `, [
        p.id, p.sku, p.name, p.slug, categoryId, subCategoryId,
        p.price, p.originalPrice, p.discountType, p.discountValue,
        p.rating, p.reviewsCount, p.imageUrl,
        p.description, p.weight, p.stock, p.lowStockThreshold,
        p.isOrganic, p.isBestseller, p.originRegion, p.tags
      ]);
    }
    console.log(`✅ Seeded ${products.length} Catalog Products with Original Price, Discounts & Selling Price.`);

    console.log('🎉 Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();
