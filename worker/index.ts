/**
 * Vexyn worker. One job: POST /api/generate — the server-side fallback for
 * devices without WebGPU. Everything else is served from static assets.
 *
 * Privacy note kept deliberately explicit: this endpoint is the ONLY place
 * where a prompt reaches our infrastructure, it is used solely for the one
 * inference call, and it is never written to storage. Desktop generation
 * stays 100% client-side and never hits this code.
 */

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  AI: { run: (model: string, inputs: Record<string, unknown>) => Promise<unknown> };
  RATE: KVNamespace;
  LIMIT_PER_IP: string;
  LIMIT_GLOBAL: string;
}

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT = 600;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** UTC day bucket so counters roll over at midnight and expire on their own. */
const dayKey = () => new Date().toISOString().slice(0, 10);

async function bump(kv: KVNamespace, key: string, limit: number): Promise<number | null> {
  // KV is eventually consistent, so this counter is approximate — acceptable
  // for a soft budget cap. Not acceptable for billing-critical limits.
  const cur = Number((await kv.get(key)) ?? '0');
  if (cur >= limit) return null;
  await kv.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 26 });
  return limit - cur - 1;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate') {
      if (request.method !== 'POST') return json(405, { error: 'POST only' });

      let prompt: string, seed: number;
      try {
        const body = (await request.json()) as { prompt?: string; seed?: number };
        prompt = String(body.prompt ?? '').trim();
        seed = Number.isFinite(body.seed) ? Math.abs(Math.trunc(body.seed!)) % 1e9 : Math.floor(Math.random() * 1e9);
      } catch {
        return json(400, { error: 'invalid JSON body' });
      }
      if (!prompt) return json(400, { error: 'empty prompt' });
      if (prompt.length > MAX_PROMPT) return json(400, { error: `prompt over ${MAX_PROMPT} chars` });

      const day = dayKey();
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';

      // Global cap first — it is the budget guarantee.
      const globalLeft = await bump(env.RATE, `g:${day}`, Number(env.LIMIT_GLOBAL));
      if (globalLeft === null) {
        return json(429, {
          error: 'daily_capacity',
          message: "Today's free server capacity is used up. It resets at midnight UTC — or use a desktop browser, where generation is unlimited and local.",
        });
      }
      const ipLeft = await bump(env.RATE, `ip:${ip}:${day}`, Number(env.LIMIT_PER_IP));
      if (ipLeft === null) {
        return json(429, {
          error: 'ip_limit',
          message: 'You have reached the daily limit on this connection. Resets at midnight UTC — desktop generation has no limit.',
        });
      }

      try {
        // Flux Schnell: 512px keeps cost at ~1/4 of 1024px and matches the
        // quality class of the local model, so the two paths feel consistent.
        const out = (await env.AI.run(MODEL, {
          prompt,
          seed,
          width: 512,
          height: 512,
          num_steps: 4,
        })) as { image?: string };
        if (!out?.image) return json(502, { error: 'model returned no image' });
        return json(200, { image: out.image, seed, remaining: ipLeft });
      } catch (e) {
        return json(502, { error: 'inference_failed', message: String(e).slice(0, 200) });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
