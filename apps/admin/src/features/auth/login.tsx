import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, subdomain, type LoginInput } from '@showora/shared-validation';
import { Button, Field, Input, Notice } from '@showora/ui';
import { ArrowRight, Building2 } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/session';
import { useHost } from '../../app/host';
import { errorMessage } from '../../lib/api';
import { AuthLayout } from './auth-layout';
export function LoginPage() {
  const session = useSession();
  const host = useHost();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState('');
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  if (session.viewer) return <Navigate to="/" replace />;
  async function submit(input: LoginInput) {
    setError('');
    try {
      await session.login(input);
      navigate('/');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <AuthLayout>
      <div className="auth-form-wrap">
        <span className="section-label">
          <Building2 size={15} /> KHÔNG GIAN DOANH NGHIỆP
        </span>
        <h2>
          Chào mừng trở lại<span className="accent-period">.</span>
        </h2>
        <p className="auth-description">Đăng nhập và tiếp tục hành trình phát triển của bạn.</p>
        {host.isPlatform ? (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const result = subdomain.safeParse(workspace);
              if (!result.success) {
                setError('Vui lòng nhập tên không gian hợp lệ.');
                return;
              }
              const origin = new URL(host.platformOrigin);
              origin.hostname = `${result.data}.${host.baseDomain}`;
              window.location.assign(`${origin.origin}/login`);
            }}
          >
            <Field label="Tên không gian doanh nghiệp" hint="Tên miền bạn đã chọn khi đăng ký">
              <Input
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="ten-doanh-nghiep"
                required
              />
            </Field>
            {error && <Notice tone="warning">{error}</Notice>}
            <Button type="submit">
              Tiếp tục <ArrowRight size={16} />
            </Button>
          </form>
        ) : (
          <form onSubmit={form.handleSubmit(submit)} className="form-stack" noValidate>
            <div className="workspace-hint">
              <Building2 size={15} />
              {window.location.hostname}
            </div>
            <Field label="Email" error={form.formState.errors.email?.message} required>
              <Input
                {...form.register('email')}
                type="email"
                autoComplete="username"
                placeholder="ban@doanhnghiep.vn"
              />
            </Field>
            <Field label="Mật khẩu" error={form.formState.errors.password?.message} required>
              <Input
                {...form.register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu của bạn"
              />
            </Field>
            <Link className="text-link forgot-link" to="/forgot-password">
              Quên mật khẩu?
            </Link>
            {error && <Notice tone="warning">{error}</Notice>}
            <Button type="submit" busy={form.formState.isSubmitting}>
              Đăng nhập <ArrowRight size={16} />
            </Button>
          </form>
        )}
        <p className="auth-switch">
          Bạn mới đến SHOWORA?{' '}
          <a className="text-link" href={`${host.platformOrigin}/register`}>
            Tạo doanh nghiệp
          </a>
        </p>
        <div className="auth-trust">
          <ShieldDots /> Dữ liệu riêng tư. Đồng hành cùng doanh nghiệp.
        </div>
      </div>
    </AuthLayout>
  );
}
function ShieldDots() {
  return <span className="trust-dot" />;
}
