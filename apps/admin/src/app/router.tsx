import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, LoadingState, Logo } from '@showora/ui';
import { Link } from 'react-router-dom';
import { useSession } from './session';
import { AppShell } from './shell';
import { errorMessage } from '../lib/api';
function Protected() {
  const session = useSession();
  if (session.loading || session.error)
    return (
      <div className="app-start">
        <Logo />
        <Card>
          {session.error ? (
            <ErrorState message={errorMessage(session.error)} retry={session.retry} />
          ) : (
            <LoadingState />
          )}
        </Card>
      </div>
    );
  if (!session.viewer) return <Navigate to="/login" replace />;
  return <AppShell />;
}
function PermissionRoute({ permission }: { permission: string }) {
  const { can } = useSession();
  return can(permission) ? (
    <Outlet />
  ) : (
    <Card>
      <EmptyState
        title="Bạn chưa có quyền truy cập"
        description="Liên hệ người quản trị doanh nghiệp nếu bạn cần sử dụng chức năng này."
        action={
          <Button asChild variant="secondary">
            <Link to="/">Về tổng quan</Link>
          </Button>
        }
      />
    </Card>
  );
}
function NotFound() {
  return (
    <div className="app-start">
      <Logo />
      <Card>
        <EmptyState
          title="Không tìm thấy trang"
          description="Trang bạn đang tìm không tồn tại hoặc đã thay đổi."
          action={
            <Button asChild>
              <Link to="/">Về trang chủ</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
function accountPage(kind: 'verify' | 'forgot' | 'reset' | 'invitation') {
  return async () => {
    const { AccountActionPage } = await import('../features/auth/account-actions');
    return { Component: () => <AccountActionPage kind={kind} /> };
  };
}
export const router = createBrowserRouter([
  {
    hydrateFallbackElement: (
      <div className="app-start">
        <LoadingState />
      </div>
    ),
    children: [
      {
        path: '/login',
        lazy: async () => ({ Component: (await import('../features/auth/login')).LoginPage }),
      },
      {
        path: '/register',
        lazy: async () => ({ Component: (await import('../features/auth/register')).RegisterPage }),
      },
      { path: '/verify-email', lazy: accountPage('verify') },
      { path: '/forgot-password', lazy: accountPage('forgot') },
      { path: '/reset-password', lazy: accountPage('reset') },
      { path: '/accept-invitation', lazy: accountPage('invitation') },
      {
        element: <Protected />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('../features/dashboard/dashboard')).DashboardPage,
            }),
          },
          {
            element: <PermissionRoute permission="members.manage" />,
            children: [
              {
                path: '/members',
                lazy: async () => ({
                  Component: (await import('../features/members/members')).MembersPage,
                }),
              },
            ],
          },
          {
            element: <PermissionRoute permission="roles.manage" />,
            children: [
              {
                path: '/roles',
                lazy: async () => ({
                  Component: (await import('../features/roles/roles')).RolesPage,
                }),
              },
            ],
          },
          {
            element: <PermissionRoute permission="teams.manage" />,
            children: [
              {
                path: '/teams',
                lazy: async () => ({
                  Component: (await import('../features/teams/teams')).TeamsPage,
                }),
              },
            ],
          },
          {
            element: <PermissionRoute permission="tenant.write" />,
            children: [
              {
                path: '/settings',
                lazy: async () => ({
                  Component: (await import('../features/settings/settings')).SettingsPage,
                }),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
