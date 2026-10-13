# Security and release review

## Implemented in this iteration
- Admin-only gallery uploads via signed Cloudflare R2 PUT URLs and product image records. Upload each selected file in one batch action; failed batches can be retried (not atomic).
- Explicit `PRIMARY_ADMIN_EMAIL` authorization for administrator management and audit access. Set this in `.env` to the intended owner account. Existing admin users remain privileged for other modules; granular RBAC is not implemented.
- Dynamic canonical, robots, Open Graph, Twitter card and JSON-LD tags. For robust SEO, add server-side rendering/pre-rendering, sitemap generation and production crawl tests.
- Reusable loading indicator and a commerce event helper. Event call sites and Pixel consent management still require integration.

## Production blockers / security findings
- Admin access is not full role-based access control; authenticated admins can edit other modules.
- Review R2 bucket CORS, allowed MIME types, orphaned uploads, quotas and public URL ownership.
- Test all CRUD modules with PostgreSQL and actual R2 credentials; live payment/OTP/shipping tests are not possible without credentials.
- Add a transactional batch gallery endpoint if all-or-nothing behavior is required.
- SPA SEO metadata is client-rendered; implement SSR or prerendering for reliable crawler coverage.
- Configure a consent manager and wire `trackCommerce` into confirmed events, especially Purchase only after server verification.
- Do not deploy without HTTPS, backup/recovery, dependency audit, rate limits and authorization tests.
