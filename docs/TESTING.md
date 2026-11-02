# Kiểm thử SHOWORA

Ngày 02/11/2026. Phạm vi hiện tại: nền tảng Sprint 1. Các bài kiểm tra Product, Lead, notification realtime và website public trong master prompt được bổ sung khi có module tương ứng.

## Chuẩn bị

Cài đặt theo [README](../README.md), bật PostgreSQL và Mailpit. Không dùng môi trường khách hàng hoặc production cho kiểm thử.

```sh
pnpm test:db
```

Script chỉ nhận migration URL trỏ `localhost`/`127.0.0.1`, từ chối `NODE_ENV=production`, tạo database có hậu tố `_test` nếu chưa tồn tại, apply migrations và ghi `.env.test` với permission 0600. Script không drop database. Integration suite cũng kiểm tra database có hậu tố `_test`; dữ liệu test tồn tại sau lần chạy, mỗi lần dùng tên/email riêng. Không xem `.env.test` là cấu hình deployment.

## Các lớp kiểm tra

| Lệnh | Nội dung |
| --- | --- |
| `pnpm lint` | ESLint, React hooks, không warning |
| `pnpm typecheck` | TypeScript strict trên apps và packages |
| `pnpm format:check` | Prettier cho source/config |
| `pnpm test` | 3 Vitest validation + 8 Jest crypto, host, policy, entitlement |
| `pnpm test:integration` | 18 Supertest tests, NestJS + PostgreSQL RLS thật + SMTP local |
| `pnpm build` | Prisma generate, shared packages, NestJS, Vite và Next.js |
| `pnpm test:e2e` | 2 Playwright tests trên Chrome/Chromium, desktop và mobile viewport |

Integration tests xác minh runtime non-owner, tenant/role injection, Host/forwarded-host, JWT tenant mismatch, missing RLS context/pool reuse, protected owner/system roles, tenant composite FK, invitation single-use, delegation escalation, own/team scope, session revocation, concurrent staff quota, CSRF/Origin, append-only audit, refresh replay, password reset, expiry/recovery, verification recovery/subdomain conflict, dead-letter email lease và SMTP delivery.

E2E chạy chuỗi đăng ký → lấy email Mailpit → xác minh → login tenant → tạo nhóm/vai trò/lời mời → reload phiên → menu mobile → logout; bài thứ hai kiểm tra validation có nhãn truy cập được ở màn hình hẹp. E2E dùng database development qua app đang chạy, tạo dữ liệu test riêng; không chạy trên production. Kiểm tra mobile dùng viewport, chưa phải chứng nhận thiết bị thật hoặc accessibility audit toàn bộ.

## Trình duyệt

Local mặc định dùng Google Chrome đã cài. CI tự tải Chromium qua:

```sh
pnpm exec playwright install --with-deps chromium
```

`CI=true` chọn Chromium thay Chrome. Playwright tự chạy `pnpm dev` nếu cần; local có thể tái sử dụng server cổng 5178, CI luôn tạo server mới. PostgreSQL, Mailpit, migrations và local plan phải sẵn sàng trước đó.

Artifacts nằm trong `test-results/` và `playwright-report/`, được gitignore. Có thể xem HTML report bằng `pnpm exec playwright show-report`. Trace/email test có thể chứa thông tin phiên nên không xuất bản công khai.

## Kết quả và giới hạn

Kết quả bàn giao được ghi trong [SPRINT_1_REPORT](SPRINT_1_REPORT.md). CI workflow đã được viết trong `.github/workflows/ci.yml`; chưa chạy trên GitHub. Chưa có load test, external pentest, backup restore drill, hoặc kiểm thử nghiệp vụ các sprint sau. Không quy đổi các test nền tảng này thành việc đã đạt đủ 10 kịch bản nghiệm thu MVP.
