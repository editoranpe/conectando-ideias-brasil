/**
 * Cloudflare Workers entrypoint. The site is served as static assets and the
 * Pages-style API handlers are mounted under /api/*.
 */
import { onRequest as apiHandler } from '../functions/api/[[path]]';
import { ensureExtensionSchema } from '../functions/_lib/extensions';
import { runDuePlans } from '../functions/_lib/recurring';
import { deliverScheduledNotices } from '../functions/_lib/notices';

type WorkerEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: Parameters<typeof apiHandler>[0]['env']['DB'];
  SETUP_TOKEN?: string;
  RESEND_API_KEY?: string; RESEND_FROM?: string;
  WHATSAPP_ACCESS_TOKEN?: string; WHATSAPP_PHONE_NUMBER_ID?: string;
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/version') {
      return new Response(JSON.stringify({ release: '2026-11-05-db-bootstrap-v1', runtime: 'cloudflare-worker', features: ['visual_builder', 'monthly_recurring', 'csv_import', 'pix_notices'], site_version: '2026-11-05-cib-v2' }), {
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
  async scheduled(_event: unknown, env: WorkerEnv): Promise<void> {
    if(!env.DB?.prepare) throw new Error('D1 binding DB não conectado');
    await ensureExtensionSchema(env.DB);
    const result = await runDuePlans(env.DB);
    console.log('CIB_RECURRENCE_RUN', result);
    const notices = await deliverScheduledNotices({DB:env.DB,RESEND_API_KEY:env.RESEND_API_KEY,RESEND_FROM:env.RESEND_FROM,WHATSAPP_ACCESS_TOKEN:env.WHATSAPP_ACCESS_TOKEN,WHATSAPP_PHONE_NUMBER_ID:env.WHATSAPP_PHONE_NUMBER_ID},'https://conectando-ideias-brasil.jeferson-samagaia.workers.dev');
    console.log('CIB_NOTICES_RUN', notices);
  },
};
