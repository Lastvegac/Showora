import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email('Email không hợp lệ')
  .max(254)
  .transform((v) => v.toLowerCase());
export const password = z
  .string()
  .min(12, 'Mật khẩu cần ít nhất 12 ký tự')
  .max(128, 'Tối đa 128 ký tự');
export const subdomain = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Chỉ dùng chữ thường, số và dấu gạch ngang')
  .refine(
    (v) =>
      ![
        'www',
        'app',
        'api',
        'admin',
        'mail',
        'smtp',
        'platform',
        'support',
        'static',
        'assets',
      ].includes(v),
    'Tên miền này được dành riêng',
  );
export const registrationSchema = z
  .object({
    email,
    password,
    displayName: z.string().trim().min(2).max(100),
    tenantName: z.string().trim().min(2).max(120),
    desiredSubdomain: subdomain,
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Vui lòng đồng ý điều khoản sử dụng' }),
    }),
  })
  .strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const emailSchema = z.object({ email }).strict();
export const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
export const verifyEmailSchema = tokenSchema
  .extend({ desiredSubdomain: subdomain.optional() })
  .strict();
export const resetPasswordSchema = tokenSchema.extend({ password }).strict();
export const tenantUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat('vi', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Múi giờ không hợp lệ'),
  })
  .strict();
export const permissionSchema = z
  .object({ key: z.string().min(1).max(100), scope: z.enum(['own', 'team', 'all']) })
  .strict();
export const roleSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    permissions: z
      .array(permissionSchema)
      .min(1)
      .max(100)
      .refine((v) => new Set(v.map((p) => p.key)).size === v.length, 'Quyền bị lặp'),
  })
  .strict();
export const inviteSchema = z
  .object({ email, roleIds: z.array(z.string().uuid()).min(1).max(10) })
  .strict();
export const acceptInviteSchema = tokenSchema
  .extend({ displayName: z.string().trim().min(2).max(100), password })
  .strict();
export const memberUpdateSchema = z
  .object({
    status: z.enum(['active', 'disabled']),
    roleIds: z.array(z.string().uuid()).min(1).max(10),
  })
  .strict();
export const teamSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    members: z
      .array(z.object({ memberId: z.string().uuid(), role: z.enum(['manager', 'sales']) }).strict())
      .max(100)
      .refine((v) => new Set(v.map((m) => m.memberId)).size === v.length, 'Thành viên bị lặp'),
  })
  .strict();
export const listSchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
