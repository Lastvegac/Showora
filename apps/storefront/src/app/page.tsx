import { EmptyState, Logo } from '@showora/ui';
export default function Home() {
  return (
    <main className="storefront-placeholder">
      <Logo />
      <EmptyState
        title="Website của bạn bắt đầu từ đây"
        description="Ứng dụng website công khai đã được khởi tạo. Nội dung, sản phẩm và SEO theo doanh nghiệp sẽ được triển khai trong Sprint 2–3."
      />
    </main>
  );
}
