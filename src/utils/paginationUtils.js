export const TABLE_PAGE_SIZE = 15;

export function getPagination(total, requestedPage = 1, pageSize = TABLE_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, requestedPage));
  const offset = (page - 1) * pageSize;
  return { page, pageCount, pageSize, total, offset, start: total ? offset + 1 : 0, end: Math.min(offset + pageSize, total) };
}
