import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { setupSwagger } from './config/swagger.js';

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
  'https://indian-store.trader-news.co.in',
  'http://indian-store.trader-news.co.in',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : []),
  ...(process.env.FRONTEND_DOMAIN ? [`https://${process.env.FRONTEND_DOMAIN}`, `http://${process.env.FRONTEND_DOMAIN}`] : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl, mobile apps, Postman)
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.trader-news.co.in') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    if (isAllowed) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400,
}));

// Preflight handler
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup Swagger UI Documentation (/api-docs & /docs)
setupSwagger(app);


// Global Rate Limiter (Prevent brute force & abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Please try again later.' }
});
app.use(limiter);

// Health Check Endpoint
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
