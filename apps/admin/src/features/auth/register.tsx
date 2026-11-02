import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationInput } from '@showora/shared-validation';
import { Button, Field, Input, Checkbox, Notice } from '@showora/ui';
import { ArrowRight, MailCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorMessage, jsonBody } from '../../lib/api';
import { AuthLayout } from './auth-layout';
export function RegisterPage() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const form = useForm<RegistrationInput>({ resolver: zodResolver(registrationSchema) });
  const errors = form.formState.errors;
  async function submit(input: RegistrationInput) {
    setError('');
    try {
      await api('/auth/registrations', jsonBody(input));
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <AuthLayout>
      <div className="auth-form-wrap auth-form-wide">
        <span className="section-label">
          <Sparkles size={15} /> BẮT ĐẦU CÙNG SHOWORA
        </span>
        <h2>
          Không gian mới.
          <br />
          Tiềm năng mới<span className="accent-period">.</span>
        </h2>
        <p className="auth-description">Tạo nền tảng phát triển cho doanh nghiệp của bạn.</p>
        {sent ? (
          <div className="form-stack">
            <div className="verification-icon">
              <MailCheck size={32} />
            </div>
            <Notice tone="success">
              Yêu cầu đã được tiếp nhận. Hãy kiểm tra email để xác minh và tạo không gian doanh
              nghiệp.
            </Notice>
            <p className="text-muted text-small">
              Không thấy email? Kiểm tra thư rác hoặc yêu cầu gửi lại liên kết xác minh.
            </p>
            <Button asChild>
              <Link to="/verify-email">
                Kiểm tra xác minh <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={form.handleSubmit(submit)} noValidate>
            <div className="form-row">
              <Field label="Họ và tên" error={errors.displayName?.message} required>
                <Input
                  {...form.register('displayName')}
                  autoComplete="name"
                  placeholder="Họ tên của bạn"
                />
              </Field>
              <Field label="Tên doanh nghiệp" error={errors.tenantName?.message} required>
                <Input
                  {...form.register('tenantName')}
                  autoComplete="organization"
                  placeholder="Doanh nghiệp của bạn"
                />
              </Field>
            </div>
            <Field label="Email công việc" error={errors.email?.message} required>
              <Input
                {...form.register('email')}
                type="email"
                autoComplete="email"
                placeholder="ban@doanhnghiep.vn"
              />
            </Field>
            <Field
              label="Tên miền doanh nghiệp"
              error={errors.desiredSubdomain?.message}
              hint="Chữ thường, số và gạch ngang. Tối thiểu 3 ký tự."
              required
            >
              <Input
                {...form.register('desiredSubdomain')}
                placeholder="ten-doanh-nghiep"
                autoCapitalize="none"
              />
            </Field>
            <Field
              label="Mật khẩu"
              error={errors.password?.message}
              hint="Ít nhất 12 ký tự. Bạn có thể dùng một cụm từ dễ nhớ."
              required
            >
              <Input
                {...form.register('password')}
                type="password"
                autoComplete="new-password"
                placeholder="Tạo mật khẩu an toàn"
              />
            </Field>
            <label className="consent-line">
              <Checkbox {...form.register('consent')} />
              <span>
                Tôi đồng ý sử dụng thông tin trên để tạo và vận hành tài khoản doanh nghiệp.
              </span>
            </label>
            {errors.consent && (
              <p className="field-error" role="alert">
                {errors.consent.message}
              </p>
            )}
            {error && <Notice tone="warning">{error}</Notice>}
            <Button type="submit" busy={form.formState.isSubmitting}>
              Tạo không gian doanh nghiệp <ArrowRight size={16} />
            </Button>
          </form>
        )}
        <p className="auth-switch">
          Đã có tài khoản?{' '}
          <Link className="text-link" to="/login">
            Đăng nhập
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
