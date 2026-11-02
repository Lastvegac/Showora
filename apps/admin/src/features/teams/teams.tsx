import { useTenantKey } from '../../app/query-key';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Team } from '@showora/shared-types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from '@showora/ui';
import { Pencil, Plus, UsersRound } from 'lucide-react';
import { useSession } from '../../app/session';
import { api, errorMessage } from '../../lib/api';
import { TeamDialog } from './team-dialog';
export function TeamsPage() {
  const { viewer } = useSession();
  const [dialog, setDialog] = useState<Team | 'create' | null>(null);
  const query = useQuery<Team[]>({ queryKey: useTenantKey('teams'), queryFn: () => api('/teams') });
  return (
    <>
      <PageHeading
        eyebrow="TỔ CHỨC & PHỐI HỢP"
        title="Nhóm kinh doanh"
        description="Cùng mục tiêu, rõ trách nhiệm. Xây dựng đội ngũ hiệu quả."
        action={
          <Button disabled={!viewer?.entitlement.writable} onClick={() => setDialog('create')}>
            <Plus size={16} />
            Tạo nhóm
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
            icon={<UsersRound size={25} />}
            title="Đội ngũ mạnh bắt đầu từ một nhóm"
            description="Tạo nhóm kinh doanh đầu tiên, thêm thành viên và chọn người quản lý."
            action={
              <Button
                variant="secondary"
                onClick={() => setDialog('create')}
                disabled={!viewer?.entitlement.writable}
              >
                <Plus size={15} />
                Tạo nhóm đầu tiên
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="roles-grid">
          {query.data.map((team) => (
            <Card className="role-card" key={team.id}>
              <div className="role-card-top">
                <span className="role-icon">
                  <UsersRound size={21} />
                </span>
                <Badge tone="brand">{team.members.length} thành viên</Badge>
              </div>
              <h2>{team.name}</h2>
              <div className="team-members">
                {team.members.map((member) => (
                  <div className="person-cell" key={member.memberId}>
                    <Avatar name={member.displayName} size="sm" />
                    <div>
                      <strong>{member.displayName}</strong>
                      <p>{member.role === 'manager' ? 'Quản lý nhóm' : 'Thành viên'}</p>
                    </div>
                  </div>
                ))}
                {!team.members.length && (
                  <p className="text-small text-muted">Thêm thành viên để bắt đầu phối hợp.</p>
                )}
              </div>
              <div className="role-card-footer">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!viewer?.entitlement.writable}
                  onClick={() => setDialog(team)}
                >
                  <Pencil size={13} />
                  Chỉnh sửa nhóm
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {dialog && (
        <TeamDialog
          team={dialog === 'create' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
