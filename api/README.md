# Office Data Manager API

Production-oriented Express and PostgreSQL backend for the Office Data Manager. The frontend remains in `../app` and is intentionally independent from this package.

## Local setup

1. Copy `.env.example` to `.env` and provide a PostgreSQL `DATABASE_URL` plus a strong `JWT_SECRET`.
2. Run `npm ci`.
3. Run `npm run prisma:migrate` and `npm run prisma:generate`.
4. Create the first administrator with `npm run admin:create -- --email admin@example.gov.mm --name "Admin"`.
5. Start the API with `npm run dev`.

Health checks are available at `GET /api/health` and `GET /api/ready`.

## Verification

- `npm run verify` runs linting, JavaScript type checking, a production bundle, unit/integration tests, and Prisma validation.
- `npm run test:e2e` runs the database-backed workflow when `RUN_DATABASE_TESTS=true` is set.
- `npm run prisma:status` confirms migration state.

## API groups

All routes except health, readiness, login, and token refresh require a bearer access token. Administrative mutations require the `ADMIN` role. Viewer results are filtered by `NORMAL`, `VIP`, or `ADMIN` access level before data is returned or aggregated.

- `/api/auth` — login, refresh, logout, current user, and password change.
- `/api/admin/users` — user lifecycle, role/access changes, enable/disable, and password reset.
- `/api/categories` and `/api/admin/categories` — unlimited-depth category tree, search, breadcrumb, move, archive, and restore.
- `/api/admin/imports` — Excel upload, inspection, sheet selection, preview, commit, and cancel.
- `/api/data` and `/api/admin/data` — collection definitions plus unified imported/manual record query and CRUD.
- `/api/documents` and `/api/admin/documents` — PDF/JPEG metadata, access-safe download, update, archive, and restore.
- `/api/dashboard` and `/api/admin/dashboard-widgets` — role-safe KPI, pie, bar, line, and category summary widgets.
- `/api/reports` and `/api/admin/reports` — JSON, Excel, and PDF exports from current filtered data.
- `/api/admin/audit` — searchable, cursor-paginated audit events.

## Storage and imports

`STORAGE_DRIVER=local` stores originals under `STORAGE_LOCAL_ROOT`. `STORAGE_DRIVER=s3` supports an S3-compatible object store using the endpoint, bucket, region, and credentials in `.env`. Excel imports retain the original workbook and also persist validated rows as structured database records, so later edits use the same record API as manually entered data.

Never commit `.env`, generated Prisma output, built files, or locally stored uploads.
