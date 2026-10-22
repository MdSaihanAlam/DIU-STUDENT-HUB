import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
      // Policy for the web app pages (only used when this server also serves the React build).
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(env.isProd ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // lets the SPA on another origin show uploaded images
      strictTransportSecurity: env.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });
  app.use('/api', (req, res, next) => {
    // The API only serves JSON and files, never HTML, so it gets the strictest possible CSP.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    // API responses carry personal data: never store them in shared caches.
    if (!req.path.startsWith('/v1/files/')) res.setHeader('Cache-Control', 'no-store');
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

  if (env.serveClient) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      // Hashed build assets never change, so they can be cached for a year.
      app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      // Single-page app: every other non-API GET returns index.html and React Router takes over.
      app.get(/^\/(?!api\/).*/, (req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(dist, 'index.html'));
      });
    } else {
      console.warn('[web] SERVE_CLIENT=true but client/dist was not found — run `npm run build` first.');
    }
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
