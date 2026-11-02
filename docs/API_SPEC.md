# SHOWORA — REST API Specification

Ngày: 02/11/2026 · Phiên bản: 0.2 · **Hợp đồng đích; API nền tảng Sprint 1 chạy local**.

> Trạng thái code thực tế: [báo cáo Sprint 1](SPRINT_1_REPORT.md). Những module chưa được liệt kê là thiết kế cho giai đoạn tiếp theo.
## 1. Quy ước chung

- Base path `/api/v1`; REST JSON, Swagger/OpenAPI sinh từ DTO và controller khi triển khai. Public OpenAPI không công khai route vận hành nội bộ hoặc secret.
- Tenant được resolve từ host đã xác minh hoặc context JWT đã kiểm tra và phải khớp host. Không nhận `tenant_id`, `role`, `user_id` để tự cấp quyền từ business DTO; unknown fields bị từ chối. Gán Sale dùng `assigneeMemberId` có validation/authorization riêng.
- Auth dùng access JWT trong memory gửi `Authorization: Bearer …`; refresh token opaque trong cookie HttpOnly/Secure, host-only, SameSite theo chính sách. Refresh/logout có CSRF token + Origin validation. Cookie không dùng `Domain=.showora.vn`.
- Platform JWT có audience riêng, route `/platform/*`; tenant JWT không dùng được. Login platform không suy ra quyền từ email domain.
- UUID, ISO 8601 UTC, camelCase JSON; DB snake_case. Tiền là decimal string + currency, count trong miền JSON an toàn hoặc string nếu bigint vượt giới hạn.
- List trả `{ data: [...], page: { nextCursor, hasMore } }`. Mặc định `limit=20`, tối đa 100; cursor opaque ràng buộc tenant/filter/sort, thứ tự ổn định `(createdAt,id)`. Đây là giới hạn kỹ thuật đề xuất, không phải quota thương mại.
- Filters/sort theo allowlist, không đưa tên cột/raw SQL tùy ý. Date range có timezone rõ; `from` inclusive, `to` exclusive. Search giới hạn độ dài và rate.
- Read trả 200; create 201; delete/revoke 204; async import/export/verification 202. Mọi create có side effect quan trọng hỗ trợ `Idempotency-Key` và lưu request hash/expiry.
- Mutation tài nguyên đồng thời dùng `version` hoặc `If-Match`; mismatch trả 409 `VERSION_CONFLICT`. Không silent overwrite.
- Error envelope: `{ error: { code, message, fieldErrors?, requestId } }`; không trả stack trace, SQL, tên tenant khác, token hoặc PII không cần thiết.
- Ký hiệu nhiều method/path và dấu ngoặc trong bảng là cách rút gọn đặc tả. Khi triển khai, OpenAPI phải liệt kê từng route/method/DTO cụ thể; các nhóm `{projects,pages}` là hai namespace riêng, không là URL literal.

| HTTP | Mã tiêu biểu | Ý nghĩa |
|---|---|---|
| 400 / 422 | VALIDATION_ERROR | Body/query sai format hoặc rule nghiệp vụ |
| 401 | UNAUTHENTICATED / SESSION_REVOKED | Thiếu token, token hết hạn hoặc session không hợp lệ |
| 403 | FORBIDDEN / TENANT_READ_ONLY / FEATURE_UNAVAILABLE | Không có permission hoặc entitlement |
| 404 | NOT_FOUND | Không tìm thấy **hoặc ngoài tenant/resource scope**, không tiết lộ tồn tại |
| 409 | VERSION_CONFLICT / QUOTA_EXCEEDED / INVALID_TRANSITION | Xung đột cập nhật, hạn mức hoặc trạng thái |
| 413 / 415 | FILE_TOO_LARGE / UNSUPPORTED_MEDIA_TYPE | Upload không hợp lệ |
| 429 | RATE_LIMITED | Có Retry-After; không tạo side effect |
| 503 | TENANT_UNAVAILABLE / DEPENDENCY_UNAVAILABLE | Website tạm ngưng hoặc dependency thiết yếu lỗi |

## 2. Permission và resource scope

Permission keys là catalog server-controlled. System roles là template được tạo cho mỗi tenant. Custom role chỉ chọn permission/scope thuộc tập người cấp được phép ủy quyền; không có permission tạo SUPER_ADMIN. Thay đổi role tăng authz version, revoke/cache invalidate và ngắt socket bị ảnh hưởng.

| Nhóm permission | OWNER | ADMIN | EDITOR | MANAGER | SALES |
|---|---|---|---|---|---|
| website.read/write, domains.manage | all | all | read | — | — |
| products/categories/brands/attributes.read/write/publish/import/export | all | all | all | — | — |
| content.read/write/publish, media.read/write | all | all | all | — | — |
| members.read/manage, roles.manage | all | all, trừ owner | — | đọc thành viên team tối thiểu | — |
| teams.manage | all | all | — | — | — |
| leads.read/update, notes/activities/reminders/quotations.write | all | all | — | team | own |
| leads.assign | all | all | — | team | — |
| leads.reopen, leads.export | all | all | — | team | — |
| reports.read | all | all | — | team | own |
| billing.read/manage, recovery.export | all | — | — | — | — |
| audit.read | all, đã redact | all, đã redact | — | — | — |

`own` = `assigned_member_id` là membership của actor. `team` = Lead có `responsible_team_id` nằm trong team actor quản lý; không tự mở quyền mọi Lead của một Sale có nhiều team. Lead chưa có team chỉ owner/admin/all-scope thấy và phân vào team; manager thấy hàng đợi chưa giao của team mình. Assign trong team chỉ chọn Sales active của chính team; owner/admin có quyền all được chuyển team với lý do. Lead parent scope áp dụng cho mọi subresource và aggregate.

SUPER_ADMIN chỉ có platform permissions: `platform.tenants.*`, `platform.plans.*`, `platform.billing.*`, `platform.audit.read`. Không mặc định có `leads.read` hoặc quyền CMS của tenant.

## 3. API Module List

| Module | Namespace | Trách nhiệm |
|---|---|---|
| Identity | `/auth`, `/account` | Registration, verification, login, sessions, password |
| Tenancy/RBAC | `/tenant`, `/members`, `/roles`, `/teams`, `/domains` | Cấu hình tenant, quyền và nhân sự |
| Catalog | `/products`, `/categories`, `/brands`, `/attributes` | Product graph và thuộc tính động |
| CMS | `/posts`, `/blog-categories`, `/tags`, `/projects`, `/pages`, `/banners` | Nội dung, SEO, lịch xuất bản |
| Media | `/media` | Reservation, upload/finalize, download, folders |
| Website | `/website`, `/redirects` | Template, sections, navigation, SEO và tích hợp |
| CRM | `/leads`, `/lead-sources`, `/reports` | Capture nội bộ, chăm sóc và báo cáo |
| Notifications | `/notifications`, Socket.IO | Inbox, unread state và event |
| Billing | `/subscription`, `/invoices`, `/recovery` | Entitlement, payment request, export recovery |
| Public | `/public/*` | Published website data, contact, analytics |
| Platform | `/platform/*` | SaaS management, manual billing, platform audit |
| Operations | `/health/*` | Liveness/readiness hạn chế thông tin |

## 4. Identity và onboarding

| Method / path | Auth / policy | Hành vi |
|---|---|---|
| POST `/auth/registrations` | Platform public; throttle + anti-bot | Nhận email/password/tenantName/desiredSubdomain/consent; tạo onboarding request có hạn, gửi verify; trả 202 chung |
| POST `/auth/verify-email` | One-time token | Xác minh email, tạo tenant/owner/trial/default roles/settings nguyên tử; xử lý tranh chấp subdomain bằng lỗi có thể chọn lại, không tạo tenant dở dang |
| POST `/auth/resend-verification` | Public; throttle | 202 chung, không cho dò email |
| POST `/auth/login` | Tenant host + throttle | Kiểm tra membership/email/password, tạo session; không login nếu body cố chỉ định tenant/role |
| POST `/platform/auth/login` | Platform host + throttle | Platform identity riêng; challenge MFA cho SUPER_ADMIN trước cấp session hoàn chỉnh |
| POST `/platform/auth/mfa/verify` | Challenge một lần có hạn | Xác minh factor/recovery theo policy, không nhận platform role từ body |
| POST `/auth/refresh` | Refresh cookie + CSRF + Origin | Khớp host/audience của session tenant hoặc platform; rotation atomic, replay revoke family/session; 401 yêu cầu login lại |
| POST `/auth/logout` | Session + CSRF + Origin | Revoke session/family, clear cookie |
| GET `/auth/me` | JWT + active session | Profile, membership, permissions và entitlement hiện tại; không lộ tenant khác |
| GET `/account/sessions` | Account identity đã xác thực | Danh sách session của chính user, metadata tối thiểu |
| DELETE `/account/sessions/:id` | Chính chủ + step-up nếu cần | Revoke session; đóng socket tương ứng |
| POST `/auth/forgot-password` | Public throttle | Luôn 202; gửi link theo account nếu có |
| POST `/auth/reset-password` | One-time reset token | Đổi hash, revoke toàn bộ session và token reset cũ |
| POST `/invitations/accept` | Token mời + verified account | Khớp email, tenant, quota reservation, roles đã duyệt; single-use |

Subdomain được reserve tạm thời với expiry sau validation; chỉ activate sau verify và transaction thành công. Password policy, token TTL, MFA enrollment và recovery được mô tả ở [SECURITY.md](SECURITY.md). Bootstrap Super Admin qua tác vụ vận hành có audit, không public registration endpoint.

## 5. Tenant, nhân sự và website

| Method / path | Permission | Ghi chú |
|---|---|---|
| GET/PATCH `/tenant` | tenant.read/write | PATCH không sửa subscription/status platform hoặc tenant ID |
| GET `/members` | members.read + scope | Filter active/role/team, profile tối thiểu |
| POST `/members/invitations` | members.manage | Reserve staff quota; không mời owner hoặc cấp quyền cao hơn actor |
| PATCH `/members/:id` | members.manage | Disable/role changes có reassign workflow, giữ owner cuối cùng |
| POST `/tenant/ownership-transfer` | Owner + reauthentication | Người nhận active, xác nhận; transaction, audit, không dùng PATCH role thường |
| GET/POST/PATCH/DELETE `/roles[/:id]` | roles.manage | Custom roles; system owner invariant, dùng explicit method/path ở Swagger |
| GET `/permissions` | roles.manage | Chỉ trả catalog có thể cấp |
| GET/POST/PATCH `/teams[/:id]` | teams.manage | Manage team, không xóa team còn Lead chưa xử lý |
| PUT `/teams/:id/members` | teams.manage | Validate memberships, manager role, audit scope thay đổi |
| GET/POST `/domains` | domains.manage | List/add custom domain; feature entitlement |
| POST `/domains/:id/verify` | domains.manage | Async DNS/TLS verification, rate limit |
| POST `/domains/:id/set-primary` | domains.manage | Chỉ verified domain; invalidate canonical/cache |
| DELETE `/domains/:id` | domains.manage | Chặn xóa primary cuối, revoke binding trước release |
| GET/PATCH `/website/settings` | website.read/write | Versioned schema, logo/favicon, tokens, contacts, GA/GSC fields validated |
| GET/PUT `/website/navigation/:key` | website.read/write | Menu tree an toàn, internal links cùng tenant, chặn cycle |
| POST `/website/preview-tokens` | website.write hoặc content.write | Preview token ngắn hạn, tenant/resource-specific, không cache/index |
| GET/POST/PATCH/DELETE `/redirects[/:id]` | website.read/write | Chỉ relative source/target hợp lệ, 301 và loop detection |

Trong bảng rút gọn, `[/:id]` biểu diễn GET collection/POST collection và PATCH/DELETE item; không tạo route có ngoặc ở runtime. Các route GET item tương ứng được sinh rõ trong OpenAPI.

## 6. Catalog và CMS

| Method / path | Permission | Rule |
|---|---|---|
| GET `/products`, GET `/products/:id` | products.read | Cursor, search, status/category/brand/attribute filters, scope tenant |
| POST `/products`, PATCH `/products/:id` | products.write | Nested graph validated, quota lock, version check |
| DELETE `/products/:id` | products.write | Soft delete, unpublish/cache invalidate; không mất lead interest snapshot |
| POST `/products/:id/publish` | products.publish | Kiểm tra required fields/media/price/entitlement |
| POST `/products/:id/unpublish` | products.publish | Thu hồi public content/media references và cache |
| POST `/products/imports` | products.import | Private XLSX asset, validate-only trước commit, async job |
| POST `/products/exports` | products.export | Async scoped export, công thức spreadsheet được escape |
| GET `/products/imports/:jobId` | products.import + chủ job/all | Progress, row errors, không expose file tenant khác |
| POST `/products/imports/:jobId/commit` | products.import | Idempotent, quota recheck mỗi batch; báo rõ partial batch outcome |
| GET/POST/PATCH/DELETE `/categories[/:id]` | categories.read/write | Parent cycle và cross-tenant FK bị chặn |
| GET/POST/PATCH/DELETE `/brands[/:id]` | brands.read/write | Logo asset hợp lệ |
| GET/POST/PATCH/DELETE `/attributes[/:id]` | attributes.read/write | Key/type/options/unit/filterable, cấm đổi type phá dữ liệu |
| PUT `/categories/:id/attributes` | attributes.write | Required/order theo category, kiểm tra conflict |
| GET/POST/PATCH/DELETE `/posts[/:id]` | content.read/write | Sanitized rich text, tags/category, SEO, version |
| POST `/posts/:id/publish` | content.publish | Publish ngay hoặc `scheduledAt`; worker recheck entitlement |
| POST `/posts/:id/unpublish` | content.publish | Hủy lịch còn pending và invalidate public |
| GET/POST/PATCH/DELETE `/blog-categories[/:id]`, `/tags[/:id]` | content.read/write | Tenant-local slug |
| GET/POST/PATCH/DELETE `/projects[/:id]`, `/pages[/:id]`, `/banners[/:id]` | content.read/write | Gallery/SEO; banner effective dates; project linked products cùng tenant |
| POST `/{projects,pages}/:id/publish`, `.../unpublish` | content.publish | Publish explicit, không đổi status lén qua write-only DTO |

Product write contract: `name`, `slug`, optional `model`, `brandId`, `categoryIds`, `price: { type: EXACT | FROM | CONTACT, amount?, currency? }`, `attributes: [{ attributeId, value }]`, `images: [{ assetId, altText, order }]`, structured description/warranty và SEO. Backend lấy attribute definitions từ tenant, không tin type/unit do client tự gửi. Không đưa thông số máy phát điện thành cột bắt buộc toàn hệ thống.

## 7. Media

| Method / path | Permission | Hành vi |
|---|---|---|
| GET `/media` | media.read | Metadata tenant-scoped, folder/status/type filters |
| POST `/media/uploads` | media.write | Reserve bytes/quota, tạo object key server-side, upload URL ngắn hạn vào private quarantine |
| POST `/media/:id/finalize` | media.write | Kiểm tra actual size, signature/MIME, checksum và decode; async scan/re-encode; không tin Content-Type client |
| GET `/media/:id` | media.read + resource policy | Status và metadata; private URL chỉ khi quyền liên quan hợp lệ |
| POST `/media/:id/download-url` | media.read + resource policy | Signed URL TTL ngắn; attachment CRM yêu cầu Lead scope |
| DELETE `/media/:id` | media.write | Chặn asset đang được tham chiếu hoặc thu hồi theo workflow; quota giải phóng khi xóa vật lý xác nhận |
| GET/POST/PATCH/DELETE `/media/folders[/:id]` | media.read/write | Tree không cycle, không move sang tenant khác |

Pre-signed URL không phải bằng chứng file an toàn. Asset chỉ READY sau kiểm tra server/worker. File draft/CRM luôn private; chỉ rendition của media gắn published content được public.

## 8. Public website và Lead capture

| Method / path | Policy | Hành vi |
|---|---|---|
| GET `/public/website` | Host verified, subscription public-readable | Branding, navigation, sections, contacts đã cấu hình |
| GET `/public/home` | Published-only | Aggregate home: banners/categories/featured/posts/projects |
| GET `/public/products` | Published-only | Search, category/brand/typed attribute filter, sort allowlist, cursor |
| GET `/public/products/:slug` | Published-only | Product, safe gallery, related products cùng tenant |
| GET `/public/categories`, `/public/brands` | Published-only | Chỉ taxonomy có thể công khai |
| GET `/public/posts`, `/public/posts/:slug` | Published-only | Category/tag filters, sanitized content |
| GET `/public/projects`, `/public/projects/:slug`, `/public/pages/:slug` | Published-only | Không trả customer private fields |
| GET `/public/seo/sitemap-data`, `/public/seo/redirect` | Host verified | Dữ liệu cho Next sitemap/301, không lộ draft |
| POST `/public/leads` | Public + spam/rate/quota + origin policy | Capture transaction thật; trả acknowledgment tối thiểu |
| POST `/public/analytics/events` | Consent + allowlisted event + throttle | Payload tối thiểu, dedup, không chứa PII; 202 |

Next.js phục vụ `/sitemap.xml`, `/robots.txt`, HTML SSR/canonical/JSON-LD trên từng hostname; API không thay thế các URL SEO này.

### Lead submission contract

| Field | Validation / xử lý |
|---|---|
| fullName | Required, trim, giới hạn độ dài, plain text |
| phone, email | Ít nhất một hợp lệ; chuẩn hóa phone theo region cấu hình và email; không suy đoán dữ liệu thiếu |
| company, address | Optional, giới hạn độ dài, plain text |
| productIds | Optional, giới hạn số lượng; chỉ published products cùng tenant |
| requirement, message | Ít nhất một có nội dung; length bounds, plain text/sanitized |
| entryPoint | Enum contact/quote/product/landing; server xác minh route/product context |
| utmSource, utmMedium, utmCampaign | Optional, length-bound, sanitized; attribution metadata không là permission |
| landingPath, referrer | Chỉ lưu path và origin an toàn, loại query chứa PII; URL parse, không server-fetch |
| consent | Required accepted + policy version đang hiệu lực; server ghi acceptedAt |
| honeypot, challengeToken | Anti-spam fields, server verify challenge nếu bật; không log token |

Không nhận status, assignee, tenant, revenue từ public form. Server đặt NEW và source mapping. Response mới hoặc retry/duplicate được tiếp nhận đều dùng thông báo chung, không trả contact, assignee, internal Lead ID hoặc “email này đã tồn tại”. Cùng idempotency key khác payload trả conflict an toàn. Nếu quota/rate/subscription chặn thì trả lỗi thực tế và UI hướng dẫn thử lại/liên hệ qua hotline đã cấu hình.

## 9. CRM, báo cáo và thông báo

| Method / path | Permission và scope | Hành vi |
|---|---|---|
| GET `/leads`, GET `/leads/:id` | leads.read | Search/status/source/product/assignee/team/date; filter không mở rộng scope |
| POST `/leads` | leads.update | Tạo thủ công trong tenant/quota, source manual; scope/team hợp lệ |
| PATCH `/leads/:id` | leads.update | Contact/requirement/expected revenue, version; không đổi assignment/status qua DTO này |
| POST `/leads/:id/assign` | leads.assign | assigneeMemberId nullable, teamId, reason, version; transaction + notification |
| POST `/leads/:id/transitions` | leads.update hoặc leads.reopen | toStatus, reason, actualRevenue/currency khi WON, version; transition matrix trong PRD |
| GET/POST `/leads/:id/activities` | leads.read / activities.write | Timeline, log call/meeting/email; actor lấy từ context |
| GET/POST `/leads/:id/notes`, PATCH `/leads/:id/notes/:noteId` | leads.read / notes.write | Author chỉ sửa note của mình, manager không giả tác giả; history/audit |
| GET/POST/PATCH `/leads/:id/reminders[/:reminderId]` | leads.read / reminders.write | Owner recipient hợp lệ, UTC scheduling, cancel/complete |
| GET/POST/PATCH `/leads/:id/quotations[/:quotationId]` | leads.read / quotations.write | Metadata, amount/currency, private attachments |
| GET `/leads/:id/duplicate-candidates` | leads.assign + scope cả hai Lead | Không lộ contact của candidate ngoài phạm vi |
| POST `/leads/exports` | leads.export | Snapshot filters/scope, reauthorize lúc worker chạy và tải |
| GET/POST/PATCH `/lead-sources[/:id]` | leads.assign | Taxonomy nguồn tenant, không cho Sale đổi báo cáo tùy ý |
| GET `/reports/dashboard`, `/reports/leads`, `/reports/pipeline`, `/reports/sales`, `/reports/revenue` | reports.read + scope | Cùng permission filter với list; nhóm currency, timezone/kỳ rõ ràng |
| GET `/reports/traffic` | website.read | First-party analytics, timezone, bot filtering; không fake khi chưa có event |
| GET `/notifications` | Membership active | Chỉ inbox của actor; cursor, unread filter |
| POST `/notifications/:id/read`, `/notifications/read-all` | Chính chủ inbox | Không sửa notification người khác |
| GET `/audit-logs` | audit.read | Tenant-local, đã redact, phân trang; không API sửa/xóa audit |

### Socket.IO contract

- Handshake yêu cầu access token, host/audience/session/membership khớp. Server tự join room `tenant:{id}:member:{id}`; không có event cho client tự join tên room.
- Server → client: `notification.created`, `lead.assigned`, `lead.status_changed`; envelope `{ eventId, type, occurredAt, entityRef }`, payload không chứa toàn bộ contact/note.
- Chỉ recipient hiện còn quyền nhận event. Token hết hạn, session revoke, role/team/assignment đổi phải reauthorize hoặc disconnect. Client reconnect backoff, lấy inbox REST để bù event bị mất.
- Socket không phải kênh tạo/sửa Lead trong MVP; REST thực thi tất cả authorization. Persist notification trước emit; delivery/retry dedup theo eventId.

## 10. Subscription, billing và platform

| Method / path | Auth | Hành vi |
|---|---|---|
| GET `/subscription`, `/subscription/usage`, `/subscription/plans` | Owner billing.read | Current plan/version, usage, published eligible plans |
| POST `/subscription/change-requests` | Owner billing.manage | Chọn plan/interval/coupon; quote snapshot và invoice, không tự active khi chưa trả tiền |
| GET `/invoices`, `/invoices/:id` | Owner billing.read | Chỉ invoice tenant mình |
| POST `/invoices/:id/payment-evidence` | Owner billing.manage | Evidence private, reference; không tự đánh dấu paid |
| GET `/recovery/status` | Owner, active identity | Lý do read-only/expired, entitlement và hướng khôi phục; exemption có allowlist |
| POST `/recovery/exports` | Owner recovery.export + reauth | Cho hết hạn, rate/retention policy; suspended cần hỗ trợ phê duyệt riêng |
| GET `/exports/:jobId`, POST `/exports/:jobId/download-url` | Job requester + quyền hiện tại | Private URL có hạn, không reuse URL dài hạn sau khi bị revoke |
| GET `/platform/dashboard` | platform.tenants.read | Tenant counts, subscription revenue/usage; không aggregate CRM contacts |
| GET/POST `/platform/tenants`, GET `/platform/tenants/:id` | platform.tenants.read/write | Provision qua cùng orchestration, audit; không tạo owner password rồi trả rõ |
| POST `/platform/tenants/:id/suspend`, `.../reactivate` | platform.tenants.write + step-up | Reason bắt buộc, invalidate cache/socket/jobs; không âm thầm gia hạn |
| GET `/platform/tenants/:id/domains`, `.../usage` | platform.tenants.read | Metadata phục vụ vận hành, không website/CRM private content |
| GET/POST/PATCH `/platform/plans[/:id]` | platform.plans.read/write | Publish version mới, không sửa plan version đang áp dụng |
| GET `/platform/subscriptions`, `/platform/invoices`, `/platform/transactions` | platform.billing.read | Filters theo tenant/status/date, read models platform |
| POST `/platform/invoices/:id/confirm-payment` | platform.billing.write + step-up | amount/currency/reference/evidence/reason; idempotent; không cho cùng ref gia hạn hai lần |
| POST `/platform/subscriptions/:id/extend` | platform.billing.write + step-up | Điều chỉnh có lý do/period và audit riêng, không giả payment transaction |
| GET/POST/PATCH `/platform/coupons[/:id]` | platform.billing.read/write | Cap, validity, usage limit atomic |
| GET `/platform/audit-logs` | platform.audit.read | Append-only log đã redact |
| GET `/health/live`, `/health/ready` | Hạn chế ở proxy | 200/503, không lộ hạ tầng/secrets |

API billing/recovery là ngoại lệ có allowlist đối với expired/past_due, không phải bypass toàn bộ middleware. Subscription scheduler áp dụng chính sách trong [PRD](PRD.md). Mọi platform tenant ID từ path phải được kiểm tra platform permission và audit, không chuyển trực tiếp thành query tenant tùy ý.

## 11. OpenAPI và verification plan

Khi triển khai: OpenAPI có auth schemes, request/response schema, pagination/errors, idempotency, permission notes, upload lifecycle và examples trung tính không giả dữ liệu kỹ thuật TECHPLUS. Schema Zod dùng chung giúp form validation; Nest validation ở backend là bắt buộc, không dựa vào frontend.

Contract/integration test bao gồm tenant/host mismatch, mass assignment, own/team scope với từng subresource, unauthorized export và socket room, quota concurrency, refresh replay, duplicate capture và payment idempotency. Catalog trong tài liệu này vẫn là **hợp đồng đích**. Danh sách endpoint đã triển khai nằm trong [báo cáo Sprint 1](SPRINT_1_REPORT.md); Swagger local tại `/api/docs`. Đã có unit, integration và E2E tests cho nền tảng; CMS/CRM/billing trong catalog chưa triển khai.
