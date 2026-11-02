import { useState } from "react";
import { getPagination } from "../utils/paginationUtils";

export function usePagination(rows, filters = []) {
  const key = JSON.stringify(filters);
  const [position, setPosition] = useState({ key, page: 1 });
  const pagination = getPagination(rows.length, position.key === key ? position.page : 1);
  if (position.key !== key || position.page !== pagination.page) setPosition({ key, page: pagination.page });
  return {
    ...pagination,
    rows: rows.slice(pagination.offset, pagination.end),
    setPage: (page) => setPosition({ key, page }),
  };
}
