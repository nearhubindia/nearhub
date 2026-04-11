"use client";

import * as React from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type Updater,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    filterPlaceholder?: string;
    disableColumnSelector?: boolean;
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  showSearch?: boolean;
  showColumnVisibility?: boolean;
  showPagination?: boolean;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  pageIndex?: number;
  onPageIndexChange?: (pageIndex: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageCount?: number;
  rowCount?: number;
  manualPagination?: boolean;
  className?: string;
}

function getSearchableText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(getSearchableText).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(getSearchableText)
      .join(' ');
  }
  return '';
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  searchValue,
  onSearchValueChange,
  toolbarLeft,
  toolbarRight,
  showSearch = true,
  showColumnVisibility = true,
  showPagination = true,
  pageSizeOptions = [10, 20, 30, 50],
  initialPageSize = 10,
  pageIndex,
  onPageIndexChange,
  pageSize,
  onPageSizeChange,
  pageCount,
  rowCount,
  manualPagination = false,
  className,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState<string>('');
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(
    {}
  );
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = React.useState(false);
  const columnMenuRef = React.useRef<HTMLDivElement | null>(null);

  const resolvedGlobalFilter = searchValue ?? internalGlobalFilter;
  const resolvedPageIndex = pageIndex ?? internalPagination.pageIndex;
  const resolvedPageSize = pageSize ?? internalPagination.pageSize;

  const setResolvedGlobalFilter = React.useCallback(
    (value: string) => {
      if (onSearchValueChange) {
        onSearchValueChange(value);
      } else {
        setInternalGlobalFilter(value);
      }
    },
    [onSearchValueChange]
  );

  const setResolvedPageIndex = React.useCallback(
    (nextPageIndex: number) => {
      if (onPageIndexChange) {
        onPageIndexChange(nextPageIndex);
      } else {
        setInternalPagination((current) => ({ ...current, pageIndex: nextPageIndex }));
      }
    },
    [onPageIndexChange]
  );

  const setResolvedPageSize = React.useCallback(
    (nextPageSize: number) => {
      if (onPageSizeChange) {
        onPageSizeChange(nextPageSize);
      } else {
        setInternalPagination((current) => ({ ...current, pageIndex: 0, pageSize: nextPageSize }));
      }
      if (onPageIndexChange) {
        onPageIndexChange(0);
      }
    },
    [onPageIndexChange, onPageSizeChange]
  );

  const handlePaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: resolvedPageIndex, pageSize: resolvedPageSize })
          : updater;

      if (next.pageIndex !== resolvedPageIndex) {
        setResolvedPageIndex(next.pageIndex);
      }
      if (next.pageSize !== resolvedPageSize) {
        setResolvedPageSize(next.pageSize);
      }
    },
    [resolvedPageIndex, resolvedPageSize, setResolvedPageIndex, setResolvedPageSize]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: internalSorting,
      globalFilter: resolvedGlobalFilter,
      columnFilters: internalColumnFilters,
      columnVisibility: internalColumnVisibility,
      pagination: {
        pageIndex: resolvedPageIndex,
        pageSize: resolvedPageSize,
      },
    },
    defaultColumn: {
      filterFn: 'includesString',
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? '').trim().toLowerCase();
      if (!query) return true;
      const rowText = row
        .getVisibleCells()
        .map((cell) => getSearchableText(cell.getValue()))
        .join(' ')
        .toLowerCase();
      return rowText.includes(query);
    },
    onSortingChange: setInternalSorting,
    onGlobalFilterChange: setResolvedGlobalFilter,
    onColumnFiltersChange: setInternalColumnFilters,
    onColumnVisibilityChange: setInternalColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    pageCount,
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    if (resolvedPageIndex !== 0) {
      setResolvedPageIndex(0);
    }
    // Reset to the first page whenever filters/search change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedGlobalFilter, internalColumnFilters]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const visibleColumnCount = Math.max(1, visibleLeafColumns.length);
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  const allHideableVisible =
    hideableColumns.length === 0 ? true : hideableColumns.every((column) => column.getIsVisible());
  const filteredRowCount =
    rowCount ?? table.getFilteredRowModel().rows.length ?? table.getRowModel().rows.length;
  const currentRowCount = table.getRowModel().rows.length;
  const rangeStart = filteredRowCount === 0 ? 0 : resolvedPageIndex * resolvedPageSize + 1;
  const rangeEnd =
    filteredRowCount === 0 ? 0 : rangeStart + Math.max(0, currentRowCount - 1);
  const computedPageCount = pageCount ?? table.getPageCount();

  const toggleAllColumns = (): void => {
    const nextVisibility: VisibilityState = {};
    hideableColumns.forEach((column) => {
      nextVisibility[column.id] = !allHideableVisible;
    });
    setInternalColumnVisibility((current) => ({
      ...current,
      ...nextVisibility,
    }));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {(toolbarLeft || toolbarRight || showSearch || showColumnVisibility || showPagination) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {toolbarLeft}

            {showSearch && (
              <div className="relative">
                <Input
                  placeholder={searchPlaceholder}
                  value={resolvedGlobalFilter ?? ''}
                  onChange={(event) => setResolvedGlobalFilter(event.target.value)}
                  className="w-[260px] pl-10"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            )}

            {showColumnVisibility && (
              <div className="relative" ref={columnMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnMenuOpen((value) => !value)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                  Columns
                </button>

                {isColumnMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">
                      <Checkbox checked={allHideableVisible} onCheckedChange={toggleAllColumns} />
                      <span>All Columns</span>
                    </label>

                    <div className="my-2 border-t border-slate-100" />

                    {table.getAllLeafColumns().map((column) => {
                      const canHide = column.getCanHide();
                      return (
                        <label
                          key={column.id}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-50',
                            !canHide && 'cursor-not-allowed opacity-60 hover:bg-transparent'
                          )}
                        >
                          <Checkbox
                            checked={column.getIsVisible()}
                            disabled={!canHide}
                            onCheckedChange={() => {
                              if (!canHide) return;
                              column.toggleVisibility();
                            }}
                          />
                          <span className="truncate">
                            {String(column.columnDef.header ?? column.id)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {toolbarRight}

            {showPagination && (
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  value={resolvedPageSize}
                  onChange={(event) => setResolvedPageSize(Number(event.target.value))}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gradient-to-r from-teal-700 to-cyan-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <TableRow className="border-none">
                  {headerGroup.headers.map((header) => {
                    const isSortable = header.column.getCanSort();
                    const sortingState = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                        className={cn(
                          'select-none py-4 text-sm font-semibold tracking-wide text-white',
                          isSortable && 'cursor-pointer',
                          header.column.columnDef.meta?.headerClassName
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isSortable && (
                            <span className="text-xs text-white/80">
                              {{
                                asc: '↑',
                                desc: '↓',
                              }[sortingState as string] ?? '↑↓'}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>

                <TableRow className="bg-white">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="p-2">
                      {header.column.getCanFilter() ? (
                        <Input
                          placeholder={header.column.columnDef.meta?.filterPlaceholder ?? 'Filter...'}
                          value={(header.column.getFilterValue() as string) ?? ''}
                          onChange={(event) => header.column.setFilterValue(event.target.value)}
                          className="h-8 text-xs shadow-none"
                        />
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </React.Fragment>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.columnDef.meta?.cellClassName)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="py-10 text-center text-slate-500">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {rangeStart}-{rangeEnd} of {filteredRowCount} filtered rows
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </Button>
            <span className="text-sm text-slate-600">
              Page {resolvedPageIndex + 1} of {Math.max(1, computedPageCount)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
