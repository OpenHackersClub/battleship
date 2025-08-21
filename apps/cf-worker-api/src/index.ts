import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  WORKER_LIVESTORE: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes
app.use(
  '*',
  cors({
    origin: ['*'],
    allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
  })
);

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Battleship API is running',
    timestamp: new Date().toISOString(),
  });
});

// Health check with database
app.get('/health', async (c) => {
  try {
    // Test database connection
    const result = await c.env.DB.prepare('SELECT 1 as test').first();

    return c.json({
      status: 'healthy',
      database: result ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: 'unhealthy',
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Proxy requests to LiveStore worker (handle all methods)
app.all('/websocket', async (c) => {
  // Create a new request with all original headers preserved
  const url = new URL(c.req.url);
  const newRequest = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.header(),
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
  });

  return await c.env.WORKER_LIVESTORE.fetch(newRequest);
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
      timestamp: new Date().toISOString(),
    },
    500
  );
});

export default app;
