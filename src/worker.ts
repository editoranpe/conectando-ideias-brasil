/**
 * Cloudflare Workers entrypoint. The site is served as static assets and the
 * Pages-style API handlers are mounted under /api/*.
 */
import { onRequest as apiHandler } from '../functions/api/[[path]]';

type WorkerEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: Parameters<typeof apiHandler>[0]['env']['DB'];
  SETUP_TOKEN?: string;
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/version') {
      return new Response(JSON.stringify({ release: '2026-11-05-db-bootstrap-v1', runtime: 'cloudflare-worker' }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (path === '/api' || path.startsWith('/api/')) {
      if (path === '/api') {
        return new Response(JSON.stringify({ error: 'Rota da API não encontrada' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      // The onRequest handler validates the database binding and catches API errors.
      return apiHandler({ request, env } as Parameters<typeof apiHandler>[0]);
    }
    return env.ASSETS.fetch(request);
  },
};
