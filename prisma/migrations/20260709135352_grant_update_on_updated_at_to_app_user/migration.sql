-- Grant UPDATE privilege on raw_items.updated_at to app_user (needed for Prisma @updatedAt automation)
GRANT UPDATE (updated_at) ON public.raw_items TO app_user;