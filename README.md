# SHOWORA

Nền tảng SaaS đa doanh nghiệp: Product Showcase, Marketing CMS và Sales CRM. Phiên bản hiện tại triển khai **nền tảng Sprint 1**: identity, tenant, RBAC, nhân sự và nhóm. Product/CMS/CRM, website tenant và billing thương mại nằm ở các sprint tiếp theo.

## Mở bản local hiện tại

- Admin: <http://localhost:5178>
- Swagger: <http://localhost:4400/api/docs>
- Mailpit: <http://127.0.0.1:8025>
- Tenant: `http://<subdomain-đã-đăng-ký>.localhost:5178`

Đăng ký doanh nghiệp tại Admin → mở email trong Mailpit → xác minh → đăng nhập trên hostname doanh nghiệp. Không có tài khoản/mật khẩu quản trị mặc định. Dữ liệu được lưu trong PostgreSQL, email được gửi qua SMTP local.

## Cài đặt từ workspace mới

Yêu cầu Node.js 22.14 trở lên trong nhánh 22, pnpm 10 (đã pin `10.29.3`), Docker Engine/Compose. Chỉ dùng pnpm.

```sh
pnpm install --frozen-lockfile
pnpm local:env
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm db:configure --file infrastructure/local/plan.example.json
pnpm dev
```

`local:env` tự sinh secrets và database roles; từ chối ghi đè `.env` đã tồn tại. Trên workspace đã cài đặt, giữ `.env` cùng Docker volume hiện có và chạy `pnpm infra:up`, `pnpm dev`. Không chạy lại bộ sinh secrets để sửa lỗi kết nối với volume cũ.

`db:configure` là thao tác operator chủ động: cấu hình permission catalog và một phiên bản gói thử nghiệm **development**, trial 14 ngày, 5 chỗ nhân sự; không phải bảng giá/gói thương mại. Mỗi lần chạy tạo plan version mới; subscription hiện tại giữ nguyên version. Không có business seed tự động hoặc dữ liệu sản phẩm/khách hàng giả.

| Dịch vụ | Địa chỉ |
| --- | --- |
| Admin Vite | `localhost:5178` |
| API NestJS | `localhost:4400/api/v1` |
| PostgreSQL | `127.0.0.1:55432`, database `showora` |
| Mailpit SMTP / UI | `127.0.0.1:1025` / `127.0.0.1:8025` |
| Storefront scaffold | `localhost:3018`, bật riêng bằng `pnpm dev:storefront` |

Vite chuyển tiếp `/api` và giữ Host để backend xác định tenant. Trình duyệt gọi API cùng origin; không gọi trực tiếp cổng 4400 cho luồng đăng nhập. Nếu thay cổng local, cập nhật `.env`; Playwright hiện kiểm tra cổng 5178 mặc định. Storefront mới là trang thông báo nền tảng, chưa phục vụ nội dung tenant.

## Kiểm tra và build

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:db
pnpm test:integration
pnpm build
pnpm test:e2e
```

Integration dùng database riêng `showora_test`; E2E dùng app development và tạo dữ liệu kiểm thử có tên riêng. Xem [TESTING](docs/TESTING.md) trước khi chạy. Build tạo `apps/admin/dist`, API `apps/api/dist` và `apps/storefront/.next`. Chạy API đã build bằng `pnpm --filter @showora/api start` khi cấu hình DB sẵn và cổng API trống.

## Cấu trúc

```text
apps/admin             React, Vite, Router, TanStack Query
apps/api               NestJS, Prisma, PostgreSQL
apps/storefront        Next.js scaffold
packages/ui            Shared components và semantic design tokens
packages/shared-types  Hợp đồng TypeScript
packages/shared-validation  Zod schemas dùng chung
packages/config        TypeScript strict config
infrastructure         Docker local, cấu hình và scripts
docs                   Thiết kế, báo cáo, hướng dẫn
```

Runtime DB dùng role riêng, không owner/superuser/BYPASSRLS; migration dùng credential riêng. Không commit `.env`, `.env.test`, `.local`, database dumps hay tokens. `pnpm infra:down` dừng dependencies và giữ volume; không xóa volume nếu cần giữ dữ liệu.

## Tài liệu

- [Báo cáo Sprint 1: phạm vi, file, migration, API, kiểm thử và giới hạn](docs/SPRINT_1_REPORT.md)
- [Kiểm thử](docs/TESTING.md) · [Vận hành local và điều kiện deployment](docs/DEPLOYMENT.md)
- [PRD](docs/PRD.md) · [Kiến trúc](docs/ARCHITECTURE.md) · [ERD đích](docs/DATABASE_ERD.md)
- [API thiết kế](docs/API_SPEC.md) · [Bảo mật](docs/SECURITY.md)
- [Roadmap](docs/DEVELOPMENT_ROADMAP.md) · [UI/UX](docs/UI_UX_SPECIFICATION.md)

Chưa triển khai production. HTTPS, backup/restore drill, monitoring, custom domain/TLS, Super Admin, billing và các module nghiệp vụ còn phải hoàn tất theo roadmap trước khi nghiệm thu MVP.
