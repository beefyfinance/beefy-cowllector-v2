import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context, Next } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { db } from './lib/db.js';
import { lastHarvestReportApi } from './routes/last-harvest-reports';
import type { Variables } from './types';

// Initialize OpenAPIHono with the custom context type
const app = new OpenAPIHono<{ Variables: Variables }>();

// Add rate limiting middleware
app.use(
    '*',
    rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 100, // Limit each IP to 100 requests per window
        standardHeaders: 'draft-6', // RateLimit-* headers
        keyGenerator: c => c.req.header('x-forwarded-for') || 'unknown', // Use IP address as key
    })
);

// Add the pool to the Hono context
app.use('*', async (c: Context<{ Variables: Variables }>, next: Next) => {
    c.set('db', db);
    await next();
});

// Add the routes
app.route('/api/v1', lastHarvestReportApi);

// Add OpenAPI documentation
app.doc('/api/docs', {
    openapi: '3.0.0',
    info: {
        title: 'Harvest Reports API',
        version: '1.0.0',
    },
});

// Add Swagger UI
app.get('/swagger', swaggerUI({ url: '/api/docs' }));

const port = process.env.PORT || 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
