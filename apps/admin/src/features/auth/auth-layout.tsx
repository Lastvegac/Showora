import type { ReactNode } from 'react';
import { ArrowUpRight, Box, Check, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@showora/ui';
import { Link } from 'react-router-dom';
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link to="/login" aria-label="SHOWORA">
          <Logo light />
        </Link>
        <div className="auth-story-content">
          <span className="story-pill">
            <Sparkles size={13} /> Không gian để doanh nghiệp phát triển
          </span>
          <h1>
            Sản phẩm tốt.
            <br />
            Cơ hội mới.
            <br />
            <em>Tất cả kết nối.</em>
          </h1>
          <p>
            Từ website giới thiệu sản phẩm đến đội ngũ kinh doanh. Xây dựng hành trình khách hàng
            liền mạch cùng SHOWORA.
          </p>
          <div className="story-steps">
            {[
              ['01', 'Giới thiệu sản phẩm', 'Website mang dấu ấn thương hiệu.'],
              ['02', 'Kết nối khách hàng', 'Lưu giữ từng nhu cầu quan tâm.'],
              ['03', 'Phát triển kinh doanh', 'Cả đội ngũ cùng một mục tiêu.'],
            ].map(([number, title, description]) => (
              <div className="story-step" key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Check size={16} />
              </div>
            ))}
          </div>
          <div className="story-graphic" aria-hidden="true">
            <div className="graphic-orbit orbit-one" />
            <div className="graphic-orbit orbit-two" />
            <span className="graphic-chip chip-one">
              <Box size={17} /> Sản phẩm
            </span>
            <span className="graphic-center">
              <Layers3 size={31} />
            </span>
            <span className="graphic-chip chip-two">
              Khách hàng <ArrowUpRight size={17} />
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={15} />
          <span>Mỗi doanh nghiệp, một không gian riêng.</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        {children}
        <footer className="auth-footer">
          SHOWORA <span>·</span> Kết nối giá trị, phát triển bền vững.
        </footer>
      </main>
    </div>
  );
}
