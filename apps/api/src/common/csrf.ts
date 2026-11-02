import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Response } from 'express';
import { SETTINGS, type Settings } from './config';
import { secretToken, safeEqual } from './crypto';
import { ApiError } from './errors';
import type { AppRequest } from '../modules/authorization/actor';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(SETTINGS) private readonly settings: Settings) {}
  private sign(value: string, host: string) {
    return createHmac('sha256', this.settings.CSRF_SECRET).update(`${host}|${value}`).digest('hex');
  }
  issue(req: AppRequest, res: Response) {
    const value = `${Date.now() + 86400000}.${secretToken()}`;
    const token = `${value}.${this.sign(value, req.headers.host ?? '')}`;
    res.cookie('showora_csrf', token, {
      httpOnly: true,
      secure: this.settings.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1',
      maxAge: 86400000,
    });
    return { csrfToken: token };
  }
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const fail = () =>
      new ApiError(403, 'CSRF_INVALID', 'Yêu cầu không hợp lệ. Vui lòng tải lại trang.');
    let origin: URL;
    try {
      origin = new URL(req.headers.origin ?? '');
    } catch {
      throw fail();
    }
    const expectedProtocol =
      this.settings.NODE_ENV === 'production'
        ? 'https:'
        : new URL(this.settings.ADMIN_ORIGIN).protocol;
    if (origin.host !== req.headers.host || origin.protocol !== expectedProtocol) throw fail();
    const token = req.header('x-csrf-token');
    const cookie: unknown = req.cookies?.showora_csrf;
    if (!token || typeof cookie !== 'string' || !safeEqual(token, cookie)) throw fail();
    const [expires, nonce, signature, extra] = token.split('.');
    if (
      !expires ||
      !nonce ||
      !signature ||
      extra ||
      !Number.isFinite(Number(expires)) ||
      Number(expires) < Date.now() ||
      !safeEqual(this.sign(`${expires}.${nonce}`, req.headers.host ?? ''), signature)
    )
      throw fail();
    return true;
  }
}
