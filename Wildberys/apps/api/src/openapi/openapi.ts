import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { publicRouteExtension } from '../auth/public.decorator.js';
import { ApiError } from '../errors/api-error.dto.js';

const accessTokenScheme = 'accessToken';
const httpMethods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'] as const;

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type Operation = NonNullable<OpenAPIObject['paths'][string]['get']>;
type MarkedOperation = Operation & { readonly [publicRouteExtension]?: unknown };

/** Routes marked with @Public() need no token. The marker itself does not belong in the document. */
function openPublicRoutes(document: OpenAPIObject): void {
  for (const path of Object.values(document.paths)) {
    for (const method of httpMethods) {
      const marked: MarkedOperation | undefined = path[method];

      if (marked) {
        const { [publicRouteExtension]: isPublic, ...operation } = marked;

        path[method] = isPublic === true ? { ...operation, security: [] } : operation;
      }
    }
  }
}

/** Describes the API. The api-client package is generated from this document. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Bluberi API')
    .setVersion('1')
    // Every route needs an access token, like the auth guard says. Public routes are opened below.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, accessTokenScheme)
    .addSecurityRequirements(accessTokenScheme)
    // Every route answers errors in the same shape, so the client types them once.
    .addGlobalResponse({ status: 'default', description: 'An error', type: ApiError })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    // HealthController.ready becomes "healthReady", the name of the function in the client.
    operationIdFactory: (controllerKey, methodKey) =>
      lowerFirst(controllerKey.replace(/Controller$/, '')) + upperFirst(methodKey),
  });

  openPublicRoutes(document);

  return document;
}

/** Serves Swagger UI under /docs and the document under /docs/openapi.json. */
export function serveOpenApiDocs(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/openapi.json',
    yamlDocumentUrl: 'docs/openapi.yaml',
  });
}
