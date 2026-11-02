import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
const convert = zodToJsonSchema as unknown as (schema: unknown, options: unknown) => unknown;
export function apiSchema(schema: ZodTypeAny): SchemaObject {
  return convert(schema, { $refStrategy: 'none' }) as SchemaObject;
}
