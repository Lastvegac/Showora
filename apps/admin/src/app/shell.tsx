import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { Avatar, Badge, Button, Dialog, Logo, Notice } from '@showora/ui';
import { toast } from 'sonner';
import { useSession } from './session';
import { errorMessage } from '../lib/api';

const items = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, permission: '' },
  { to: '/members', label: 'Đội ngũ', icon: Users, permission: 'members.manage' },
  { to: '/teams', label: 'Nhóm kinh doanh', icon: UsersRound, permission: 'teams.manage' },
  { to: '/roles', label: 'Vai trò & phân quyền', icon: ShieldCheck, permission: 'roles.manage' },
  { to: '/settings', label: 'Cài đặt doanh nghiệp', icon: Settings2, permission: 'tenant.write' },
];
export function AppShell() {
  const { viewer, logout, can } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  if (!viewer) return null;
  const active = items.find((i) => i.to === location.pathname)?.label ?? 'Không gian doanh nghiệp';
  const navigation = (
    <nav className="sidebar-nav" aria-label="Điều hướng chính">
      <span className="nav-label">KHÔNG GIAN LÀM VIỆC</span>
      {items
        .filter((item) => !item.permission || can(item.permission))
        .map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      <span className="nav-label nav-label-next">PHÁT TRIỂN TIẾP THEO</span>
      {[
        { label: 'Sản phẩm', icon: Package },
        { label: 'Nội dung website', icon: FileText },
        { label: 'Khách hàng & CRM', icon: Workflow },
      ].map((item) => (
        <div className="nav-item nav-upcoming" key={item.label} aria-disabled="true">
          <item.icon size={17} />
          <span>{item.label}</span>
          <span className="soon-label">Sắp có</span>
        </div>
      ))}
    </nav>
  );
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="sidebar-logo" to="/">
          <Logo />
        </Link>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Building2 size={18} />
          </span>
          <div>
            <strong>{viewer.tenant.name}</strong>
            <p>Không gian doanh nghiệp</p>
          </div>
          <ChevronDown size={14} />
        </div>
        {navigation}
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div>
              <span>GÓI DỊCH VỤ</span>
              <Badge tone={viewer.entitlement.writable ? 'success' : 'warning'}>
                {viewer.entitlement.status === 'TRIALING' ? 'Dùng thử' : viewer.entitlement.status}
              </Badge>
            </div>
            <strong>{viewer.entitlement.planName}</strong>
            <p>
              {viewer.entitlement.staffUsed} / {viewer.entitlement.staffLimit} vị trí nhân sự
            </p>
            <div className="usage-track">
              <div
                style={{
                  width: `${Math.min(100, (viewer.entitlement.staffUsed / viewer.entitlement.staffLimit) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="sidebar-help">
            <CircleHelp size={16} />
            <span>Cùng bạn xây dựng mỗi ngày.</span>
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Mở điều hướng"
            >
              <Menu size={19} />
            </Button>
            <span>Không gian làm việc</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <span className="secure-label">
              <ShieldCheck size={14} />
              Không gian riêng
            </span>
            <div className="topbar-divider" />
            <Avatar name={viewer.user.displayName} size="sm" />
            <div className="topbar-user">
              <strong>{viewer.user.displayName}</strong>
              <span>{viewer.user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              busy={loggingOut}
              aria-label="Đăng xuất"
              onClick={() => {
                setLoggingOut(true);
                void logout()
                  .then(() => navigate('/login'))
                  .catch((e) => toast.error(errorMessage(e)))
                  .finally(() => setLoggingOut(false));
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </header>
        <main className="app-main" id="main-content">
          {!viewer.entitlement.writable && (
            <div className="entitlement-notice">
              <Notice tone="warning">
                Gói dịch vụ hiện ở trạng thái {viewer.entitlement.status}. Thao tác chỉnh sửa đã tạm
                dừng. Chủ doanh nghiệp cần liên hệ quản trị nền tảng để gia hạn.
              </Notice>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} SHOWORA</span>
          <span>
            Được xây dựng cho sự phát triển của bạn <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
      <Dialog
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Không gian làm việc"
        description={viewer.tenant.name}
      >
        {navigation}
      </Dialog>
    </div>
  );
}
