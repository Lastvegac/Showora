import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { ApiError } from './errors';

export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Thông tin chưa hợp lệ.',
        result.error.flatten().fieldErrors,
      );
    return result.data as unknown;
  }
}
