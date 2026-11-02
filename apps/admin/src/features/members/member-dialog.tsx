import { useTenantKey } from '../../app/query-key';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteSchema, memberUpdateSchema } from '@showora/shared-validation';
import type { Member, Role } from '@showora/shared-types';
import {
  BottomActionBar,
  Button,
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
import { RolePicker } from './role-picker';
import type { z } from 'zod';
export function MemberDialog({ member, onClose }: { member?: Member; onClose: () => void }) {
  const client = useQueryClient();
  const roles = useQuery<Role[]>({
    queryKey: useTenantKey('assignable-roles'),
    queryFn: () => api('/members/assignable-roles'),
  });
  type FormValues = { email?: string; status?: 'active' | 'disabled'; roleIds: string[] };
  const schema: z.ZodType<FormValues> = member ? memberUpdateSchema : inviteSchema;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: member
      ? { status: member.status as 'active' | 'disabled', roleIds: member.roles.map((r) => r.id) }
      : { email: '', roleIds: [] },
  });
  const selectedRoles = useWatch({ control: form.control, name: 'roleIds' });
  const mutation = useMutation({
    mutationFn: (value: unknown) =>
      member
        ? api(`/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(value) })
        : api('/members/invitations', jsonBody(value)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['members'] }),
        client.invalidateQueries({ queryKey: ['invitations'] }),
        client.invalidateQueries({ queryKey: ['overview'] }),
        client.invalidateQueries({ queryKey: ['viewer'] }),
      ]);
      toast.success(
        member ? 'Đã cập nhật thành viên.' : 'Đã tạo lời mời và đưa email vào hàng đợi gửi.',
      );
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={member ? 'Cập nhật thành viên' : 'Mời thành viên mới'}
      description={
        member
          ? `${member.displayName} · ${member.email}`
          : 'Gửi lời mời qua email và phân quyền phù hợp.'
      }
    >
      <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} noValidate>
        <div className="form-body">
          {!member ? (
            <Field label="Email công việc" error={form.formState.errors.email?.message} required>
              <Input
                {...form.register('email')}
                type="email"
                placeholder="thanhvien@doanhnghiep.vn"
              />
            </Field>
          ) : (
            <Field label="Trạng thái">
              <Select {...form.register('status')}>
                <option value="active">Đang hoạt động</option>
                <option value="disabled">Vô hiệu hóa</option>
              </Select>
            </Field>
          )}
          {roles.isPending ? (
            <LoadingState />
          ) : roles.error ? (
            <ErrorState
              message={errorMessage(roles.error)}
              retry={() => {
                void roles.refetch();
              }}
            />
          ) : (
            <RolePicker
              roles={roles.data}
              selected={selectedRoles}
              onChange={(value) => form.setValue('roleIds', value, { shouldValidate: true })}
            />
          )}
          {form.formState.errors.roleIds && (
            <p className="field-error" role="alert">
              Chọn ít nhất một vai trò hợp lệ.
            </p>
          )}
          {member && (
            <Notice>
              Thay đổi quyền hoặc trạng thái sẽ thu hồi các phiên đăng nhập hiện tại của thành viên.
            </Notice>
          )}
          {mutation.error && <Notice tone="warning">{errorMessage(mutation.error)}</Notice>}
        </div>
        <BottomActionBar>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="submit" busy={mutation.isPending} disabled={!roles.data?.length}>
            {member ? 'Lưu thay đổi' : 'Gửi lời mời'}
          </Button>
        </BottomActionBar>
      </form>
    </Dialog>
  );
}
