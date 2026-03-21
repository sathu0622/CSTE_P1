# Shared Architecture Diagram

```mermaid
flowchart LR
    Client[Web/Mobile Client]

    UserSvc[User Service]
    ProductSvc[Product Service]
    OrderSvc[Order Service]
    PaymentSvc[Payment Service]

    UserDB[(User MongoDB)]
    ProductDB[(Product MongoDB)]
    OrderDB[(Order MongoDB)]
    PaymentDB[(Payment MongoDB)]

    TeammateSvc[Teammate Service]

    Client -->|JWT Auth| UserSvc
    Client --> ProductSvc
    Client --> OrderSvc
    Client --> PaymentSvc

    UserSvc --> UserDB
    ProductSvc --> ProductDB
    OrderSvc --> OrderDB
    PaymentSvc --> PaymentDB

    OrderSvc -->|Validate Product| ProductSvc
    PaymentSvc -->|Verify/Update Order| OrderSvc
    UserSvc -->|Fetch Order Count| OrderSvc
    ProductSvc -->|Validate Admin Role| UserSvc
    OrderSvc -->|Group Demo Integration| TeammateSvc

    subgraph Cloud[Cloud Runtime (Azure Container Apps / AWS ECS)]
      UserSvc
      ProductSvc
      OrderSvc
      PaymentSvc
    end

    subgraph DevSecOps
      CI[GitHub Actions CI]
      SAST[Snyk Scan]
      Registry[GHCR Container Registry]
      CD[Deploy Workflow Template]
    end

    CI --> SAST
    CI --> Registry
    Registry --> CD
```
