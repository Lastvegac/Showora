# Vận hành local và chuẩn bị deployment

Ngày 02/11/2026. Hiện chỉ chạy local; chưa có môi trường staging/production được triển khai.

## Runbook hiện có

Thực hiện [README](../README.md) để sinh secrets local, bật Docker, migrate bằng migration role, cấu hình plan development và chạy API/Admin. PostgreSQL/Mailpit chỉ bind loopback. Compose này phục vụ phát triển, không phải bộ deployment production.

- Health: `GET /api/v1/health/live`, `GET /api/v1/health/ready`; readiness kiểm tra truy vấn DB.
- Swagger chỉ bật ngoài production: `/api/docs`.
- Email outbox lưu payload mã hóa AES-GCM, worker trong tiến trình API claim lease, retry, chuyển dead-letter sau giới hạn. Xóa payload sau gửi thành công. SMTP có thể giao trùng nếu worker chết sau gửi nhưng trước acknowledge; chưa bảo đảm exactly-once delivery.
- Dừng app bằng Ctrl-C; `pnpm infra:down` giữ Docker volume. Không xóa volume hoặc sinh lại credentials khi chưa có kế hoạch giữ/khôi phục dữ liệu.
- Migration đã apply không sửa tại chỗ. Tạo forward migration cho thay đổi mới; không tự drop/reset database để sửa schema.

## Credentials và isolation

`DATABASE_URL` là runtime role least privilege. `MIGRATION_DATABASE_URL` dùng cho Prisma migrate và CLI cấu hình plan, không đưa cho request handlers. Startup từ chối runtime role là owner/superuser/BYPASSRLS và kiểm tra FORCE RLS trên 13 bảng tenant hiện có. Tenant context dùng transaction-local `set_config`; không dùng session-level setting qua pool.

Host được backend đọc trực tiếp; forwarded-host không được tin. Khi triển khai reverse proxy, phải giữ Host hợp lệ, chặn Host ngoài allowlist và chỉ cho truy cập API từ proxy. Frontend và API cùng origin, `/api` qua reverse proxy; không cấu hình wildcard CORS. Health routes bỏ qua tenant resolver; khi đi qua proxy, probes dùng Host trong allowlist của proxy.

Không log/in public env files. Cần giữ khóa mã hóa mail cùng backup để đọc các jobs còn chờ; xoay khóa cần kế hoạch drain/re-encrypt. Production phải dùng secrets manager hoặc cơ chế quản lý secrets của hạ tầng.

## CI hiện có

Workflow PR/push `main`, `dev`: frozen install → local dependencies → migrate/configure/test DB → lint/format/typecheck/unit/integration → build → Playwright. Workflow giữ artifacts khi thất bại và dừng containers cuối job. Git remote đã trỏ tới [Lastvegac/Showora](https://github.com/Lastvegac/Showora); chưa cấu hình protected branches, environment secrets hoặc deploy jobs. Push `main` chạy CI, không triển khai production.

## Công việc trước staging/production

1. Cấp domain, DNS, SMTP, object storage và secrets thật; duyệt plan/pricing và retention.
2. Tạo Docker build/runtime images, Nginx routing, HTTPS/TLS và custom-domain verification theo kiến trúc. Không dùng Vite dev server để phục vụ production.
3. Provision runtime/migration/resolver DB roles đúng grants; review RLS cho mỗi bảng mới, migration lock và expand/contract.
4. Thiết lập backup mã hóa, retention, WAL nếu cần; chạy restore drill có số liệu trước khi công bố RPO/RTO.
5. Metrics/logs/alerts, người nhận on-call, mail dead-letter recovery, health checks và rollback image/schema tương thích.
6. Thay rate limiter in-memory bằng cơ chế phù hợp khi có nhiều process; tách mail worker khi vận hành cần. Rà soát proxy trust/IP, abuse, log retention và audit.
7. Hoàn tất nghiệp vụ còn lại, security audit, load test và toàn bộ acceptance tests. Bổ sung staging/production pipelines và branch/environment protections thật trên GitHub.

Chưa có bằng chứng deployment, restore, TLS hoặc monitoring đạt yêu cầu; Sprint 1 không đủ điều kiện nghiệm thu production/MVP.
