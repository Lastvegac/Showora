import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Field, Input, Notice } from '@showora/ui';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  acceptInviteSchema,
  emailSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@showora/shared-validation';
import { api, errorMessage, jsonBody } from '../../lib/api';
import { AuthLayout } from './auth-layout';
type Kind = 'verify' | 'forgot' | 'reset' | 'invitation';
const copy: Record<Kind, { title: string; description: string; button: string }> = {
  verify: {
    title: 'Xác minh email',
    description: 'Chỉ một bước nữa để bắt đầu không gian doanh nghiệp.',
    button: 'Xác minh và tạo doanh nghiệp',
  },
  forgot: {
    title: 'Quên mật khẩu?',
    description: 'Nhập email để nhận liên kết đặt lại mật khẩu an toàn.',
    button: 'Gửi liên kết đặt lại',
  },
  reset: {
    title: 'Mật khẩu mới',
    description: 'Chọn một mật khẩu an toàn cho tài khoản của bạn.',
    button: 'Cập nhật mật khẩu',
  },
  invitation: {
    title: 'Cùng phát triển',
    description:
      'Xác nhận lời mời tham gia doanh nghiệp. Nếu đã có tài khoản, sử dụng mật khẩu hiện tại.',
    button: 'Tham gia doanh nghiệp',
  },
};
export function AccountActionPage({ kind }: { kind: Kind }) {
  const [params, setParams] = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const form = useForm<{
    email: string;
    password: string;
    displayName: string;
    desiredSubdomain: string;
  }>();
  const needsEmail = kind === 'forgot' || (kind === 'verify' && !token);
  async function submit(input: {
    email: string;
    password: string;
    displayName: string;
    desiredSubdomain: string;
  }) {
    setError('');
    const payload = needsEmail
      ? { email: input.email }
      : kind === 'verify'
        ? {
            token,
            ...(input.desiredSubdomain?.trim() ? { desiredSubdomain: input.desiredSubdomain } : {}),
          }
        : kind === 'invitation'
          ? { token, displayName: input.displayName, password: input.password }
          : { token, password: input.password };
    const schema = needsEmail
      ? emailSchema
      : kind === 'verify'
        ? verifyEmailSchema
        : kind === 'invitation'
          ? acceptInviteSchema
          : resetPasswordSchema;
    const result = schema.safeParse(payload);
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join('. '));
      return;
    }
    try {
      const path =
        kind === 'forgot'
          ? '/auth/forgot-password'
          : kind === 'verify'
            ? token
              ? '/auth/verify-email'
              : '/auth/resend-verification'
            : kind === 'reset'
              ? '/auth/reset-password'
              : '/invitations/accept';
      const response = await api<{ message?: string; adminUrl?: string }>(
        path,
        jsonBody(result.data),
      );
      setSuccess(
        response.message ?? 'Email đã được xác minh. Không gian doanh nghiệp của bạn đã sẵn sàng.',
      );
      setAdminUrl(response.adminUrl ?? '');
      setParams({}, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <AuthLayout>
      <div className="auth-form-wrap">
        <span className="section-label">
          <ShieldCheck size={15} /> TÀI KHOẢN SHOWORA
        </span>
        <h2>
          {copy[kind].title}
          <span className="accent-period">.</span>
        </h2>
        <p className="auth-description">{copy[kind].description}</p>
        {success ? (
          <div className="form-stack">
            <Notice tone="success">{success}</Notice>
            <Button asChild>
              {adminUrl ? (
                <a href={`${adminUrl}/login`}>
                  Đến không gian doanh nghiệp <ArrowRight size={16} />
                </a>
              ) : (
                <Link to="/login">
                  Quay lại đăng nhập <ArrowRight size={16} />
                </Link>
              )}
            </Button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={form.handleSubmit(submit)} noValidate>
            {needsEmail && (
              <Field label="Email" required>
                <Input
                  {...form.register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="ban@doanhnghiep.vn"
                />
              </Field>
            )}
            {kind === 'verify' && token && (
              <Field
                label="Tên miền thay thế (tùy chọn)"
                hint="Để trống để dùng tên đã đăng ký. Nếu tên đã được sử dụng, hãy chọn tên khác."
              >
                <Input {...form.register('desiredSubdomain')} placeholder="ten-doanh-nghiep" />
              </Field>
            )}
            {kind === 'invitation' && (
              <Field label="Họ và tên" required>
                <Input {...form.register('displayName')} autoComplete="name" />
              </Field>
            )}
            {(kind === 'reset' || kind === 'invitation') && (
              <Field
                label={kind === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                hint="Tối thiểu 12 ký tự"
                required
              >
                <Input
                  {...form.register('password')}
                  type="password"
                  autoComplete={kind === 'reset' ? 'new-password' : 'current-password'}
                />
              </Field>
            )}
            {!token && !needsEmail && (
              <Notice tone="warning">
                Thiếu liên kết xác nhận. Vui lòng mở lại liên kết trong email.
              </Notice>
            )}
            {error && (
              <Notice tone="warning">
                {error}
                {kind === 'verify' && token && (
                  <p>
                    <Link className="text-link" to="/verify-email">
                      Nhận liên kết xác minh mới
                    </Link>
                  </p>
                )}
              </Notice>
            )}
            <Button
              type="submit"
              busy={form.formState.isSubmitting}
              disabled={!needsEmail && !token}
            >
              {needsEmail && kind === 'verify' ? 'Gửi lại liên kết xác minh' : copy[kind].button}
              <ArrowRight size={16} />
            </Button>
          </form>
        )}
        <p className="auth-switch">
          <Link className="text-link" to="/login">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
