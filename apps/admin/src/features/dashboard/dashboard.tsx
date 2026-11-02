import { useTenantKey } from '../../app/query-key';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  Check,
  Circle,
  Clock3,
  Layers3,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeading,
} from '@showora/ui';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import { api, errorMessage } from '../../lib/api';
interface Overview {
  activeMembers: number;
  teams: number;
  roles: number;
  pendingInvites: number;
}
export function DashboardPage() {
  const [now] = useState(() => new Date());
  const { viewer, can } = useSession();
  const query = useQuery<Overview>({
    queryKey: useTenantKey('overview'),
    queryFn: () => api('/tenant/overview'),
    enabled: can('members.manage'),
  });
  if (!viewer) return null;
  const today = new Intl.DateTimeFormat('vi', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: viewer.tenant.timezone,
  }).format(now);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(viewer.entitlement.endsAt).getTime() - now.getTime()) / 86400000),
  );
  return (
    <>
      <PageHeading
        eyebrow="TỔNG QUAN"
        title={`Chào ${viewer.user.displayName.split(' ').at(-1)}, một ngày tốt lành!`}
        description={today}
        action={
          can('members.manage') && (
            <Button asChild>
              <Link to="/members">
                <Users size={15} /> Quản lý đội ngũ
              </Link>
            </Button>
          )
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="welcome-tag">
            <span /> KHỞI ĐẦU HÀNH TRÌNH
          </span>
          <h2>
            Mọi cơ hội lớn
            <br />
            bắt đầu từ một nền tảng tốt.
          </h2>
          <p>
            Không gian của {viewer.tenant.name} đã sẵn sàng.
            <br />
            Kết nối đội ngũ và đặt những viên gạch đầu tiên.
          </p>
          <Button variant="secondary" asChild>
            <Link to={can('tenant.write') ? '/settings' : '/'}>
              Khám phá không gian <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-ring ring-a" />
          <div className="art-ring ring-b" />
          <div className="art-tile tile-back">
            <Layers3 size={46} />
          </div>
          <div className="art-tile tile-front">
            <ArrowDownRight size={45} />
          </div>
          <span className="art-spark">✦</span>
          <span className="art-dot" />
        </div>
      </section>
      {can('members.manage') &&
        (query.isPending ? (
          <LoadingState />
        ) : query.error ? (
          <Card>
            <ErrorState
              message={errorMessage(query.error)}
              retry={() => {
                void query.refetch();
              }}
            />
          </Card>
        ) : (
          <div className="metrics-grid">
            <MetricCard
              label="Thành viên hoạt động"
              value={query.data.activeMembers}
              description="Đội ngũ trong không gian của bạn"
              icon={<Users size={17} />}
            />
            <MetricCard
              label="Nhóm kinh doanh"
              value={query.data.teams}
              description="Kết nối theo từng nhóm phụ trách"
              icon={<UsersRound size={17} />}
            />
            <MetricCard
              label="Lời mời đang chờ"
              value={query.data.pendingInvites}
              description="Đang chờ thành viên xác nhận"
              icon={<Mail size={17} />}
            />
            <MetricCard
              label="Vai trò & phân quyền"
              value={query.data.roles}
              description="Quyền truy cập theo trách nhiệm"
              icon={<ShieldCheck size={17} />}
            />
          </div>
        ))}
      <div className="dashboard-grid">
        <Card>
          <div className="card-heading">
            <div>
              <h2>Thiết lập doanh nghiệp</h2>
              <p>Từng bước xây dựng không gian của bạn.</p>
            </div>
            <Badge tone="brand">Bắt đầu</Badge>
          </div>
          <div className="setup-list">
            {[
              {
                title: 'Tạo không gian doanh nghiệp',
                description: viewer.tenant.hostname,
                done: true,
                icon: Building2,
                to: '/',
              },
              {
                title: 'Thiết lập thông tin doanh nghiệp',
                description: 'Tên hiển thị và múi giờ làm việc.',
                done: !!viewer.tenant.name && !!viewer.tenant.timezone,
                icon: Layers3,
                to: can('tenant.write') ? '/settings' : null,
              },
              {
                title: 'Mời thành viên đầu tiên',
                description: 'Cùng đội ngũ chuẩn bị cho hành trình mới.',
                done: (query.data?.activeMembers ?? 1) > 1,
                icon: Users,
                to: can('members.manage') ? '/members' : null,
              },
              {
                title: 'Tổ chức nhóm kinh doanh',
                description: 'Xác định nhóm và người phụ trách.',
                done: (query.data?.teams ?? 0) > 0,
                icon: UsersRound,
                to: can('teams.manage') ? '/teams' : null,
              },
            ].map((item) => (
              <div className="setup-row" key={item.title}>
                <span className={`setup-check${item.done ? ' checked' : ''}`}>
                  {item.done ? <Check size={13} /> : <Circle size={13} />}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                {item.to && !item.done && (
                  <Button asChild variant="ghost" size="icon">
                    <Link to={item.to} aria-label={item.title}>
                      <ArrowRight size={15} />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card className="subscription-card">
          <div className="card-heading">
            <div>
              <h2>Không gian của bạn</h2>
              <p>Nền tảng riêng cho doanh nghiệp.</p>
            </div>
            <Clock3 size={17} />
          </div>
          <div className="subscription-details">
            <span className="subscription-emblem">
              <Layers3 size={27} />
            </span>
            <h3>{viewer.entitlement.planName}</h3>
            <p>
              {viewer.entitlement.status === 'TRIALING'
                ? `Còn ${daysLeft} ngày dùng thử`
                : `Trạng thái: ${viewer.entitlement.status}`}
            </p>
            <div className="detail-line">
              <span>Tên miền</span>
              <strong>{viewer.tenant.hostname}</strong>
            </div>
            <div className="detail-line">
              <span>Múi giờ</span>
              <strong>{viewer.tenant.timezone}</strong>
            </div>
            <div className="detail-line">
              <span>Ngày kết thúc kỳ</span>
              <strong>
                {new Date(viewer.entitlement.endsAt).toLocaleDateString('vi', {
                  timeZone: viewer.tenant.timezone,
                })}
              </strong>
            </div>
          </div>
        </Card>
      </div>
      <Card className="next-section">
        <div className="card-heading">
          <div>
            <h2>Sẵn sàng cho những bước tiếp theo</h2>
            <p>Sản phẩm, nội dung và CRM sẽ kết nối tại đây.</p>
          </div>
          <Badge>Đang phát triển</Badge>
        </div>
        <EmptyState
          icon={<Layers3 size={25} />}
          title="Một nền tảng, nhiều cơ hội"
          description="Các chức năng sản phẩm, website và quản lý khách hàng sẽ được triển khai theo lộ trình. Chưa có dữ liệu kinh doanh để thống kê."
        />
      </Card>
    </>
  );
}
