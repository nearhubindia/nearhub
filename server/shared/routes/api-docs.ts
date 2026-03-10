import type { Express, Request, Response } from 'express';
import { buildOpenApiSpec } from '../docs/openapi';

export function registerApiDocsRoutes(app: Express): void {
  app.get('/api/docs/openapi.json', (req: Request, res: Response) => {
    const spec = buildOpenApiSpec(req);
    res.json(spec);
  });

  app.get('/api/docs', (_req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NearHub API Docs</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="/api/docs/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  });
}
