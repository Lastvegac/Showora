import { useTenantKey } from '../../app/query-key';
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from '@showora/ui';
import type { Member, Page } from '@showora/shared-types';
import { Mail, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { MemberDialog } from './member-dialog';
import { useSession } from '../../app/session';
export function MembersPage() {
  const { viewer } = useSession();
  const client = useQueryClient();
  const [dialog, setDialog] = useState<Member | 'invite' | null>(null);
  const query = useInfiniteQuery({
    queryKey: useTenantKey('members'),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<Page<Member>> =>
      api(`/members?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const invitations = useQuery<{ id: string; email: string; expiresAt: string }[]>({
    queryKey: useTenantKey('invitations'),
    queryFn: () => api('/members/invitations'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/members/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['invitations'] });
      void client.invalidateQueries({ queryKey: ['viewer'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      toast.success('Đã thu hồi lời mời.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="CON NGƯỜI & KẾT NỐI"
        title="Đội ngũ của bạn"
        description="Mỗi người một vai trò. Cùng nhau tạo nên giá trị."
        action={
          <Button onClick={() => setDialog('invite')} disabled={!viewer?.entitlement.writable}>
            <Plus size={16} />
            Mời thành viên
          </Button>
        }
      />
      <Card>
        <div className="card-heading">
          <div>
            <h2>Thành viên doanh nghiệp</h2>
            <p>Quản lý trạng thái và quyền truy cập của đội ngũ.</p>
          </div>
          <Badge tone="brand">
            {viewer?.entitlement.staffUsed} / {viewer?.entitlement.staffLimit} vị trí
          </Badge>
        </div>
        <DataTable<Member>
          label="Danh sách thành viên"
          rows={rows}
          rowKey={(row) => row.id}
          loading={query.isPending}
          error={query.error ? errorMessage(query.error) : undefined}
          retry={() => {
            void query.refetch();
          }}
          emptyTitle="Chưa có thành viên"
          emptyDescription="Mời đội ngũ cùng tham gia không gian làm việc."
          columns={[
            {
              header: 'Thành viên',
              cell: (m) => (
                <div className="person-cell">
                  <Avatar name={m.displayName} />
                  <div>
                    <strong>{m.displayName}</strong>
                    <p>{m.email}</p>
                  </div>
                </div>
              ),
            },
            {
              header: 'Vai trò',
              cell: (m) => (
                <div className="inline-actions">
                  {m.roles.map((r) => (
                    <Badge key={r.id}>{r.name}</Badge>
                  ))}
                </div>
              ),
            },
            {
              header: 'Trạng thái',
              cell: (m) => (
                <Badge tone={m.status === 'active' ? 'success' : 'neutral'}>
                  {m.status === 'active' ? 'Hoạt động' : 'Vô hiệu hóa'}
                </Badge>
              ),
            },
            {
              header: 'Thao tác',
              cell: (m) =>
                m.roles.some((r) => r.key === 'TENANT_OWNER') ? (
                  <span className="text-muted text-small">Chủ doanh nghiệp</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!viewer?.entitlement.writable}
                    aria-label={`Chỉnh sửa ${m.displayName}`}
                    onClick={() => setDialog(m)}
                  >
                    <Pencil size={15} />
                  </Button>
                ),
            },
          ]}
        />
        {query.hasNextPage && (
          <div className="table-footer">
            <Button
              variant="secondary"
              busy={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Tải thêm thành viên
            </Button>
          </div>
        )}
      </Card>
      <Card className="next-section">
        <div className="card-heading">
          <div>
            <h2>Lời mời đang chờ</h2>
            <p>Vị trí nhân sự được giữ đến khi lời mời hết hạn hoặc bị thu hồi.</p>
          </div>
          <Mail size={17} />
        </div>
        {invitations.isPending ? (
          <LoadingState />
        ) : invitations.error ? (
          <ErrorState
            message={errorMessage(invitations.error)}
            retry={() => {
              void invitations.refetch();
            }}
          />
        ) : !invitations.data.length ? (
          <EmptyState
            compact
            title="Chưa có lời mời đang chờ"
            description="Lời mời mới sẽ xuất hiện tại đây cho đến khi được chấp nhận hoặc hết hạn."
          />
        ) : (
          <div className="invitation-list">
            {invitations.data.map((invitation) => (
              <div className="invitation-row" key={invitation.id}>
                <div>
                  <strong>{invitation.email}</strong>
                  <p>Hết hạn {new Date(invitation.expiresAt).toLocaleString('vi')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={revoke.isPending || !viewer?.entitlement.writable}
                  aria-label={`Thu hồi lời mời ${invitation.email}`}
                  onClick={() => revoke.mutate(invitation.id)}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {dialog && (
        <MemberDialog
          member={dialog === 'invite' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
