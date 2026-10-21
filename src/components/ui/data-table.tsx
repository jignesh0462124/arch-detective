import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  mono?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  dense?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  dense = false,
  className,
}: DataTableProps<T>) {
  const cellPad = dense ? "px-4 py-2.5" : "px-5 py-3";

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b hairline-soft bg-secondary/80">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  cellPad,
                  "text-xs font-medium text-muted-foreground",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  !c.align && "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={cn(cellPad, "text-muted-foreground text-sm")}>
                {emptyState ?? "No data."}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const interactive = Boolean(onRowClick);
              return (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  onClick={interactive ? () => onRowClick?.(row) : undefined}
                  className={cn(
                    "border-b hairline-soft last:border-b-0 transition-colors",
                    interactive && "cursor-pointer hover:bg-secondary/70",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        cellPad,
                        c.mono && "font-mono text-[12px]",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
