import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const publicRouteKey = 'publicRoute';

/** Marks the route in the OpenAPI document. createOpenApiDocument turns it into "no token needed". */
export const publicRouteExtension = 'x-public';

/** Opens a route or a whole controller to everyone. Every other route needs a valid access token. */
export function Public(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(publicRouteKey, true),
    ApiExtension(publicRouteExtension, true),
  );
}
