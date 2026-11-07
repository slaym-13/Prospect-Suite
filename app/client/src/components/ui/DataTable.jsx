import { cn } from '../../lib/cn';

/**
 * Sortable table.
 *
 * @param columns {Array<{key, header, sortable, align, render, className}>}
 * @param sort    {{key: string, dir: 1|-1}}
 */
export function DataTable({ columns, rows, rowKey, onRowClick, sort, onSort, empty = 'Nothing to show.' }) {
  if (!rows.length) return <div className="p-6 text-center text-muted">{empty}</div>;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-2.5 py-2 text-left text-xs font-semibold text-muted',
                    col.align === 'right' && 'text-right',
                    col.sortable && onSort && 'cursor-pointer select-none hover:text-fg'
                  )}
                >
                  {col.header}
                  {active && (sort.dir > 0 ? ' ▲' : ' ▼')}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              className={cn('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2')}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-2.5 py-2 align-middle text-sm',
                    col.align === 'right' && 'whitespace-nowrap text-right tabular-nums',
                    col.className
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
