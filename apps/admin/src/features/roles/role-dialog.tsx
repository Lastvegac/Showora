import { useTenantKey } from '../../app/query-key';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission, Role, Scope } from '@showora/shared-types';
import { roleSchema, type RoleInput } from '@showora/shared-validation';
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
const scopeLabels: Record<Scope, string> = {
  own: 'Của mình',
  team: 'Trong nhóm',
  all: 'Toàn doanh nghiệp',
};
export function RoleDialog({ role, onClose }: { role?: Role; onClose: () => void }) {
  const client = useQueryClient();
  const catalog = useQuery<{ key: string; scopes: Scope[] }[]>({
    queryKey: useTenantKey('permission-catalog'),
    queryFn: () => api('/permissions'),
  });
  const form = useForm<RoleInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name ?? '', permissions: role?.permissions ?? [] },
  });
  const selected = useWatch({ control: form.control, name: 'permissions' });
  const setPermissions = (value: Permission[]) =>
    form.setValue('permissions', value, { shouldValidate: true });
  const mutation = useMutation({
    mutationFn: (value: RoleInput) =>
      role
        ? api(`/roles/${role.id}`, { method: 'PATCH', body: JSON.stringify(value) })
        : api('/roles', jsonBody(value)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['roles'] });
      await client.invalidateQueries({ queryKey: ['overview'] });
      await client.invalidateQueries({ queryKey: ['assignable-roles'] });
      toast.success('Đã lưu vai trò.');
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title={role ? 'Chỉnh sửa vai trò' : 'Tạo vai trò tùy chỉnh'}
      description="Chọn quyền và phạm vi phù hợp với trách nhiệm của thành viên."
    >
      <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} noValidate>
        <div className="form-body">
          <Field label="Tên vai trò" error={form.formState.errors.name?.message} required>
            <Input {...form.register('name')} placeholder="Tên vai trò trong doanh nghiệp" />
          </Field>
          <Notice>
            Bạn chỉ có thể cấp những quyền nằm trong phạm vi của mình. Thay đổi sẽ thu hồi phiên
            đăng nhập của thành viên bị ảnh hưởng.
          </Notice>
          {catalog.isPending ? (
            <LoadingState />
          ) : catalog.error ? (
            <ErrorState
              message={errorMessage(catalog.error)}
              retry={() => {
                void catalog.refetch();
              }}
            />
          ) : (
            <fieldset className="choice-fieldset permission-list">
              <legend>Quyền truy cập ({selected.length})</legend>
              {catalog.data.map((entry) => {
                const grant = selected.find((p) => p.key === entry.key);
                return (
                  <div className="permission-row" key={entry.key}>
                    <label>
                      <Checkbox
                        checked={!!grant}
                        onChange={(event) =>
                          setPermissions(
                            event.target.checked
                              ? [...selected, { key: entry.key, scope: entry.scopes[0]! }]
                              : selected.filter((p) => p.key !== entry.key),
                          )
                        }
                      />
                      <span>{entry.key}</span>
                    </label>
                    {grant && (
                      <Select
                        aria-label={`Phạm vi ${entry.key}`}
                        value={grant.scope}
                        onChange={(e) =>
                          setPermissions(
                            selected.map((p) =>
                              p.key === entry.key ? { ...p, scope: e.target.value as Scope } : p,
                            ),
                          )
                        }
                      >
                        {entry.scopes.map((scope) => (
                          <option key={scope} value={scope}>
                            {scopeLabels[scope]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}
          {form.formState.errors.permissions && (
            <p className="field-error" role="alert">
              Chọn ít nhất một quyền, không trùng lặp.
            </p>
          )}
          {mutation.error && <Notice tone="warning">{errorMessage(mutation.error)}</Notice>}
        </div>
        <BottomActionBar>
          <Button variant="secondary" type="button" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="submit" busy={mutation.isPending}>
            Lưu vai trò
          </Button>
        </BottomActionBar>
      </form>
    </Dialog>
  );
}
