# SHOWORA — UI/UX Specification

Ngày: 02/11/2026 · Phiên bản: 0.2 · **Đặc tả UI đích; Admin nền tảng và shared components đã triển khai**.

> Trạng thái code thực tế: [báo cáo Sprint 1](SPRINT_1_REPORT.md). Những module chưa được liệt kê là thiết kế cho giai đoạn tiếp theo.
## 1. Định hướng và kiểm tra component

Phong cách modern SaaS, premium, chuyên nghiệp và tối giản: hierarchy rõ, khoảng trắng nhất quán, màu trạng thái có ý nghĩa, bảng dễ thao tác và CTA gắn công việc thật. Không có chart giả, sản phẩm giả hoặc thông báo lưu thành công khi backend chưa ghi nhận.

Đã kiểm tra workspace tại giai đoạn tài liệu: thư mục trống trước khi tạo `docs/`, chưa có shared exports hoặc màn hình tương tự để tái sử dụng. Catalog dưới đây là **thiết kế đích**. Sprint 1 đã tạo shared exports tại [packages/ui](../packages/ui/src/index.ts); kiểm tra API thật trước khi sử dụng. Khi bắt đầu code, bắt buộc kiểm tra exports và màn hình gần nhất trước mỗi lựa chọn widget; tái sử dụng thành phần phù hợp, mở rộng tương thích trước khi tạo mới. Quy tắc áp dụng cả nested dialog, preview, attachment, empty/loading/error và bottom actions.

React dùng Tailwind + Shadcn UI qua shared wrappers. Không áp API Flutter/Smartos vào dự án React; nguyên tắc semantic token và reuse vẫn bắt buộc. Shared UI không import feature/API từ apps; feature cung cấp data/options/callback và permission adapter.

## 2. Information architecture

| Khu vực | Điều hướng |
|---|---|
| Account/onboarding | Đăng ký, verify email, chọn subdomain, login, reset, invitation |
| Tenant admin | Tổng quan; Khách hàng; Pipeline; Lịch chăm sóc; Sản phẩm; Danh mục; Thương hiệu; Thuộc tính; Bài viết; Dự án; Trang nội dung; Media; Website; Nhân sự/nhóm/quyền; Báo cáo; Gói dịch vụ; Audit |
| Platform admin | Tổng quan SaaS; Doanh nghiệp; Gói/phiên bản; Đăng ký; Hóa đơn; Giao dịch; Coupon; Audit |
| Public | Trang chủ; Sản phẩm; Dự án; Bài viết; Giới thiệu; Liên hệ |

Menu hiển thị theo permission và entitlement. Route guard và API vẫn kiểm tra lại. Đường dẫn admin, public và platform không dùng chung query cache chứa dữ liệu nhạy cảm.

## 3. Design tokens

| Nhóm | Token/role đề xuất | Nguyên tắc |
|---|---|---|
| Text | text.heading, text.primary, text.secondary, text.muted, text.disabled, text.onBrand | Dùng theo vai trò, không chọn raw palette trong feature |
| Background | bg.canvas, bg.surface, bg.subtle, bg.brand, bg.disabled | Phân lớp page/card/popover nhất quán |
| Border/focus | border.default, border.strong, border.error, focus.ring | Focus ring luôn thấy trên keyboard |
| Status | status.info/success/warning/danger gồm text/bg/icon/border | Không chỉ dựa vào màu, có label/icon |
| Spacing | space.1/2/3/4/6/8/12 tương ứng thang 4 px | Chỉ theme định nghĩa giá trị; feature dùng token |
| Type | title/page/section/body/label/caption | Font có hỗ trợ tiếng Việt; line-height đọc được, không cắt dấu |
| Shape/layer | radius.control/card/dialog; shadow.popover; z.header/dialog/toast | Không thêm z-index tùy ý ở feature |
| Motion | motion.fast/normal, reduced-motion | Không animation bắt buộc để hiểu dữ liệu |

Màu thương hiệu storefront được map vào token brand qua cấu hình đã validate. Giữ contrast text/onBrand đạt yêu cầu; không để tenant chọn màu làm mất khả năng đọc. Không chèn CSS/font URL tùy ý; font dùng allowlist. Numeric palette chỉ định nghĩa ở theme layer; edited UI dùng semantic CSS variables/Tailwind tokens. Dark mode chưa thuộc MVP, nhưng token không phụ thuộc tên màu để có thể mở rộng.

## 4. Shared component catalog dự kiến

| Thành phần | Trách nhiệm | Dùng ở |
|---|---|---|
| AppShell, Sidebar, Topbar, Breadcrumb | Navigation responsive, tenant identity và account actions | Admin/platform |
| Button, IconButton, ActionMenu, Tooltip | Variants/loading/disabled/accessible name nhất quán | Mọi màn hình |
| FormField + Input/Select/DateTime/Money | Label, help, required, validation, focus error; RHF adapters | Tất cả form |
| AssigneeField | Label, selected profile, clear, searchable picker, disabled/loading/empty/error và selection contract | Lead detail/list bulk assignment |
| AttachmentField, AttachmentList, MediaPicker | Upload progress, retry, validation, preview/download/delete và metadata | Product/post/project/quotation/evidence |
| DataTable, FilterToolbar, Pagination | Selection, loading, empty/error, cursor pagination và filters URL | Product/Lead/content/platform lists |
| EntityStatusBadge, PriceDisplay | Nhãn trạng thái và ba kiểu giá với formatting locale | CMS/CRM/public |
| LoadingState, EmptyState, ErrorState | Full-page và section size, CTA theo permission, retry | Mọi màn hình và dialog |
| Dialog, ConfirmDialog, Drawer | Focus trap/return, dismiss behavior, unsaved guard | Edit/assign/delete/preview |
| BottomActionBar, FormActions | Save/cancel, sticky footer safe-area/padding và narrow wrap | Forms/drawers/mobile |
| Toast, InlineNotice | Success hậu commit, errors có action; toast không thay field error | App-wide |
| MetricCard, ChartPanel, AccessibleDataSummary | Data/loading/empty/error, kỳ đo, table tương đương | Dashboard/reports |
| ProductCard, ArticleCard, QuoteForm | Published entity display và CTA đã cấu hình | Storefront |

Không tạo một assignee select chỉ có control mà lặp label/error/clear ở nhiều màn hình. Extract toàn bộ interaction vào component generic, feature giữ own/team permission, API và option loading. Attachment actions cùng hàng metadata, cho wrap trên mobile thay vì ba nút full-width không cần thiết. BottomActionBar tự xử lý safe-area và padding một lần; không lồng inset làm khoảng trống dư.

## 5. Layout và responsive

- Desktop từ 1024 px: sidebar cố định/collapse, topbar, nội dung có max-width theo tác vụ; form dài chia section, không dàn input toàn màn hình chỉ vì còn chỗ.
- Tablet 768–1023 px: sidebar drawer, cards giảm cột, filter wrap. Mobile 360–767 px: navigation drawer, metric stack, một cột form, CTA dễ chạm; không có horizontal scroll toàn trang.
- Data table có cột ưu tiên, row action menu và cuộn ngang **trong container có nhãn** khi dữ liệu thực sự cần; mobile Lead list có thể dùng card view cùng data/selection contract. Không giấu thông tin bắt buộc để có vẻ vừa màn hình.
- Sticky actions không che field cuối/focus; BottomActionBar cộng `env(safe-area-inset-bottom)` trong shared implementation. Dialog trên mobile chuyển sheet/full-screen hợp lý.
- Test long Vietnamese labels, email/domain dài, không có avatar/image, text zoom 200%, keyboard virtual và safe-area. Tooltip không là nơi duy nhất chứa thông tin quan trọng.

## 6. Screen specifications — onboarding và account

| Màn hình | Nội dung và hành động | States cần có |
|---|---|---|
| Đăng ký | Email/password, tên doanh nghiệp, subdomain, consent; hiển thị lỗi field và quy tắc subdomain | Submitting disable duplicate, email response chung, verify pending, conflict subdomain có chọn lại |
| Verify email | Trạng thái link, resend có cooldown, tiếp tục setup khi transaction thành công | Expired/used/invalid token, retry không tạo tenant lặp |
| Login/reset | Tenant identity từ host, email/password, forgot; platform MFA riêng | Throttle retry-after, generic invalid credentials, session expired, reset success không tự giữ session cũ |
| Invitation | Tên tenant và role intent tối thiểu, accept sau verify/account match | Token hết hạn, sai email, quota reservation hết, đã nhận |
| Onboarding checklist | Logo/contact, categories/attributes, product draft, preview, mời Sale | Không ép điền thông tin chưa có; public CTA chỉ bật khi cấu hình và backend sẵn sàng |

Không cho chọn role hoặc tenant ID ở form login. Tenant switching dẫn đến host đích và xác thực membership; không sửa ID trong localStorage. Clear sensitive Query cache khi logout/session revoke hoặc đổi context.

## 7. Tenant dashboard

Metric cards: số sản phẩm, bài viết, Lead, Lead mới, lượt truy cập hợp lệ, conversion rate. Kỳ đo/timezone và so sánh phải có nhãn; lấy số liệu thật theo scope. `0` chỉ khi query thành công và số thực sự bằng không; `—` kèm giải thích khi chưa có dữ liệu/không đủ điều kiện tính.

Charts: Lead theo ngày, nguồn, pipeline và hiệu quả Sale; có filter kỳ, legend, keyboard-accessible summary/table. Không dùng đường cong/số liệu trang trí khi API chưa sẵn sàng. SALES xem own dashboard; MANAGER xem team; editor không thấy CRM metrics. Phần CMS hiển thị độc lập nếu một report lỗi, có retry ở section thay vì xóa toàn trang.

Primary action tùy role: tạo sản phẩm/editor, xem Lead chưa giao/manager, xem lịch chăm sóc/Sale. Banner entitlement/read-only có link recovery cho owner; user khác thấy hướng dẫn liên hệ owner, không hiển thị action không được phép.

## 8. Product/CMS management

### Product list và form

- List: search, status, category, brand, filters theo thuộc tính filterable; tên/model, thumbnail, giá, trạng thái, last updated; create/import/export theo permission. Filter sync URL nhưng không chứa contact/PII.
- Form sections: cơ bản; danh mục/thương hiệu; giá; thuộc tính động; mô tả/bảo hành; gallery/video; SEO; xuất bản. Giá EXACT/FROM yêu cầu amount/currency; CONTACT ẩn và xóa amount khỏi submission, không gửi giá 0 giả.
- Attribute builder: label/key/type/unit/options/filterable; category mapping required/order; cảnh báo khi đổi kiểu đang có values. Form sản phẩm render từ metadata API, không hardcode trường máy phát điện.
- Save draft tách publish permission/action. Publish validate toàn bộ required field, media READY và entitlement; lỗi đưa focus tới section/field. Preview watermark “Bản xem trước”, không index/cache.
- Import: chọn file → kiểm tra → preview hàng hợp lệ/lỗi → xác nhận commit → progress theo batch → summary retry; không báo “nhập thành công” khi mới upload. Export async có trạng thái và download TTL.

### Nội dung, dự án và website settings

- Blog rich text toolbar có cấu trúc heading/link/list/image alt, preview, tags/category/SEO; draft/publish/schedule, timezone rõ và cancel lịch.
- Project có location/customer display name nếu đã xác minh, gallery và related product picker cùng tenant; không tự điền khách hàng mẫu.
- Media library grid/list, folder/type/status/storage usage, upload progress, processing/rejected/retry; asset private có biểu tượng và giải thích.
- Website settings chia brand/contact/homepage/navigation/footer/SEO/domain. Template section reorder/toggle theo schema, không editor HTML/CSS tự do.
- Custom domain thể hiện pending DNS → verifying → TLS provisioning → active hoặc failed có hướng dẫn retry; không label active chỉ vì nhập xong hostname.
- Category tree có parent picker loại descendant để tránh cycle; backend vẫn kiểm tra. Empty/loading/error ở từng picker, media preview và folder drawer đều dùng shared patterns.

## 9. Lead CRM — luồng ưu tiên

### Lead list/pipeline

List có search, status, source, product, assignee, team và ngày; cột tên/contact được cấp quyền, nhu cầu, source, stage, assignee, next follow-up. Không hiển thị Lead ngoài scope rồi disable row. Server trả tập đã lọc quyền. Chưa phân công hiển thị rõ trong hàng đợi owner/admin hoặc team manager tương ứng.

Pipeline có tám trạng thái từ PRD; hỗ trợ list tương đương và select status có keyboard. MVP không bắt buộc drag-and-drop; mọi transition đều qua dialog/validation/version, không đổi cột trước khi server xác nhận. WON/LOST hiển thị terminal và quyền reopen của manager.

### Lead detail

Hai vùng desktop: profile/nhu cầu/attribution/revenue/assignee và activity timeline. Mobile xếp dọc, CTA liên hệ ghi nhận theo thông tin hợp lệ. Tabs notes/activities/reminders/quotation dùng cùng scope, deep link không bypass authorization.

- AssigneeField dùng chung cho detail và bulk assignment; chỉ load Sales active trong team cho phép. Dialog transfer có reason, current version; response conflict yêu cầu tải lại dữ liệu, không ghi đè.
- Transition dialog hiển thị trạng thái kế tiếp; LOST bắt buộc lý do, WON actual revenue + currency (0 vẫn hợp lệ nếu có chủ đích). Reopen cần reason và permission.
- Note: plain/sanitized text, author/time, edited indicator; không cho manager giả tác giả. Timeline không xóa khi reassign.
- Reminder: datetime theo timezone tenant, mô tả múi giờ, assignee có quyền; các state pending/completed/cancelled/delivery error; không hứa đã thông báo khi outbox còn pending.
- Quotation: amount/currency/reference/status và private attachments, không biến thành luồng thanh toán hàng hóa.
- Duplicate candidates chỉ hiện khi actor có quyền cả hai Lead; không tự gộp/xóa. Không lộ contact của Lead ngoài scope qua suggestion hoặc total count.
- Sau reassignment/revoke, client bỏ dữ liệu không còn quyền khỏi cache/detail; thông báo “Bạn không còn quyền truy cập” không giữ PII trên màn hình.

### Notifications và báo cáo

Inbox có unread/read, thời gian, subject tối thiểu và safe entity link; socket reconnect đồng bộ REST. Không dùng toast realtime làm nguồn thông báo duy nhất. Event trùng không nhân đôi item. Link Lead kiểm tra quyền hiện tại.

Reports có filter timezone/date/source/product/Sale trong scope; định nghĩa conversion/win/revenue hiển thị qua shared tooltip/help; chart có dữ liệu dạng bảng. Export luôn nói rõ phạm vi/kỳ/currency và trạng thái job.

## 10. Subscription và Super Admin

Owner xem plan/version, usage/quota, renewal date, invoice và trạng thái đối soát. So sánh Starter/Business/Professional lấy từ API; chưa có giá không tự gán giá mẫu. Payment evidence có nhãn “Chờ xác nhận”, không “Đã thanh toán”. Hạ gói giải thích resource đang vượt và thao tác cần làm, không cảnh báo xóa dữ liệu tự động.

Platform dashboard tách khỏi tenant app shell về navigation/context. Tenant detail chỉ chứa metadata/domain/usage/billing được phép. Suspend/reactivate/extend/confirm payment có dialog lý do, step-up và summary tác động; confirmation không diễn ra qua nút row một chạm. Không có nút đọc CRM của tenant theo mặc định. Audit list không có edit/delete.

Khi expired, owner tới recovery billing/export; user thường thấy trạng thái tạm khóa. Suspended cần hướng dẫn hỗ trợ và không cấp export tự do. Public unavailable trả HTTP 503 thật và trang có copy rõ, không trả trang sản phẩm cũ từ cache.

## 11. Public storefront và TECHPLUS

| Trang | Bố cục và hành vi |
|---|---|
| Home | Header/logo/nav, hero CTA, giới thiệu, categories, featured products, brands/services/projects/posts, footer; section chỉ hiện khi enabled và có nội dung đủ |
| Product listing | Heading/breadcrumb, search, filter drawer mobile, brand/category/spec filters, sort, cards, pagination; state không có sản phẩm khác với không có kết quả lọc |
| Product detail | Gallery + alt, tên/model, EXACT/FROM/CONTACT price, quote CTA, verified specifications, description/warranty, video, related products; không hiển thị hàng thông số bịa |
| Blog | List/category/tags và article semantic headings, author/date nếu có nguồn, cover alt, SEO và share links |
| Projects | List/detail, verified location/customer display info, gallery và related products |
| Contact | Company info có nguồn, hotline/email/Zalo/map nếu cấu hình, form consent; map lazy-load và kiểm soát privacy |

Floating hotline/Zalo chỉ hiện khi có cấu hình hợp lệ, không che CTA/cookie notice trên mobile. Number/link được validate; external tab có rel an toàn. Không tự điền hotline TECHPLUS hoặc trỏ Zalo đến tài khoản tưởng tượng.

Hero TECHPLUS theo chủ đề mùa mưa bão khi có copy/asset được duyệt. Tên/sáu danh mục/tiêu đề bài 150 kVA tại Đà Nẵng là dữ liệu được cung cấp; tiêu đề không đủ chứng minh thông số, khách hàng hoặc việc dự án đã thực hiện. Bài giữ draft cho tới khi có nội dung xác minh. Khi chưa có sản phẩm thật, dùng empty state thay card giả.

### Quote/contact form

Trường bắt buộc: họ tên, ít nhất phone hoặc email, nhu cầu/nội dung, consent; optional company/address/product interests. Product detail preselect product ID công khai của tenant, không gán Sale/status. Giữ UTM metadata an toàn, không hiển thị làm input nghiệp vụ.

Submit có pending, rate-limit retry, field error, spam challenge error, unavailable và success sau server acknowledgment. Disable double submit + idempotency key; không xóa dữ liệu người dùng khi lỗi có thể sửa. Success không tiết lộ đã có Lead trước đó. Quá quota/hết hạn nêu không thể tiếp nhận và đưa hotline/email đã cấu hình; không hiển thị đã gửi giả.

## 12. Ma trận screen states bắt buộc

| State | Pattern | Hành vi |
|---|---|---|
| Initial loading | Skeleton theo bố cục, aria-busy | Giữ layout ổn định, không render số metric ngẫu nhiên |
| Refreshing | Data đã được phép + indicator | Tránh chặn toàn trang; dữ liệu nhạy cảm bị revoke phải ẩn ngay |
| Empty dữ liệu | Shared EmptyState đúng kích thước | CTA tạo/cấu hình chỉ khi có permission |
| Empty filter | Shared EmptyState + clear filters | Không nhầm tenant mới chưa có dữ liệu |
| Error | Shared ErrorState hoặc field error | Request ID, retry có giới hạn, không stack trace/PII |
| Success | Toast + dữ liệu/cache được cập nhật | Chỉ sau commit/ack; async job hiển thị accepted/pending riêng |
| Forbidden/revoked | Permission state | Không giữ data cũ; link quay lại phù hợp |
| Read-only/expired/quota | InlineNotice + action hợp lệ | Giải thích điều kiện và owner recovery, không chỉ disable im lặng |
| Offline/disconnected | Connectivity notice | Không hứa đã lưu; reconnect và đồng bộ inbox, không queue ghi ngầm |
| Unsaved changes | Shared ConfirmDialog | Save/discard/cancel với focus return; không mất dữ liệu do route đổi |

Ma trận áp dụng cả full page, table, field picker, dialog, drawer, preview và attachment. Mỗi màn hình có state phù hợp; mutation-only success không cần thêm trang “thành công” vào mọi read-only screen.

## 13. Accessibility, localization và verification

- Semantic landmarks/headings, button accessible name, label thật, mô tả field error qua aria, keyboard order và focus error summary. Không dùng placeholder làm label duy nhất.
- Dialog focus trap/return, Escape phù hợp; tooltip hoạt động hover và focus. Status có text/icon; charts có table, không color-only. Target đề xuất tối thiểu 44 × 44 px cho thao tác chạm chính.
- Tiếng Việt là locale đầu; currency/number/date format theo locale và timezone tenant. UTC không trình bày như giờ địa phương. Responsive long text và reduced-motion.
- React Query keys gồm tenant/membership/scope/filter, không chỉ entity ID. Invalidate sau permission/status/publish thay đổi; logout clear cache. Không persist CRM cache vào browser storage ở MVP.
- Review bằng Playwright ở 360/390/768/1280 px, keyboard/zoom, empty/loading/error/success fixtures có kiểm soát; kiểm tra contrast và screen reader ở luồng chính. Fixtures chỉ phục vụ kiểm thử, không là business data production.

Admin nền tảng đã chạy trên trình duyệt, có shared components, responsive layout và Playwright desktop/mobile. Screenshots kiểm tra được sinh trong thư mục gitignored `test-results/`; xem [TESTING](TESTING.md). Các bảng Product/CMS/CRM/public website trong đặc tả vẫn là thiết kế cho sprint sau; chưa nghiệm thu toàn bộ UI từ những kiểm tra nền tảng này.
