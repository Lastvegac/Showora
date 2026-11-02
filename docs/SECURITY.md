# SHOWORA — Security Design & Risk Assessment

Ngày: 02/11/2026 · Phiên bản: 0.1 · **Threat model và yêu cầu triển khai, chưa phải security audit đã hoàn thành**.

> Trạng thái code thực tế: [báo cáo Sprint 1](SPRINT_1_REPORT.md). Những module chưa được liệt kê là thiết kế cho giai đoạn tiếp theo.
## 1. Tài sản, tác nhân và trust boundaries

Tài sản cần bảo vệ: contact/note/quotation của Lead; danh tính và phiên; nội dung chưa xuất bản; private media; dữ liệu thanh toán dịch vụ; cấu hình tenant/domain; storage keys, signing keys và backup.

Tác nhân: visitor không đăng nhập, bot, user tenant có quyền thấp, account bị chiếm, người quản trị nền tảng và dependency/hạ tầng bị xâm nhập. Giả định tenant khác có thể cố ý tấn công; UUID và hostname không phải cơ chế bảo mật.

Trust boundaries: Internet → Cloudflare/Nginx; proxy → app; browser → API; SSR → API; API/worker → DB; app → storage/email; platform ops → tenant data; production → backup/CI. Mỗi boundary xác thực đầu vào, giới hạn quyền và không truyền secret không cần thiết.

## 2. Security Risk Assessment

Mức độ là đánh giá trước kiểm soát: khả năng × tác động, không phải kết quả pentest. Chủ sở hữu là vai trò dự kiến, cần gán người thực tế trước sprint phụ thuộc.

| ID | Rủi ro | Khả năng / tác động | Mức | Kiểm soát và bằng chứng bắt buộc | Chủ sở hữu |
|---|---|---|---|---|---|
| SEC-01 | IDOR đọc/ghi tenant khác | Cao / Rất cao | Critical | Context + repository + composite FK + RLS; integration âm tính cả worker/media/export | Backend |
| SEC-02 | Sale xem Lead ngoài quyền | Cao / Cao | High | Own/team policy cho parent và child/report/socket; test reassignment và multi-team | CRM |
| SEC-03 | Host spoofing/cache lẫn tenant | Vừa / Rất cao | Critical | Trusted proxy, exact host binding, verified domain, tenant-aware cache; test Host/XFH/CDN variants | Backend + Ops |
| SEC-04 | Chiếm tài khoản/session replay | Cao / Cao | High | Argon2id, throttle, refresh rotation/replay revoke, MFA platform, reset revoke | Identity |
| SEC-05 | Upload độc hại/stored XSS | Cao / Cao | High | Quarantine, magic bytes + decode, re-encode, sanitizer, CSP; test polyglot/SVG/HTML/bomb | Media + Frontend |
| SEC-06 | Lộ token/PII qua logs/export/storage | Vừa / Cao | High | Redaction, private objects, short signed URLs, export reauth, retention; inspect logs + negative download tests | Backend + Ops |
| SEC-07 | CSRF/CORS sai cấu hình | Vừa / Cao | High | Host-only cookie, CSRF + Origin, exact CORS allowlist, no wildcard credentials; browser tests | Identity |
| SEC-08 | SQL injection/mass assignment | Vừa / Cao | High | Parameterized Prisma/raw queries, DTO allowlist, size limits; fuzz fields/sort/filter | Backend |
| SEC-09 | Vượt quota hoặc payment replay | Vừa / Cao | High | DB lock/counters, idempotency/reference unique, evidence review, audit; concurrent tests | Billing |
| SEC-10 | Spam/DoS Lead và tài nguyên | Cao / Vừa | High | Edge + app rate limit, honeypot/challenge, body/file/query bounds, backpressure | Backend + Ops |
| SEC-11 | Lạm quyền platform/CI secret | Vừa / Rất cao | Critical | Separate audience/DB grants, MFA, least privilege, protected env, audit, no CRM bypass | Ops |
| SEC-12 | Mất dữ liệu/backup không restore được | Vừa / Rất cao | Critical | Offsite encrypted base/WAL/media copies, freshness alert, isolated restore drill đo RPO/RTO | Ops |
| SEC-13 | SSRF/DNS takeover/custom domain | Vừa / Cao | High | Ownership TXT, global unique binding, public DNS/IP policy, no arbitrary fetch, revalidation on change | Ops + Backend |
| SEC-14 | Supply-chain hoặc image dễ tổn thương | Vừa / Cao | High | Pinned deps/lockfile, scan, non-root/read-only runtime, cập nhật có review | Platform |
| SEC-15 | Job/socket chạy với quyền cũ | Vừa / Cao | High | Tenant/session/permission recheck tại execution/delivery, scoped rooms, disconnect/revoke tests | Backend |

Không hạ mức rủi ro còn lại chỉ vì đã viết thiết kế. Mỗi mục chỉ được coi đã giảm sau khi có implementation và bằng chứng kiểm thử; Critical/High chưa xử lý chặn launch hoặc phải được người có trách nhiệm chấp nhận ngoại lệ có thời hạn, không tự bỏ qua để tăng tốc.

## 3. Identity và session lifecycle

- Password hashing Argon2id, tham số benchmark theo tài nguyên VPS, không tự viết crypto; salt do thư viện sinh. Đề xuất tối thiểu 12 ký tự, cho phép passphrase/Unicode, không cắt ngầm. Không log password hoặc kiểm tra password bằng dịch vụ ngoài khi chưa có policy.
- Response login/reset/verify tránh dò account; email normalize có quy tắc nhất quán, không tự xóa dấu chấm hoặc sửa địa chỉ theo provider.
- Access JWT TTL đề xuất 10 phút; refresh session tối đa 14 ngày, idle timeout có cấu hình. Các TTL là kỹ thuật đề xuất cần pin trong config, không đưa secret vào source.
- JWT verify algorithm allowlist, issuer/audience/exp/nbf, key rotation có `kid`; không nhận `alg=none` hoặc key URL từ token. Private key chỉ server, public key distribution được kiểm soát.
- Access token ở memory, không localStorage. Refresh token opaque có entropy cao, hash trong DB, cookie HttpOnly/Secure/host-only; chọn path bao phủ đúng refresh/logout, không cookie wildcard giữa tenants.
- Rotation trong transaction: khóa token row, kiểm tra hash/expiry/session, consume token, tạo successor unique. Token đã consume bị dùng lại → revoke cả family/session và phát cảnh báo. Client single-flight refresh, nhiều tab phối hợp để không tự gây replay; không mở “grace” cho token cũ mà chưa threat review.
- Session revocation có hiệu lực tại API và socket bằng kiểm tra session state; không chỉ đợi JWT hết hạn. Password reset, membership disable, ownership transfer và role escalation revoke các session cần thiết.
- Verify/reset/invite tokens single-use, TTL ngắn, lưu hash, rate limit request/redeem; invalid token không lộ danh tính. Đổi password qua reset revoke toàn bộ session, thông báo chủ tài khoản.
- SUPER_ADMIN yêu cầu MFA trước production (đề xuất TOTP + recovery codes hash). Enrollment bootstrap qua vận hành đã xác minh; factor secret mã hóa bằng key quản lý ngoài DB. Billing confirmation, suspension và ownership transfer cần step-up gần đây; recovery có audit, không có backdoor tắt MFA từ public API.

## 4. Authorization và tenant isolation

Guard chain: trusted host → authentication/session → verified membership → tenant status/entitlement → permission → resource scope → validated DTO → service/repository transaction. Public routes chỉ miễn authentication, vẫn cần host, tenant policy, published filter, validation và rate limit.

Permission và resource scope độc lập. `leads.read` không mở toàn tenant; một manager quản lý nhiều team chỉ thấy union team được cấp. Custom roles không được cấp vượt delegation boundary. Backend bảo vệ owner cuối cùng và tách platform permission khỏi tenant role.

Repository không dùng Prisma client toàn cục cho tenant query. RLS FORCE + non-owner runtime + composite FK là defense in depth; transaction-local context tránh pool leak. App context sai vẫn là rủi ro nên không coi RLS là phép thay authorization. Worker dispatcher chỉ claim metadata qua hàm DB quyền hẹp, không đọc PII xuyên tenant. Test phải bao gồm runtime role và reuse connection giữa hai tenant.

Không nhận tenant/role từ body/header tự do. Platform path có tenant ID chỉ hợp lệ sau platform guard và audit, không biến thành “impersonate tenant” endpoint. Hỗ trợ truy cập nội dung khách hàng trong tương lai cần thiết kế riêng với consent/time limit/audit; không nằm trong MVP.

Platform reporting có read role/connection riêng chỉ được đọc read-model views allowlist cột SaaS, với SELECT RLS policy riêng trên đúng bảng được duyệt. Không dùng BYPASSRLS, không mở CRM/CMS/private media hoặc policy ghi toàn cục. Tenant routes không được resolve platform repository; cần test âm tính cho boundary này. Platform mutations vẫn tenant-scoped sau platform guard, step-up và audit.

## 5. HTTP/browser và nội dung

- HTTPS toàn đường browser-edge-origin; HSTS sau khi domain/TLS xác minh ổn định; không bật includeSubDomains trên domain không kiểm soát mọi subdomain.
- Exact CORS allowlist theo verified frontend origins. Từ chối Origin null/không hợp lệ ở credential mutations; không phản chiếu mọi Origin và không dùng `*` cùng credentials. Same-origin proxy là mặc định.
- Cookie-auth endpoints refresh/logout và login/session mutations kiểm tra Origin và CSRF token server-signed gắn session hoặc pre-auth nonce, ngoài SameSite. POST public Lead có origin policy/challenge chống spam nhưng không coi CORS/Origin là authorization.
- CSP theo nonce/hash ở storefront, không `unsafe-eval` production; chỉ allow script/analytics đã duyệt. Thêm frame-ancestors, X-Content-Type-Options nosniff, Referrer-Policy và Permissions-Policy phù hợp. Chặn clickjacking cho admin.
- Rich text allowlist node/mark, làm sạch ở server; render escape, link protocol http/https và rel phù hợp. Không dùng HTML tùy ý trong menu/footer/GA setting. JSON-LD escape `</script>` và ký tự nguy hiểm.
- Zod shared schema không thay backend validation. Reject unknown fields, bound string/array/depth/JSON body, file/batch count. Prisma parameterization; raw SQL chỉ tagged/parameterized và review.
- Search/sort/filter allowlist; dynamic attributes typed; không đưa URL cấu hình thành server fetch tùy ý. External links từ tenant phải loại `javascript:`, `data:` và các protocol nguy hiểm.

## 6. Media và export

1. Kiểm tra permission/resource, reserve quota transaction, sinh object key random thuộc tenant; không dùng filename client làm path.
2. Upload private/quarantine bằng signed URL ngắn hạn ràng buộc key và giới hạn phù hợp provider. Finalize kiểm tra actual byte size độc lập với giá trị client.
3. Detect MIME bằng signature, decode/validate ảnh/video bằng thư viện được cập nhật; chặn executable, HTML, SVG active content trong MVP; ảnh re-encode, bỏ EXIF nhạy cảm, giới hạn pixel/duration để chống decompression bomb.
4. Virus scan nếu chấp nhận tài liệu XLSX/attachment; XLSX parser giới hạn zip entries/uncompressed size/rows và không thực thi macro/formula/link. File chưa kiểm tra không READY hoặc public.
5. Chỉ public rendition được gắn nội dung published; asset draft/CRM/billing evidence private. URL public không chứa secret. Private download kiểm tra quyền hiện tại, signed URL TTL ngắn và không log query signature.
6. Export reauthorize lúc chạy và tải; snapshot filter không giữ quyền đã bị thu hồi. Escape leading `= + - @`, control characters cho spreadsheet text; tệp export private và tự hết hạn.
7. Xóa/unpublish thu hồi reference và cache; cleanup orphan có grace/config, không xóa asset đang dùng. Một signed URL đã cấp có cửa sổ hiệu lực đến TTL; việc chọn TTL phải phản ánh rủi ro này.

## 7. Lead capture và chống lạm dụng

- Rate limit theo IP tại edge và theo tenant + IP/session tại app, dùng trusted proxy để không giả IP. Threshold cấu hình theo môi trường, không hardcode quota nghiệp vụ. MVP một API instance; trước scale cần rate-limit store dùng chung.
- Honeypot, thời gian submit hợp lý và challenge như Cloudflare Turnstile khi bật; token challenge verify server-side. Đặt giới hạn chống bot không chặn nhầm khách dùng mạng chung, cung cấp thông báo và kênh liên hệ thật.
- Idempotency tenant-scoped; contact normalized dùng để gợi ý trùng trong cửa sổ cấu hình, không global unique. Không trả response tiết lộ người này đã là khách hàng.
- Trước commit kiểm tra quota/entitlement và status; không gửi email/socket nếu Lead chưa commit. Outbox retry không tạo notification/Lead lặp.
- Lead có consent policy version/time; chỉ thu field cần cho tư vấn. Không dùng Lead/UTM/email cho mục đích khác khi chưa có cơ sở phù hợp.

## 8. Billing, dữ liệu cá nhân và audit

- Manual payment không tin ảnh chụp từ tenant như bằng chứng đã nhận tiền. Người được cấp quyền đối soát số tiền/currency/reference thực tế rồi xác nhận qua step-up; unique reference/idempotency chặn replay. Correction/refund ghi event bù, không sửa/xóa lịch sử tài chính.
- Hóa đơn dịch vụ trong hệ thống không tự được xem là hóa đơn điện tử hợp pháp. Cần quy trình pháp lý/kế toán và provider phù hợp trước tuyên bố tương ứng.
- Mã hóa TLS transit, disk/volume/storage/backup at rest; bí mật tích hợp/factor MFA có application-level encryption với key version ngoài DB. Email/phone cần kiểm soát DB/backup và retention, không hứa đã mã hóa cấp field nếu chưa làm.
- Logs/audit không chứa password/token, full request body/contact/note hoặc signed URL. Audit ghi actor, action, entity, tenant, request ID, reason và diff đã redact; append-only DB grants, retention có policy và bản sao ngoài máy ứng dụng.
- Trước nhận PII thật phải có privacy notice, consent purpose, vai trò trách nhiệm dữ liệu, retention schedule, export/erasure workflow, legal hold và quy trình xử lý yêu cầu. Chưa tự đặt thời hạn thương mại/pháp lý.
- Erasure khác soft delete: xóa/anonymize cả object/export/cache/index theo policy; backup hết hạn theo retention, khi restore áp dụng lại erasure tombstones. Người yêu cầu phải được xác minh trước khi xuất hoặc xóa dữ liệu.

## 9. Secrets, infrastructure và supply chain

- Chỉ environment/secret store; `.env.example` sau này chỉ placeholder. Validate required env và từ chối khởi động production nếu dùng giá trị dev/test, wildcard CORS hoặc cookie insecure. Không đưa `VITE_*`/`NEXT_PUBLIC_*` chứa secret.
- Runtime DB role không DDL/owner/superuser/BYPASSRLS; migration, backup, dispatcher và platform grants tách biệt. DB/storage private network, firewall tối thiểu, SSH key, không mở DB port Internet.
- Cloudflare Full (strict), origin TLS và restrict origin ingress; proxy header trust chỉ từ CIDR được quản lý. WebSocket Origin/session kiểm tra như HTTP.
- Pin Node/pnpm/dependencies/images, pnpm lockfile frozen trong CI; dependency/license/image/secret scan, review scripts của dependency và provenance artifacts nếu có.
- CI token minimum permissions; PR từ fork không nhận deploy secrets. Protected branches, required reviews/checks, environment-scoped secrets và production approval được cấu hình trên GitHub khi có repository/quyền quản trị; tài liệu không tự bật được các bảo vệ đó.
- Container non-root, filesystem read-only khi khả thi, resource limits, log rotation, cập nhật security patches. Không chia sẻ bucket/DB/secrets giữa staging và production.

## 10. Backup, khôi phục và xử lý sự cố

Mục tiêu đề xuất: RPO ≤ 1 giờ, RTO ≤ 4 giờ. PostgreSQL base backup + WAL và object versioning/backup phải nằm ngoài VPS, mã hóa với quyền tách runtime. Versioning cùng bucket không thay bản sao dự phòng độc lập. Theo dõi backup age, WAL archive lag, checksum và khả năng truy cập key.

Hàng tháng restore vào network cô lập, đo thời gian, kiểm tra tenant counts, FK/RLS, login và sample asset integrity; không gửi email/socket thật từ môi trường restore. Không công bố đạt RPO/RTO trước khi có biên bản diễn tập.

Runbook sự cố: phát hiện/cảnh báo → cô lập host/session/tenant bị ảnh hưởng → giữ bằng chứng đã redact → rotate key/revoke session → khôi phục hoặc forward fix → kiểm tra scope ảnh hưởng → thông báo theo nghĩa vụ đã được tư vấn → postmortem có action owner. Không tùy tiện xóa log hoặc down-migrate phá dữ liệu. Người on-call và kênh liên hệ phải được chỉ định trước launch.

## 11. Security verification và release gates

| Gate | Bằng chứng cần có |
|---|---|
| Sprint 1 | Tenant A/B runtime-role RLS tests; missing-context fail closed; pooled reuse; RBAC escalation/last-owner; refresh rotation/replay/reset revoke |
| Sprint 2–3 | Upload malicious formats/oversize/quota; sanitized rich text; host/cache isolation; draft không lộ qua SSR/sitemap/media |
| Sprint 4 | Sales own/team và mọi child/report/export/socket; reassignment revoke; public capture/idempotency/spam/quota; job tenant context |
| Sprint 5 | Expiry/grace và recovery allowlist; payment replay/amount mismatch; concurrent quota/coupon, immutable pricing version |
| Sprint 6 | CI security scans, privileged MFA, proxy/CORS/CSRF/CSP browser tests, load test, external exposure review và restore drill |

Sprint 1 đã có implementation, migrations, Argon2id, JWT/session revocation, refresh rotation, CSRF/Origin, RLS và integration tests trên PostgreSQL thật. Xem [báo cáo](SPRINT_1_REPORT.md) và [TESTING](TESTING.md) để biết phạm vi được chứng minh. Chưa có pentest độc lập hoặc security audit toàn hệ thống; các controls còn lại vẫn là yêu cầu trước production.
