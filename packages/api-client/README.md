# @realestategear/api-client

Environment-safe API base URL resolution for Real Estate Gear applications. Public
browser resolution reads only `NEXT_PUBLIC_API_URL`; server resolution supports
`API_INTERNAL_URL`, `API_URL`, and `NEXT_PUBLIC_API_URL` in that order.

URLs must be absolute HTTP(S) URLs without embedded credentials, queries, or
fragments.
