import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { SESSION_COOKIE } from './modules/auth/session.service';

/** OpenAPI docs at /api/docs (JSON at /api/docs/openapi.json). Not served in production. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Natik API')
    .setDescription(
      'JSON API of the Natik Language Centre platform. All routes are under /api/v1. ' +
        'Errors always use the shape { error: { code, message, fields?, params?, requestId } }.',
    )
    .setVersion('1.0')
    .addCookieAuth(SESSION_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: 'api/docs/openapi.json',
    customSiteTitle: 'Natik API',
  });
}
