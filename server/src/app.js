import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { apiLimiter, csrfProtection, sanitizeInput } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/error.js';
import apiRouter from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // "simple" = Node's querystring: no nested objects in ?query (sanitizeInput then flattens arrays).
  app.set('query parser', 'simple');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      // The API only serves JSON and files, never HTML, so it can use the strictest possible CSP.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets the SPA on another origin show uploaded images
      strictTransportSecurity: env.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // API responses carry personal data: never store them in shared caches.
    if (!req.path.startsWith('/api/v1/files/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin and non-browser requests have no Origin header.
        if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    })
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.get('/api/v1/health', (req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    res.status(db === 'up' ? 200 : 503).json({ ok: db === 'up', data: { status: 'ok', db, time: new Date().toISOString() } });
  });

  app.use('/api/v1', apiLimiter, csrfProtection, apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
