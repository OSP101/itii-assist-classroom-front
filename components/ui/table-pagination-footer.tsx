"use client";

import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";

export const DEFAULT_TABLE_ROWS_PER_PAGE = 10;
export const TABLE_ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

interface TablePaginationFooterProps {
    totalItems: number;
    currentPage: number;
    rowsPerPage: number;
    totalPages: number;
    isEnglish: boolean;
    nounEnglish: string;
    nounEnglishPlural?: string;
    nounThai: string;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
    rowsPerPageOptions?: number[];
}

export default function TablePaginationFooter({
    totalItems,
    currentPage,
    rowsPerPage,
    totalPages,
    isEnglish,
    nounEnglish,
    nounEnglishPlural,
    nounThai,
    onPageChange,
    onRowsPerPageChange,
    rowsPerPageOptions = TABLE_ROWS_PER_PAGE_OPTIONS,
}: TablePaginationFooterProps) {
    if (totalItems <= 0) {
        return null;
    }

    const currentRangeStart = (currentPage - 1) * rowsPerPage + 1;
    const currentRangeEnd = Math.min(currentPage * rowsPerPage, totalItems);
    const nounLabel = isEnglish
        ? totalItems === 1
            ? nounEnglish
            : nounEnglishPlural || `${nounEnglish}s`
        : nounThai;
    const normalizedRowsPerPageOptions = Array.from(new Set([...rowsPerPageOptions, rowsPerPage])).sort(
        (left, right) => left - right
    );

    return (
        <div className="flex flex-col gap-3 border-t border-divider px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="text-center text-sm text-default-500 sm:text-left">
                    {isEnglish
                        ? `Showing ${currentRangeStart}-${currentRangeEnd} of ${totalItems} ${nounLabel}`
                        : `แสดง ${currentRangeStart}-${currentRangeEnd} จากทั้งหมด ${totalItems} ${nounLabel}`}
                </p>

                <div className="flex items-center justify-between gap-2 sm:justify-start">
                    <span className="shrink-0 text-sm text-default-500">
                        {isEnglish ? "Rows per page" : "จำนวนแถวต่อหน้า"}
                    </span>
                    <Select
                        aria-label={isEnglish ? "Rows per page" : "จำนวนแถวต่อหน้า"}
                        selectedKeys={new Set([String(rowsPerPage)])}
                        onSelectionChange={(keys) => {
                            const selectedKey = Array.from(keys)[0];
                            if (!selectedKey) {
                                return;
                            }

                            onRowsPerPageChange(Number(selectedKey));
                        }}
                        size="sm"
                        variant="bordered"
                        disallowEmptySelection
                        className="w-24 sm:w-28"
                        classNames={{
                            trigger: "h-9 min-h-9 border-default-200 bg-content1 hover:border-blue-300 data-[focus=true]:!border-blue-400",
                            value: "text-sm text-foreground",
                            popoverContent: "min-w-28",
                        }}
                    >
                        {normalizedRowsPerPageOptions.map((option) => (
                            <SelectItem key={String(option)}>
                                {String(option)}
                            </SelectItem>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="flex justify-center sm:justify-end">
                <Pagination
                    total={totalPages}
                    page={currentPage}
                    onChange={onPageChange}
                    showControls
                    size="sm"
                    color="primary"
                    classNames={{
                        wrapper: "gap-1",
                        item: "bg-transparent",
                        cursor: "bg-blue-500 text-white shadow-md",
                    }}
                />
            </div>
        </div>
    );
}