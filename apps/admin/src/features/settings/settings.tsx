import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tenantUpdateSchema } from '@showora/shared-validation';
import { BottomActionBar, Button, Card, Field, Input, Notice, PageHeading } from '@showora/ui';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../../app/session';
import { api, errorMessage } from '../../lib/api';
export function SettingsPage() {
  const { viewer } = useSession();
  const client = useQueryClient();
  const form = useForm<{ name: string; timezone: string }>({
    resolver: zodResolver(tenantUpdateSchema),
    defaultValues: { name: viewer?.tenant.name, timezone: viewer?.tenant.timezone },
  });
  const mutation = useMutation({
    mutationFn: (value: { name: string; timezone: string }) =>
      api('/tenant', { method: 'PATCH', body: JSON.stringify(value) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['viewer'] });
      toast.success('Đã cập nhật thông tin doanh nghiệp.');
    },
  });
  return (
    <>
      <PageHeading
        title="Cài đặt doanh nghiệp"
        eyebrow="THIẾT LẬP"
        description="Thông tin chung cho không gian làm việc của bạn."
      />
      <Card className="settings-card">
        <div className="card-heading">
          <div>
            <h2>Thông tin cơ bản</h2>
            <p>Được sử dụng trong toàn bộ không gian quản trị.</p>
          </div>
        </div>
        <form onSubmit={form.handleSubmit((value) => mutation.mutate(value))} noValidate>
          <div className="form-body">
            <Field label="Tên doanh nghiệp" error={form.formState.errors.name?.message} required>
              <Input {...form.register('name')} />
            </Field>
            <Field
              label="Múi giờ"
              hint="Tên múi giờ IANA, ví dụ Asia/Ho_Chi_Minh"
              error={form.formState.errors.timezone?.message}
              required
            >
              <Input {...form.register('timezone')} />
            </Field>
            <Field label="Tên miền">
              <Input value={viewer?.tenant.hostname} disabled />
            </Field>
            {mutation.error && <Notice tone="warning">{errorMessage(mutation.error)}</Notice>}
          </div>
          <BottomActionBar>
            <Button
              type="submit"
              busy={mutation.isPending}
              disabled={!viewer?.entitlement.writable}
            >
              <Save size={15} />
              Lưu thay đổi
            </Button>
          </BottomActionBar>
        </form>
      </Card>
    </>
  );
}
