# Business Platform Architecture

Two independent business apps:
- apps/chloris: flower business
- apps/xianguopu: fruit business

Shared:
- tooling
- documentation
- future common packages

Current boundary:
- Chloris keeps its existing UI, backend and business workflow unchanged.
- Xianguopu owns its own Fastify API, PostgreSQL schema, admin UI, product media and deployment configuration.
- Only framework-agnostic utilities may move into packages/common after both apps have a proven identical need.

Business rules remain isolated:
- flower coupons/orders are independent
- fruit coupons/orders are independent
