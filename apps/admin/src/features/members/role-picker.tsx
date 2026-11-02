import type { Role } from '@showora/shared-types';
import { Checkbox } from '@showora/ui';
export function RolePicker({
  roles,
  selected,
  onChange,
}: {
  roles: Role[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="choice-fieldset">
      <legend>Vai trò được cấp</legend>
      {roles.map((role) => (
        <label className="choice-row" key={role.id}>
          <Checkbox
            checked={selected.includes(role.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, role.id]
                  : selected.filter((id) => id !== role.id),
              )
            }
          />
          <span>
            <strong>{role.name}</strong>
            <small>{role.permissions.length} quyền được cấu hình</small>
          </span>
        </label>
      ))}
      {!roles.length && (
        <p className="text-small text-muted">Bạn chưa có vai trò nào có thể cấp.</p>
      )}
    </fieldset>
  );
}
