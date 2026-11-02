import { useTenantKey } from '../../app/query-key';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@showora/shared-types';
import {
  Badge,
  BottomActionBar,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from '@showora/ui';
import { LockKeyhole, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { useSession } from '../../app/session';
import { RoleDialog } from './role-dialog';
export function RolesPage() {
  const { viewer } = useSession();
  const client = useQueryClient();
  const [dialog, setDialog] = useState<Role | 'create' | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const query = useQuery<Role[]>({ queryKey: useTenantKey('roles'), queryFn: () => api('/roles') });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['roles'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      toast.success('Đã xóa vai trò.');
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeading
        eyebrow="TRUY CẬP & BẢO MẬT"
        title="Vai trò & phân quyền"
        description="Đúng quyền, đúng người. Mỗi trách nhiệm đều rõ ràng."
        action={
          <Button disabled={!viewer?.entitlement.writable} onClick={() => setDialog('create')}>
            <Plus size={16} />
            Tạo vai trò
          </Button>
        }
      />
      {query.isPending ? (
        <Card>
          <LoadingState />
        </Card>
      ) : query.error ? (
        <Card>
          <ErrorState
            message={errorMessage(query.error)}
            retry={() => {
              void query.refetch();
            }}
          />
        </Card>
      ) : !query.data.length ? (
        <Card>
          <EmptyState
            title="Chưa có vai trò"
            description="Tạo vai trò để xác định quyền truy cập của thành viên."
          />
        </Card>
      ) : (
        <div className="roles-grid">
          {query.data.map((role) => (
            <Card className="role-card" key={role.id}>
              <div className="role-card-top">
                <span className="role-icon">
                  <ShieldCheck size={21} />
                </span>
                <Badge tone={role.isSystem ? 'neutral' : 'brand'}>
                  {role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'}
                </Badge>
              </div>
              <h2>{role.name}</h2>
              <p>{role.permissions.length} quyền truy cập được cấu hình</p>
              <div className="permission-preview">
                {role.permissions.slice(0, 3).map((permission) => (
                  <span key={permission.key}>{permission.key}</span>
                ))}
                {role.permissions.length > 3 && (
                  <span>+{role.permissions.length - 3} quyền khác</span>
                )}
              </div>
              <div className="role-card-footer">
                {role.isSystem ? (
                  <span>
                    <LockKeyhole size={13} />
                    Vai trò được bảo vệ
                  </span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!viewer?.entitlement.writable}
                      onClick={() => setDialog(role)}
                    >
                      <Pencil size={13} />
                      Chỉnh sửa
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Xóa ${role.name}`}
                      disabled={!viewer?.entitlement.writable}
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {dialog && (
        <RoleDialog
          role={dialog === 'create' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setDeleting(null);
          }}
          title="Xóa vai trò?"
          description={`Vai trò “${deleting.name}” chỉ có thể xóa nếu chưa được gán cho thành viên.`}
        >
          <BottomActionBar>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
              disabled={remove.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              busy={remove.isPending}
              onClick={() => remove.mutate(deleting.id)}
            >
              Xóa vai trò
            </Button>
          </BottomActionBar>
        </Dialog>
      )}
    </>
  );
}
