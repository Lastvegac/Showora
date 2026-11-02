import { useTenantKey } from '../../app/query-key';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Member, Page, Team } from '@showora/shared-types';
import { teamSchema, type TeamInput } from '@showora/shared-validation';
import {
  BottomActionBar,
  Button,
  Checkbox,
  Dialog,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Select,
} from '@showora/ui';
import { toast } from 'sonner';
import { api, errorMessage, jsonBody } from '../../lib/api';
export function TeamDialog({ team, onClose }: { team?: Team; onClose: () => void }) {
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: useTenantKey('team-eligible-members'),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<Page<Pick<Member, 'id' | 'displayName' | 'status'>>> =>
      api(`/teams/eligible-members?limit=100${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: team?.name ?? '',
      members: team?.members.map((m) => ({ memberId: m.memberId, role: m.role })) ?? [],
    },
  });
  const selected = useWatch({ control: form.control, name: 'members' });
  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const mutation = useMutation({
    mutationFn: (value: TeamInput) =>
      team
        ? api(`/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify(value) })
        : api('/teams', jsonBody(value)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['teams'] });
      await client.invalidateQueries({ queryKey: ['overview'] });
      toast.success('Đã lưu nhóm kinh doanh.');
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={team ? 'Chỉnh sửa nhóm' : 'Tạo nhóm kinh doanh'}
      description="Tổ chức đội ngũ và xác định người quản lý nhóm."
    >
      <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} noValidate>
        <div className="form-body">
          <Field label="Tên nhóm" error={form.formState.errors.name?.message} required>
            <Input {...form.register('name')} placeholder="Tên nhóm kinh doanh" />
          </Field>
          <fieldset className="choice-fieldset">
            <legend>Thành viên và trách nhiệm</legend>
            {query.isPending ? (
              <LoadingState />
            ) : query.error ? (
              <ErrorState
                message={errorMessage(query.error)}
                retry={() => {
                  void query.refetch();
                }}
              />
            ) : (
              rows.map((member) => {
                const value = selected.find((m) => m.memberId === member.id);
                return (
                  <div className="permission-row" key={member.id}>
                    <label>
                      <Checkbox
                        checked={!!value}
                        disabled={member.status !== 'active' && !value}
                        onChange={(e) =>
                          form.setValue(
                            'members',
                            e.target.checked
                              ? [...selected, { memberId: member.id, role: 'sales' }]
                              : selected.filter((m) => m.memberId !== member.id),
                          )
                        }
                      />
                      <span>
                        {member.displayName}
                        {member.status !== 'active' && ' (vô hiệu hóa)'}
                      </span>
                    </label>
                    {value && (
                      <Select
                        aria-label={`Trách nhiệm của ${member.displayName}`}
                        value={value.role}
                        onChange={(e) =>
                          form.setValue(
                            'members',
                            selected.map((m) =>
                              m.memberId === member.id
                                ? { ...m, role: e.target.value as 'manager' | 'sales' }
                                : m,
                            ),
                          )
                        }
                      >
                        <option value="sales">Thành viên</option>
                        <option value="manager">Quản lý</option>
                      </Select>
                    )}
                  </div>
                );
              })
            )}
            {query.hasNextPage && (
              <Button
                type="button"
                variant="secondary"
                busy={query.isFetchingNextPage}
                onClick={() => {
                  void query.fetchNextPage();
                }}
              >
                Tải thêm thành viên
              </Button>
            )}
          </fieldset>
          {form.formState.errors.members && (
            <p className="field-error" role="alert">
              Danh sách thành viên chưa hợp lệ.
            </p>
          )}
          {mutation.error && <Notice tone="warning">{errorMessage(mutation.error)}</Notice>}
        </div>
        <BottomActionBar>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="submit" busy={mutation.isPending}>
            Lưu nhóm
          </Button>
        </BottomActionBar>
      </form>
    </Dialog>
  );
}
