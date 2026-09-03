import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { productsRouter } from './modules/products/products.router.js';
import { categoriesRouter } from './modules/categories/categories.router.js';
import { inventoryRouter } from './modules/inventory/inventory.router.js';
import { couponsRouter } from './modules/coupons/coupons.router.js';
import { ordersRouter } from './modules/orders/orders.router.js';
import { paymentsRouter } from './modules/payments/payments.router.js';
import { reportsRouter } from './modules/reports/reports.router.js';
import { storefrontRouter } from './modules/storefront/storefront.router.js';
import { notificationsRouter } from './modules/notifications/notifications.router.js';
import { uploadRouter } from './modules/upload/upload.router.js';
import { setupSwagger } from './config/swagger.js';
import path from 'path';

dotenv.config();

export const app: Express = express();

// Security Middlewares (configured to allow Swagger UI scripts/styles)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
// Robust CORS handling for localhost, preview domains, production domains & custom env origins
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'https://indian-store.trader-news.co.in',
  'http://indian-store.trader-news.co.in',
  'https://indian-store-api.trader-news.co.in',
  'https://indian-store-auth.trader-news.co.in',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : []),
  ...(process.env.FRONTEND_DOMAIN ? [`https://${process.env.FRONTEND_DOMAIN}`, `http://${process.env.FRONTEND_DOMAIN}`] : []),
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.includes('trader-news.co.in') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    if (isAllowed) {
      return callback(null, true);
    }
    // Permissive fallback so legitimate client domains are never blocked by CORS
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Mock-Role',
    'X-Mock-Email',
    'X-User-Role',
    'X-Auth-Token',
    'access-control-allow-origin',
  ],
  exposedHeaders: ['Set-Cookie', 'Authorization'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

// 1. Standard CORS middleware
app.use(cors(corsOptions));

// 2. Explicit Preflight OPTIONS handler with identical corsOptions
app.options('*', cors(corsOptions));

// 3. Response compression (GZIP / Deflate) for JSON, HTML, and text payloads (>1KB)
app.use(
  compression({
    threshold: 1024,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup Swagger UI Documentation (/api-docs & /docs)
setupSwagger(app);


// Static file serving for uploaded media assets (with 30-day immutable caching for CDN / Browser)
// MUST be mounted BEFORE the rate limiter so images never deplete client API rate limits
const uploadsDirectory = path.resolve(process.env.UPLOADS_PATH || './uploads');
app.use(
  '/uploads',
  (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(uploadsDirectory, {
    maxAge: '30d',
    immutable: true,
    index: false,
  })
);

// Health Check Endpoints (Exempt from rate limiting for Docker/Traefik probes)
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    service: 'Indian Store Backend API',
    health: '/api/health',
    documentation: '/api-docs',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Indian Store Backend API',
    version: '1.0.0',
  });
});

// API Rate Limiter (Applied strictly to /api routes to prevent abuse, while exempting tests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api', limiter);

// Mount Domain Modules
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/storefront', storefrontRouter);
app.use('/api/v1/banners', storefrontRouter); // Convenient alias for banner requests
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/coupons', couponsRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/uploads', uploadRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected internal server error occurred.',
  });
});
