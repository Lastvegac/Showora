import { cloneElement, isValidElement, useId, type ReactNode, type ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  LoaderCircle,
  ArrowUpRight,
  Layers3,
  AlertCircle,
  Inbox,
  CheckCircle2,
} from 'lucide-react';

export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
const button = cva('button', {
  variants: {
    variant: {
      default: 'button-primary',
      secondary: 'button-secondary',
      ghost: 'button-ghost',
      danger: 'button-danger',
    },
    size: { default: '', sm: 'button-sm', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  asChild,
  busy,
  disabled,
  children,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof button> & { asChild?: boolean; busy?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(button({ variant, size }), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <>
          <LoaderCircle className="spin" size={16} />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('input', className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('input select', className)} {...props} />;
}
export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return <input type="checkbox" className={cn('checkbox', className)} {...props} />;
}
export function Field({
  label,
  error,
  hint,
  required,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  const id = useId();
  const fieldId = htmlFor ?? id;
  const control = isValidElement<ComponentProps<'input'>>(children)
    ? cloneElement(children, {
        id: fieldId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined,
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={fieldId}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {control}
      {error ? (
        <p className="field-error" role="alert" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('card', className)} {...props} />;
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'brand';
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Avatar({ name, size = 'default' }: { name: string; size?: 'default' | 'sm' }) {
  return (
    <span className={cn('avatar', size === 'sm' && 'avatar-sm')} aria-hidden="true">
      {name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((v) => v[0])
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={cn('logo', light && 'logo-light')}>
      <span className="logo-mark">
        <Layers3 size={22} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span>
          showora<span className="logo-period">.</span>
        </span>
      )}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('empty-state', compact && 'empty-state-compact')}>
      <div className="state-icon">{icon ?? <Inbox size={25} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message = 'Không tải được dữ liệu.',
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Đã có lỗi xảy ra</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <Button variant="secondary" size="sm" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'success';
}) {
  return (
    <div role="status" className={`notice notice-${tone}`}>
      {tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <div>{children}</div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function BottomActionBar({ children }: { children: ReactNode }) {
  return <div className="bottom-actions">{children}</div>;
}
export function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{description}</p>
    </Card>
  );
}
export function ExternalLink({ children, ...props }: ComponentProps<'a'>) {
  return (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
