import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from './primitives';
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  loading,
  error,
  retry,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[];
  columns: { header: string; cell: (row: T) => ReactNode }[];
  rowKey: (row: T) => string;
  label: string;
  loading?: boolean;
  error?: string;
  retry?: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.header}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
