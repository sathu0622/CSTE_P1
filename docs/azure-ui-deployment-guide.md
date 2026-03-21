# Azure UI Deployment Guide (No AWS, No CLI)

This guide shows how to deploy your 4 microservices using **Azure Portal UI** with **Azure Container Apps**.
Repository: [sathu0622/CSTE_P1](https://github.com/sathu0622/CSTE_P1)

## 0) What you already have

- Public GitHub repo with code
- Docker installed locally
- MongoDB Atlas cluster ready
- CI workflow that builds images to GHCR

If your local stack is already working with Docker, skip directly to section **2**.

## 0.1 Quick local check (optional)

From repo root, this confirms containers run before cloud deployment:

```bash
docker compose up --build
```

Health checks:
- `http://localhost:4001/health`
- `http://localhost:4002/health`
- `http://localhost:4003/health`
- `http://localhost:4004/health`

## 1) Set GitHub secret for Snyk (without `gh` command)

Your terminal error happened because GitHub CLI (`gh`) is not installed. Use GitHub web UI instead:

1. Open your repository on GitHub
2. Go to `Settings` -> `Secrets and variables` -> `Actions`
3. Click `New repository secret`
4. Name: `SNYK_TOKEN`
5. Value: your Snyk token
6. Save

## 2) Ensure images are published to GHCR

1. Push latest code to `main`
2. Open GitHub `Actions` tab
3. Confirm `CI` workflow succeeds
4. Confirm packages exist in GHCR:
   - `ecommerce-user-service`
   - `ecommerce-product-service`
   - `ecommerce-order-service`
   - `ecommerce-payment-service`

If package visibility is private, keep a GitHub PAT with `read:packages`.

### 2.1 If Snyk token fails with 401

If CI shows `Authentication error (SNYK-0005)`:

1. Regenerate token in Snyk dashboard
2. Update GitHub secret `SNYK_TOKEN`
3. Re-run CI

This is token/auth issue only; not a Docker or Azure issue.

## 3) Create Azure resources in Portal

### 3.1 Resource Group

1. Azure Portal -> `Resource groups` -> `Create`
2. Name: `rg-ecommerce-microservices`
3. Region: pick one (example `East US`)
4. Create

### 3.2 Log Analytics Workspace

1. Azure Portal -> `Log Analytics workspaces` -> `Create`
2. Name: `log-ecommerce`
3. Resource group: `rg-ecommerce-microservices`
4. Region: same as above
5. Create

### 3.3 Container Apps Environment

1. Azure Portal -> `Container Apps Environments` -> `Create`
2. Name: `acae-ecommerce`
3. Resource group: `rg-ecommerce-microservices`
4. Region: same as above
5. Attach `log-ecommerce` workspace
6. Create

## 4) Deploy each microservice in Azure Container Apps (UI)

Create 4 container apps one by one.

### Common values (for each app)

- Environment: `acae-ecommerce`
- Ingress: `External`
- Transport: `Auto`
- Revision mode: `Single`
- Registry: `ghcr.io`
- Image path:
  - `ghcr.io/<your-github-owner>/ecommerce-user-service:latest`
  - `ghcr.io/<your-github-owner>/ecommerce-product-service:latest`
  - `ghcr.io/<your-github-owner>/ecommerce-order-service:latest`
  - `ghcr.io/<your-github-owner>/ecommerce-payment-service:latest`
- Registry authentication:
  - Username: GitHub username
  - Password/secret: GitHub PAT with `read:packages` (and `repo` scope if package visibility needs it)

### App-specific ports

- `user-service` -> target port `4001`
- `product-service` -> target port `4002`
- `order-service` -> target port `4003`
- `payment-service` -> target port `4004`

## 5) Add environment variables (UI)

In each Container App:
`Container App` -> `Containers` / `Environment variables` -> add variables.

### 5.1 user-service

- `NODE_ENV=production`
- `PORT=4001`
- `MONGO_URI=<atlas userdb uri>`
- `JWT_SECRET=<strong secret>`
- `JWT_EXPIRES_IN=1d`
- `ORDER_SERVICE_URL=<set after order service URL is known>`
- `ORDER_SERVICE_TIMEOUT_MS=5000`
- `SERVICE_SHARED_SECRET=<same shared secret used by all services>`
- `CORS_ORIGIN=*`
- `RATE_LIMIT_MAX=200`

### 5.2 product-service

- `NODE_ENV=production`
- `PORT=4002`
- `MONGO_URI=<atlas productdb uri>`
- `JWT_SECRET=<same jwt secret>`
- `USER_SERVICE_URL=<set after user service URL is known>`
- `USER_SERVICE_TIMEOUT_MS=5000`
- `SERVICE_SHARED_SECRET=<same shared secret>`
- `CORS_ORIGIN=*`
- `RATE_LIMIT_MAX=200`

### 5.3 order-service

- `NODE_ENV=production`
- `PORT=4003`
- `MONGO_URI=<atlas orderdb uri>`
- `JWT_SECRET=<same jwt secret>`
- `PRODUCT_SERVICE_URL=<set after product service URL is known>`
- `TEAMMATE_SERVICE_URL=<teammate service URL for demo>`
- `TEAMMATE_INTEGRATION_PATH=/api/integrations/order-created`
- `TEAMMATE_SERVICE_TIMEOUT_MS=5000`
- `SERVICE_SHARED_SECRET=<same shared secret>`
- `CORS_ORIGIN=*`
- `RATE_LIMIT_MAX=200`

### 5.4 payment-service

- `NODE_ENV=production`
- `PORT=4004`
- `MONGO_URI=<atlas paymentdb uri>`
- `ORDER_SERVICE_URL=<set after order service URL is known>`
- `JWT_SECRET=<same jwt secret>`
- `SERVICE_SHARED_SECRET=<same shared secret>`
- `CORS_ORIGIN=*`
- `RATE_LIMIT_MAX=200`

## 6) Wire service URLs after deployment

After all 4 apps are created:

1. Open each app -> copy `Application URL`
2. Update env vars:
   - `user-service.ORDER_SERVICE_URL = <order app url>`
   - `product-service.USER_SERVICE_URL = <user app url>`
   - `order-service.PRODUCT_SERVICE_URL = <product app url>`
   - `payment-service.ORDER_SERVICE_URL = <order app url>`
3. Save and restart/redeploy revisions if prompted

Tip: after each env update, wait until the new revision is healthy before testing.

## 7) Verify deployment

Open these URLs:

- `<user-url>/health`
- `<product-url>/health`
- `<order-url>/health`
- `<payment-url>/health`

Swagger:

- `<user-url>/api-docs`
- `<product-url>/api-docs`
- `<order-url>/api-docs`
- `<payment-url>/api-docs`

## 8) Demo flow for viva (recommended)

1. Register + login user (`user-service`)
2. Create admin product (`product-service`) with admin token
3. Create order (`order-service`) -> shows cross-service validation
4. Trigger payment (`payment-service`) -> updates order status
5. Show teammate integration fields in order response:
   - `integrationDemo.teammateServiceNotified`
   - `integrationDemo.teammateServiceResponse`

## 9) Troubleshooting

- `401/403 on product write`: check `SERVICE_SHARED_SECRET` is identical in `user-service` and `product-service`.
- `503 Authorization service unavailable`: verify `USER_SERVICE_URL` in product service.
- `500 DB errors`: check MongoDB Atlas IP/network access and URI format.
- `Image pull failed`: verify GHCR credentials and package visibility.
- `Snyk step skipped`: confirm `SNYK_TOKEN` is set in GitHub repo secrets.
- `Container app revision failed`: verify correct `PORT` and target port mapping (4001/4002/4003/4004).
- `Inter-service call timeout`: verify app URLs in env vars and ensure ingress is enabled.
