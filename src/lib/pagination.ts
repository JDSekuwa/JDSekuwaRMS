export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function getPaginationParams(request: Request, defaultLimit = 10) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10));
  const search = searchParams.get("search") || undefined;

  const skip = (page - 1) * limit;
  const take = limit;

  return { page, limit, search, skip, take };
}

export function paginateResults<T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    data,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages
    }
  };
}
