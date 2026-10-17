/**
 * PulseBridge AI — Local Backend Server
 * 
 * Provides HTTP endpoints for server-side services (e.g. summarize-medical-report Edge Function)
 * and health check monitoring.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleSummarizeRequest } from '../supabase/functions/summarize-medical-report/index';

// Safely load local environment variables from .env.local or .env if present
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.substring(0, eqIdx).trim();
          const v = trimmed.substring(eqIdx + 1).trim();
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

// In local backend runner, set test environment to permit synthetic fixtures with strict token verification
if (!process.env.PULSEBRIDGE_ENV) {
  process.env.PULSEBRIDGE_ENV = 'test';
}

const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : 54321;

const server = http.createServer(async (nodeReq, nodeRes) => {
  // CORS Preflight
  nodeRes.setHeader('Access-Control-Allow-Origin', '*');
  nodeRes.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  nodeRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (nodeReq.method === 'OPTIONS') {
    nodeRes.writeHead(200);
    nodeRes.end('ok');
    return;
  }

  const url = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);

  if (url.pathname === '/health' || url.pathname === '/') {
    nodeRes.writeHead(200, { 'Content-Type': 'application/json' });
    nodeRes.end(
      JSON.stringify({
        status: 'healthy',
        service: 'PulseBridge Backend & Edge Function Runner',
        port: PORT,
        endpoints: [
          '/health',
          '/functions/v1/summarize-medical-report',
        ],
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  if (url.pathname.endsWith('/summarize-medical-report')) {
    const bodyBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeReq.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      nodeReq.on('end', () => resolve(Buffer.concat(chunks)));
      nodeReq.on('error', reject);
    });

    const headers = new Headers();
    for (const [key, val] of Object.entries(nodeReq.headers)) {
      if (val) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    const webReq = new Request(url.toString(), {
      method: nodeReq.method,
      headers,
      body: ['GET', 'HEAD'].includes(nodeReq.method || '') ? undefined : bodyBuffer,
    });

    try {
      const webRes = await handleSummarizeRequest(webReq);
      const resBody = await webRes.text();
      const resHeaders = Object.fromEntries(webRes.headers.entries());
      resHeaders['content-length'] = Buffer.byteLength(resBody).toString();
      nodeRes.writeHead(webRes.status, resHeaders);
      nodeRes.end(resBody);
    } catch (err: any) {
      nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
    return;
  }

  nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
  nodeRes.end(
    JSON.stringify({
      error: 'Endpoint not found',
      available: ['/health', '/functions/v1/summarize-medical-report'],
    })
  );
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PulseBridge Backend] Server running at http://localhost:${PORT}/`);
  console.log(`[PulseBridge Backend] Health check: http://localhost:${PORT}/health`);
  console.log(`[PulseBridge Backend] AI Summarizer endpoint: http://localhost:${PORT}/functions/v1/summarize-medical-report`);
});
