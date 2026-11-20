import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * /tb/api/* → ThingsBoard /api/*
 *
 * The admin log site (GitHub Pages) can't call demo.thingsboard.io from the browser because
 * ThingsBoard doesn't send CORS headers. This backend already allows the site's origin, so it
 * forwards the request and returns ThingsBoard's answer as-is. Only /api/* with GET/POST is
 * forwarded; nothing is stored or logged (no bodies, tokens or passwords).
 *
 *   .env  TB_URL=https://demo.thingsboard.io   (default)
 */
export function tbRelay(target = process.env.TB_URL || 'https://demo.thingsboard.io') {
  const log = new Logger('TbRelay');
  log.log(`ThingsBoard relay: /tb/api/* → ${target}/api/*`);
  return async (req: Request, res: Response, next: NextFunction) => {
    // mounted at /tb, so req.url is "/api/..."
    if (!req.url.startsWith('/api/')) return next();
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const auth = req.header('x-authorization');
      if (auth) headers['X-Authorization'] = auth;
      let body: string | undefined;
      if (req.method === 'POST') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(req.body ?? {});
      }
      // Follow redirects ourselves: fetch's automatic follow turns a POST into a GET on 301/302,
      // which ThingsBoard rejects ("Authentication method not supported").
      let url = target + req.url;
      let upstream = await fetch(url, { method: req.method, headers, body, redirect: 'manual' });
      for (let hops = 0; hops < 5 && upstream.status >= 300 && upstream.status < 400; hops++) {
        const next = upstream.headers.get('location');
        if (!next) break;
        url = new URL(next, url).toString();
        if (hops === 0) log.log(`ThingsBoard redirects to ${new URL(url).origin}: set TB_URL to it to skip the extra hop`);
        upstream = await fetch(url, { method: req.method, headers, body, redirect: 'manual' });
      }
      res.status(upstream.status);
      const type = upstream.headers.get('content-type');
      if (type) res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (e) {
      log.warn(`ThingsBoard unreachable: ${(e as Error).message}`);
      res.status(502).json({ message: 'ThingsBoard unreachable' });
    }
  };
}
