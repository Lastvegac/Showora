# Báo cáo nền tảng Sprint 1

Ngày bàn giao: 02/11/2026. Người dùng đã xác nhận chuyển từ giai đoạn tài liệu sang viết code. Phạm vi lần này: monorepo, Authentication, Tenant, RBAC, User/Team Management và hạ tầng local. **Chưa nghiệm thu MVP hoặc production**.

## Chức năng đã hoạt động

- pnpm workspace gồm React/Vite Admin, NestJS API, Next.js storefront scaffold và bốn packages dùng chung; strict TypeScript, lint/format, lockfile và CI workflow.
- Đăng ký doanh nghiệp ở platform host; email xác minh qua SMTP; transaction tạo tenant, subdomain, owner, system roles, trial subscription và settings. Token dùng một lần, có resend/recovery khi hết hạn hoặc hostname bị trùng.
- Đăng nhập trên tenant host; Argon2id, JWT có session và tenant binding, refresh token hash/rotation/replay detection, logout/revoke sessions. Quên/đặt lại mật khẩu thu hồi các phiên hiện có.
- RBAC backend và giới hạn delegation; custom roles, scope all/team/own; bảo vệ owner và system roles. Chưa có ownership transfer.
- Danh sách nhân sự, mời qua email/accept/revoke, đổi trạng thái/vai trò; tạo/sửa nhóm và thành viên nhóm. Mời đang hiệu lực giữ chỗ quota nhân sự; kiểm tra đồng thời dưới tenant row lock.
- Host resolver xác định tenant, không nhận tenant ID từ body. Transaction-local tenant context, composite foreign keys và PostgreSQL ENABLE/FORCE RLS trên 13 bảng tenant hiện có.
- Trial/entitlement nền tảng: writable, read-only, expiry và recovery status; subscription đọc version bất biến, không tự gán giá thương mại.
- Audit tenant append-only; encrypted durable email outbox có lease/retry/dead-letter, SMTP thật. API startup kiểm tra runtime database role và trạng thái RLS.
- Admin tiếng Việt, responsive desktop/mobile; đăng ký/xác minh/login/reset, dashboard số liệu nhân sự thật, members/roles/teams/settings. Shared components/tokens, dialog, loading/empty/error và bottom actions. Menu nghiệp vụ tương lai ghi “Sắp có”.

Frontend giữ access token trong bộ nhớ; refresh cookie HttpOnly, host-only, SameSite=Strict, Secure khi production. Mutations kiểm tra signed CSRF token và Origin chính xác. Frontend refresh single-flight, dùng Web Locks khi trình duyệt hỗ trợ để phối hợp các tab. Cache key gắn tenant/member/permissions; xóa dữ liệu phiên khi logout.

## Database và migrations

Schema thực tế: [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma), **22 models**. Identity và system tables có grants riêng, không tuyên bố mọi bảng đều dùng tenant RLS.

| Migration | Nội dung | Kết quả local |
| --- | --- | --- |
| [202611020001_foundation](../apps/api/prisma/migrations/202611020001_foundation/migration.sql) | Bảng identity/tenant/RBAC/team/invitation/plan/subscription/usage/settings/audit/outbox, UUID, keys, indexes | Applied vào `showora`, `showora_test` |
| [202611020002_isolation](../apps/api/prisma/migrations/202611020002_isolation/migration.sql) | RLS/grants, constraints/partial indexes, composite FKs, invitation validation, restricted hostname resolver | Applied vào `showora`, `showora_test` |

Runtime `showora_app`: non-owner, NOSUPERUSER, NOBYPASSRLS. `showora_resolver`: NOLOGIN, resolver function có SELECT policy giới hạn. `showora_migrator` phục vụ migration/operator local, tách khỏi runtime. DB host local là `127.0.0.1:55432`.

13 bảng RLS: `tenants`, `tenant_domains`, `tenant_members`, `roles`, `role_permissions`, `member_roles`, `sales_teams`, `team_members`, `member_invitations`, `subscriptions`, `usage_records`, `website_settings`, `audit_logs`.

Không có destructive down migration, reset DB hoặc seed dữ liệu sản phẩm. CLI cấu hình plan phải chạy chủ động với file đúng environment; mỗi lần tạo version mới, không sửa subscription cũ.

## API đã triển khai

Prefix `/api/v1`. Swagger ngoài production: <http://localhost:4400/api/docs>. Các endpoint chưa xuất hiện trong bảng này nhưng có trong API_SPEC vẫn là thiết kế tương lai.

| Method | Path | Bảo vệ/phạm vi |
| --- | --- | --- |
| GET | `/health/live`, `/health/ready` | Health public, bỏ qua tenant resolver; ready kiểm tra DB |
| GET | `/auth/context`, `/auth/csrf` | Host context và CSRF bootstrap |
| POST | `/auth/registrations` | Platform host, validation/CSRF/rate limit |
| POST | `/auth/verify-email` | Platform host, token single-use; tùy chọn subdomain recovery |
| POST | `/auth/resend-verification` | Platform host, generic response, rate limit |
| POST | `/auth/login` | Tenant host, password/rate limit |
| POST | `/auth/refresh`, `/auth/logout` | Tenant host, refresh cookie, CSRF/Origin |
| GET | `/auth/me` | JWT/session/membership và tenant host |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Generic forgot response, single-use reset, rate limit |
| GET | `/account/sessions` | Phiên của user đã xác thực |
| DELETE | `/account/sessions/:id` | Revoke phiên thuộc user |
| POST | `/invitations/accept` | Tenant host, token single-use, validation/rate limit |
| GET | `/tenant` | `tenant.read` |
| PATCH | `/tenant` | `tenant.write`, tên và timezone |
| GET | `/tenant/overview` | `members.manage`, số liệu nền tảng thật |
| GET | `/members` | `members.read`, scope và cursor pagination |
| PATCH | `/members/:id` | `members.manage`, delegation/owner/quota checks |
| GET, POST | `/members/invitations` | `members.manage`, invite giữ quota |
| DELETE | `/members/invitations/:id` | `members.manage`, revoke |
| GET | `/members/assignable-roles` | `members.manage`, role delegation filter |
| GET, POST | `/roles` | `roles.manage`, custom role creation |
| PATCH, DELETE | `/roles/:id` | `roles.manage`, protected system roles, revoke affected sessions |
| GET | `/permissions` | `roles.manage`, catalog trong phạm vi actor |
| GET, POST | `/teams` | `teams.manage` |
| PATCH | `/teams/:id` | `teams.manage`, tenant/member validation |
| GET | `/teams/eligible-members` | `teams.manage`, cursor pagination |
| GET | `/subscription` | `billing.read`, plan/usage/status |
| GET | `/recovery/status` | Authenticated recovery metadata; không tự gia hạn |
| GET | `/audit-logs` | `audit.read`, tenant scope/cursor pagination |

Mọi mutation còn phải qua CSRF/Origin và entitlement phù hợp. Expired/suspended chỉ cho identity/recovery allowlist theo guard. Các routes member/session đọc dữ liệu từ actor đã xác thực, không tin role/tenant truyền từ frontend.

## Kiểm chứng bàn giao

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm lint` | Passed, không warning |
| `pnpm typecheck` | Passed toàn workspace |
| `pnpm format:check` | Passed source/config |
| `pnpm test` | **11 passed**: 3 Vitest + 8 Jest |
| `pnpm test:integration` | **18 passed**, DB/SMTP local thật |
| `pnpm test:e2e` | **2 passed**, Chrome desktop/mobile viewport |
| `pnpm build` | API, Admin, shared packages, storefront scaffold build thành công |
| Compiled API smoke | Chạy bản `dist` ở cổng tạm, ready trả HTTP 200; đã dừng riêng tiến trình smoke |
| Built Admin smoke | Chrome tải trang đăng ký qua Vite preview, lazy chunks và validation hoạt động, không có page error |

Tổng **31 tests passed**. Integration gồm tenant isolation, missing context/pool reuse, Host/JWT binding, escalation, team/own scope, quota concurrency, CSRF, append-only audit, refresh replay, reset/session revocation, expiry/recovery và email outbox. Chi tiết lệnh/phạm vi: [TESTING](TESTING.md).

Admin dùng lazy routes và các chunks framework/router/query riêng; bản build cuối không còn cảnh báo chunk lớn hơn 500 kB. Chưa có performance/load benchmark. Screenshots E2E desktop/mobile đã được xem để kiểm tra bố cục và overflow; artifacts nằm trong thư mục gitignored.

## Phần chưa có và giới hạn

- Product/Category/Brand/Media, dynamic specification builder, blog/projects, lead capture/CRM/pipeline/reports, Socket.IO và public tenant SSR/SEO chưa triển khai. Storefront hiện là scaffold thông báo, không phải website TECHPLUS.
- Super Admin/MFA, commercial billing/invoices/payment provider, coupon, custom-domain DNS/TLS và ownership transfer chưa có. Owner hiện được bảo vệ khỏi deactivate/chỉnh role.
- Chỉ có plan development do operator cấu hình. Chưa có giá thương mại được duyệt, không tự tạo Starter/Business/Professional với giá giả.
- Rate limit in-memory; mail poller nằm trong API process. Outbox có thể giao email trùng khi crash sau SMTP delivery; chưa có dead-letter recovery UI.
- Chưa có production Docker images/Nginx, HTTPS, deployment staging/production, backup restore drill, monitoring/on-call, load test hoặc independent pentest. CI chỉ được viết, chưa chạy trên GitHub và chưa cấu hình protected branches.
- Các bài kiểm thử nền tảng không thay thế đủ 10 kịch bản nghiệp vụ bắt buộc trong master prompt. Chưa chứng minh behavior cho module chưa tồn tại.
- Không có lỗi chặn trong các checks đã chạy; các mục trên vẫn là công việc chưa hoàn tất trước nghiệm thu toàn sản phẩm.

## Chạy local và bước tiếp theo

Hướng dẫn đầy đủ tại [README](../README.md). Admin <http://localhost:5178>, API <http://localhost:4400/api/v1>, Mailpit <http://127.0.0.1:8025>. Đăng ký tài khoản mới rồi xác minh email trong Mailpit; không có mật khẩu mặc định.

Sprint tiếp theo theo roadmap là Product/Category/Brand/Media/CMS. Trước khi mở rộng cần giữ các invariants tenant isolation, delegation và quota trong mỗi repository/API mới. Nội dung TECHPLUS chỉ dùng dữ liệu có nguồn; chưa có sản phẩm/thông số thì giữ empty/draft.

## Files tạo/sửa

Workspace ban đầu chỉ có bộ tài liệu thiết kế. Code/config bên dưới được tạo trong giai đoạn này; bảy tài liệu thiết kế được cập nhật trạng thái và liên kết về báo cáo. Không liệt kê secrets, dependencies hoặc build/test artifacts.

<!-- source-inventory -->

```text
.github/workflows/ci.yml
.gitignore
.node-version
.npmrc
.prettierignore
.prettierrc.json
README.md
apps/admin/index.html
apps/admin/package.json
apps/admin/src/app/host.tsx
apps/admin/src/app/query-key.ts
apps/admin/src/app/router.tsx
apps/admin/src/app/session.tsx
apps/admin/src/app/shell.tsx
apps/admin/src/features/auth/account-actions.tsx
apps/admin/src/features/auth/auth-layout.tsx
apps/admin/src/features/auth/login.tsx
apps/admin/src/features/auth/register.tsx
apps/admin/src/features/dashboard/dashboard.tsx
apps/admin/src/features/members/member-dialog.tsx
apps/admin/src/features/members/members.tsx
apps/admin/src/features/members/role-picker.tsx
apps/admin/src/features/roles/role-dialog.tsx
apps/admin/src/features/roles/roles.tsx
apps/admin/src/features/settings/settings.tsx
apps/admin/src/features/teams/team-dialog.tsx
apps/admin/src/features/teams/teams.tsx
apps/admin/src/lib/api.ts
apps/admin/src/main.tsx
apps/admin/src/styles.css
apps/admin/tsconfig.json
apps/admin/vite.config.ts
apps/api/jest.config.cjs
apps/api/jest.integration.config.cjs
apps/api/package.json
apps/api/prisma/migrations/202611020001_foundation/migration.sql
apps/api/prisma/migrations/202611020002_isolation/migration.sql
apps/api/prisma/migrations/migration_lock.toml
apps/api/prisma/schema.prisma
apps/api/scripts/configure-plan.ts
apps/api/scripts/prepare-test-db.ts
apps/api/src/app.module.ts
apps/api/src/app.ts
apps/api/src/common/config.ts
apps/api/src/common/crypto.test.ts
apps/api/src/common/crypto.ts
apps/api/src/common/csrf.ts
apps/api/src/common/database.ts
apps/api/src/common/errors.ts
apps/api/src/common/openapi.ts
apps/api/src/common/validation.ts
apps/api/src/main.ts
apps/api/src/modules/authorization/actor.ts
apps/api/src/modules/authorization/auth.guard.ts
apps/api/src/modules/authorization/authorization.service.ts
apps/api/src/modules/authorization/policy.test.ts
apps/api/src/modules/authorization/policy.ts
apps/api/src/modules/identity/auth.controller.ts
apps/api/src/modules/identity/invitation.service.ts
apps/api/src/modules/identity/onboarding.service.ts
apps/api/src/modules/identity/password.service.ts
apps/api/src/modules/identity/session.service.ts
apps/api/src/modules/notifications/mail.service.ts
apps/api/src/modules/subscription/entitlement.service.ts
apps/api/src/modules/subscription/entitlement.test.ts
apps/api/src/modules/tenancy/host.service.ts
apps/api/src/modules/tenancy/host.test.ts
apps/api/src/modules/tenancy/role.service.ts
apps/api/src/modules/tenancy/team.service.ts
apps/api/src/modules/tenancy/tenancy.service.ts
apps/api/src/modules/tenancy/tenant.controller.ts
apps/api/test/foundation.test.ts
apps/api/tsconfig.build.json
apps/api/tsconfig.json
apps/storefront/next-env.d.ts
apps/storefront/next.config.ts
apps/storefront/package.json
apps/storefront/src/app/layout.tsx
apps/storefront/src/app/page.tsx
apps/storefront/tsconfig.json
docs/API_SPEC.md
docs/ARCHITECTURE.md
docs/DATABASE_ERD.md
docs/DEPLOYMENT.md
docs/DEVELOPMENT_ROADMAP.md
docs/PRD.md
docs/SECURITY.md
docs/SPRINT_1_REPORT.md
docs/TESTING.md
docs/UI_UX_SPECIFICATION.md
eslint.config.mjs
infrastructure/docker/compose.local.yml
infrastructure/local/plan.example.json
infrastructure/scripts/local-env.mjs
package.json
packages/config/package.json
packages/config/tsconfig.base.json
packages/shared-types/package.json
packages/shared-types/src/index.ts
packages/shared-types/tsconfig.json
packages/shared-validation/package.json
packages/shared-validation/src/index.test.ts
packages/shared-validation/src/index.ts
packages/shared-validation/tsconfig.build.json
packages/shared-validation/tsconfig.json
packages/ui/package.json
packages/ui/src/data-table.tsx
packages/ui/src/dialog.tsx
packages/ui/src/index.ts
packages/ui/src/primitives.tsx
packages/ui/src/styles.css
packages/ui/tsconfig.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
tests/e2e/onboarding.spec.ts
```
