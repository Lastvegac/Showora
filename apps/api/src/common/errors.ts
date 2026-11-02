import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response, Request } from 'express';

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super({ code, message, fieldErrors }, status);
  }
}
export const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
export const notFound = () => new ApiError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
export const unauthorized = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & { requestId: string }>();
    let status = 500;
    let body: Record<string, unknown> = {
      code: 'INTERNAL_ERROR',
      message: 'Có lỗi xảy ra. Vui lòng thử lại.',
    };
    if (error instanceof HttpException) {
      status = error.getStatus();
      const value = error.getResponse();
      body = typeof value === 'object' ? { ...value } : { message: value };
      if (!body.code) body.code = status === 429 ? 'RATE_LIMITED' : `HTTP_${status}`;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      status = 409;
      body = { code: 'CONFLICT', message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.' };
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          level: 'error',
          requestId: request.requestId,
          event: 'request.failed',
          errorType: error instanceof Error ? error.constructor.name : 'unknown',
        }),
      );
    response.status(status).json({ error: { ...body, requestId: request.requestId } });
  }
}
