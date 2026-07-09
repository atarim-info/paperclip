# UTMS Task Estimation & Breakdown Plan

This plan outlines the detailed task breakdown and effort estimation for the UTMS (User & Tenant Management Microservice) implementation based on the approved DLD.

## Overview
The UTMS project consists of 4 microservices (auth-service, user-service, tenant-service, rbac-service) following hexagonal architecture with domain-driven design. Each service has its own PostgreSQL schema + Redis cache.

**DLD Reference:** [DETAILED-DESIGN.md](/ATA/issues/ATA-37#document-<!-- DLD ref -->) in the workspace at `documents/DETAILED-DESIGN.md`

## Effort Summary

| Phase | Total Story Points | Duration |
|-------|-------------------|---------|
| Phase 1: Core Infrastructure | 9 | Week 1 |
| Phase 2: Auth Service | 16 | Weeks 2-3 |
| Phase 3: User Service | 7 | Weeks 3-4 |
| Phase 4: Tenant Service | 11 | Weeks 4-5 |
| Phase 5: RBAC Service | 12 | Weeks 5-6 |
| Phase 6: Integration & Events | 9 | Weeks 6-7 |
| Phase 7: Infrastructure & Deployment | 7 | Weeks 7-8 |
| **Total** | **71** | **8 weeks** |

---

## Implementation Tasks with Detailed Instructions

### Phase 1: Core Infrastructure & Shared Components (Week 1, 9 SP)

---

#### Task 1.1: Platform Common Library (2 SP)

**Description:** Create the shared Maven BOM and platform-common module with shared JWT verification, observability, error handling, and event system base classes. All services depend on this.

**DLD References:** §1.4 Repository Structure, §3.1 Module Structure, §14 Appendix

**Files to Create:**
```
platform-common/
├── pom.xml                                    # BOM with dependency management
├── src/main/java/com/platform/common/
│   ├── jwt/
│   │   ├── JwtTokenVerifier.java              # RS256 verification via JWKS
│   │   ├── JwtClaims.java                     # Claims data class
│   │   └── JwtAuthenticationFilter.java       # Spring Security filter
│   ├── observability/
│   │   ├── LoggingFilter.java                 # Structured JSON logging filter
│   │   ├── MetricsConfig.java                 # Micrometer + Prometheus config
│   │   └── TracingConfig.java                 # OpenTelemetry tracing config
│   ├── web/
│   │   ├── ErrorResponse.java                 # Standard error envelope (DLD §7.2)
│   │   ├── GlobalExceptionHandler.java        # @RestControllerAdvice (DLD §9.3)
│   │   ├── FieldError.java                    # Validation field error DTO
│   │   └── PaginatedResponse.java             # Unified pagination (DLD §7.3)
│   └── event/
│       ├── CloudEvent.java                    # CloudEvents 1.0 base class (DLD ADR-006)
│       ├── EventPublisher.java                # Interface for Kafka publishing
│       └── EventConsumer.java                 # Interface for Kafka consuming
├── src/test/java/com/platform/common/
│   ├── jwt/JwtTokenVerifierTest.java
│   └── web/GlobalExceptionHandlerTest.java
```

**Key Classes/Interfaces:**
```java
// JWT verification
public class JwtTokenVerifier {
    public JwtClaims verify(String token) throws TokenExpiredException, InvalidSignatureException;
    public void refreshKeys();  // Called on JWKS rotation
}

// Event system
public interface EventPublisher {
    <T> void publish(String topic, CloudEvent<T> event);
}
public class CloudEvent<T> {
    String id, source, specversion, type, time, datacontenttype, subject;
    T data;
}
```

**API Contracts:** None (this is a library, not a service)

**Configuration:** `application.yml` for each service will import:
- JWT public key location (JWKS endpoint URL)
- Tracing endpoint (Jaeger/Zipkin)

**Error Handling:** Implement the GlobalExceptionHandler (DLD §9.3) with DomainException hierarchy:
```java
public abstract class DomainException extends RuntimeException { ... }
public class ValidationException extends DomainException { ... }
public class ResourceNotFoundException extends DomainException { ... }
```

**Logging Requirements:** JSON structured format per DLD §10.1. Include traceId, spanId, service name in MDC.

**Test Expectations:**
- Unit tests for JWT verification with known test keys (95% coverage)
- Unit tests for error handling and pagination response
- Verify CloudEvents 1.0 spec compliance

**Dependencies:** None (foundation for all other tasks)

---

#### Task 1.2: Database Schema Setup (3 SP)

**Description:** Create Flyway migration files for all four PostgreSQL schemas with RLS policies. Each service gets its own schema (auth, users, tenant, rbac) plus shared tables like applications and audit_log.

**DLD References:** §6 Database Schema DDL (all 23+ migrations), §6.3 RLS Policies

**Files to Create:**
```
platform-common/src/main/resources/db/migration/
├── V001__create_applications_table.sql         # DLD §6.1
├── V002__create_tenants_table.sql              # DLD §6.1
├── V003__create_users_table.sql                # DLD §6.1
├── V004__create_tenant_users_table.sql         # DLD §6.1
├── V005__create_user_credentials_table.sql     # DLD §6.1
├── V006__create_user_oauth_links_table.sql     # DLD §6.1
├── V007__create_user_mfa_configs_table.sql     # DLD §6.1
├── V008__create_user_sessions_table.sql        # DLD §6.1
├── V009__create_tenant_groups_table.sql        # DLD §6.1
├── V010__create_group_members_table.sql        # DLD §6.1
├── V011__create_roles_table.sql                # DLD §6.1
├── V012__create_permissions_table.sql          # DLD §6.1
├── V013__create_role_permissions_table.sql     # DLD §6.1
├── V014__create_user_role_assignments_table.sql # DLD §6.1
├── V015__create_group_role_assignments_table.sql # DLD §6.1
├── V016__create_tenant_settings_table.sql      # DLD §6.2
├── V017__create_tenant_applications_table.sql  # DLD §6.2
├── V018__create_audit_log_table.sql            # DLD §6.2
├── V019__seed_system_roles.sql                 # DLD §6.2
├── V020__seed_default_permissions.sql          # Seed basic CRUD permissions
├── V021__seed_applications.sql                 # Seed initial applications
├── V022__create_indexes.sql                    # Additional composite indexes
└── V023__enable_row_level_security.sql         # DLD §6.3 RLS policies
```

**Key Decisions:**
- All tables use UUID primary keys with `gen_random_uuid()`
- Soft deletes via `deleted_at` TIMESTAMPTZ columns
- RLS enforced on tenant-scoped tables using `app.current_tenant_id` session variable
- Audit log partitioned monthly (DLD §6.2)
- Flyway `ddl-auto: validate` in all services (not `update`)

**Configuration:** Each service's `application.yml`:
```yaml
spring:
  flyway:
    schemas: [service_schema_name]  # auth, users, tenant, rbac
    locations: classpath:db/migration
  jpa:
    hibernate:
      ddl-auto: validate
```

**Error Handling:** Migration failures must fail-fast. No automatic migration retry.

**Test Expectations:**
- Verify all migrations apply cleanly against a PostgreSQL 16 test container
- Verify rollback works for each migration (via Flyway undo or manual)
- Verify RLS policies prevent cross-tenant access

**Dependencies:** Task 1.1 (platform-common must exist for base classes)

---

#### Task 1.3: Caching Infrastructure (2 SP)

**Description:** Implement two-level caching with Caffeine (local JVM) + Redis (distributed) per DLD ADR-003 and §8.

**DLD References:** §8 Caching Strategy, §8.3 Caffeine Configuration

**Files to Create:**
```
platform-common/src/main/java/com/platform/common/cache/
├── CacheConfig.java                   # Caffeine + Redis cache manager config
├── LocalCacheManager.java             # Caffeine cache wrapper
├── DistributedCacheManager.java       # Redis cache wrapper
├── CacheInvalidationListener.java     # Kafka listener for cache eviction events
├── CacheMetricsCollector.java         # Micrometer gauge for hit/miss ratios
```

**Key Classes:**
```java
@Configuration
public class CacheConfig {
    @Bean
    public CacheManager caffeineCacheManager() {
        // Register jwks-keys (max 10, TTL 1h) and system-permissions (max 500, TTL 5min)
    }
    @Bean
    public RedisTemplate<String, Object> redisTemplate() { ... }
}

public class CacheInvalidationListener {
    @KafkaListener(topics = "cache.invalidation")
    public void onInvalidation(CacheInvalidationEvent event) {
        // Evict from Caffeine local cache + Redis
    }
}
```

**Configuration:**
```yaml
spring:
  data:
    redis:
      cluster:
        nodes: ${REDIS_CLUSTER_NODES}
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 32
          max-idle: 8
```

**Test Expectations:**
- Verify Caffeine local cache hits for JWKS keys
- Verify Redis pub/sub cache invalidation propagates across instances
- Verify cache TTL expiration works
- Verify cache metrics are exposed via Micrometer (/actuator/metrics)

**Dependencies:** Task 1.1 (platform-common)

---

#### Task 1.4: Event System (2 SP)

**Description:** Set up Kafka event bus infrastructure with CloudEvents v1.0 format per DLD ADR-006.

**DLD References:** §1.2 Inter-Service Communication, ADR-006

**Files to Create:**
```
platform-common/src/main/java/com/platform/common/event/
├── KafkaConfig.java                     # Kafka producer/consumer configuration
├── CloudEventSerializer.java            # JSON serializer for CloudEvents
├── CloudEventDeserializer.java          # JSON deserializer for CloudEvents
├── KafkaEventPublisher.java             # Implements EventPublisher
└── RetryableEventPublisher.java         # Wraps with Spring Retry + exponential backoff
```

**Key Topics (defined in config):**
- `user.lifecycle` — user.registered, user.email.verified, user.password.changed
- `user.auth` — user.login.success, user.login.failed
- `tenant.lifecycle` — tenant.created, tenant.suspended, tenant.plan.changed
- `tenant.membership` — member.invited, member.suspended, member.removed
- `rbac` — role.assigned, role.revoked, permissions.changed
- `cache.invalidation` — distributed cache eviction commands

**Configuration:**
```yaml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all
      compression-type: snappy
    consumer:
      group-id: ${spring.application.name}
      auto-offset-reset: earliest
```

**Error Handling:** Retry with exponential backoff for Kafka producer failures. Dead-letter topic for poison messages.

**Test Expectations:**
- Verify CloudEvent serialization/deserialization
- Verify Kafka producer delivers messages with `acks=all`
- Verify consumer group rebalancing

**Dependencies:** Task 1.1 (platform-common)

---

### Phase 2: Auth Service Implementation (Weeks 2-3, 16 SP)

---

#### Task 2.1: Authentication Core (5 SP)

**Description:** Implement email/password login, registration, token issuance, and session management.

**DLD References:** §4.1.1 Login Flow Classes, §5.1 Sequence Diagrams, §7.1 Auth API Contracts, §11.2 JWT Config, §11.3 Password Policy

**Files to Create:**
```
auth-service/src/main/java/com/platform/auth/
├── application/
│   ├── port/inbound/
│   │   ├── RegisterUseCase.java
│   │   ├── LoginUseCase.java
│   │   └── TokenRefreshUseCase.java
│   ├── port/outbound/
│   │   ├── UserRepository.java
│   │   ├── CredentialRepository.java
│   │   └── SessionRepository.java
│   └── service/
│       ├── auth/
│       │   ├── EmailPasswordLoginService.java
│       │   ├── RegistrationService.java
│       │   └── PasswordPolicyValidator.java
│       └── token/
│           ├── TokenIssuanceService.java
│           ├── KeyManagementService.java
│           └── JwtTokenGenerator.java
├── domain/
│   ├── model/
│   │   ├── User.java
│   │   ├── Credential.java
│   │   └── Session.java
│   ├── event/
│   │   ├── UserRegisteredEvent.java
│   │   └── UserLoginSuccessEvent.java
│   └── service/
│       ├── LoginAttemptTracker.java
│       ├── SessionManager.java
│       └── PasswordHasher.java        # Argon2id
├── adapter/
│   ├── inbound/rest/
│   │   ├── AuthController.java
│   │   └── dto/
│   │       ├── RegisterRequest.java / RegisterResponse.java
│   │       ├── LoginRequest.java / LoginResponse.java
│   │       └── TokenRefreshRequest.java / TokenRefreshResponse.java
│   └── outbound/
│       ├── persistence/
│       │   ├── JpaUserRepository.java
│       │   ├── JpaCredentialRepository.java
│       │   └── JpaSessionRepository.java
│       └── event/KafkaEventPublisher.java
├── AuthApplication.java
└── application.yml
```

**API Contracts (from DLD §7.1):**
- `POST /api/v1/auth/register` — Register new user
- `POST /api/v1/auth/login` — Login with email/password
- `POST /api/v1/auth/token/refresh` — Refresh access token

**Configuration (DLD §11.2, §11.3, §12):**
```yaml
jwt:
  access-token:
    expiry: 15
    issuer: https://auth.platform.com
    algorithm: RS256
  refresh-token:
    expiry: 30
    length: 64
password-policy:
  min-length: 12
  require-uppercase: true
  require-digit: true
  hash-algorithm: ARGON2ID
  argon2:
    memory: 65536
    iterations: 3
    parallelism: 4
```

**Error Handling:**
- InvalidCredentialsException (401)
- AccountLockedException (423)
- EmailAlreadyExistsException (409)
- TokenExpiredException (401)
- ValidationException (400)

**Logging:**
- Log successful logins at INFO with userId, method
- Log failed attempts at WARN with email, IP, reason
- Log registration at INFO

**Test Expectations:**
- Unit test all use case orchestrations (90% coverage)
- Integration test register → verify email → login flow with Testcontainers (DLD §13.2)
- Password policy validation (95% coverage)
- Argon2id hashing verification
- Rate limit check integration

**Dependencies:** Tasks 1.1, 1.2, 1.3, 1.4

---

#### Task 2.2: OAuth Integration (3 SP)

**Description:** Implement OAuth 2.0 login flow for Google, Facebook, and Instagram providers.

**DLD References:** §4.1.2 OAuth Flow Classes, §11.4 OAuth Token Encryption

**Files to Create/Modify:**
```
auth-service/src/main/java/com/platform/auth/
├── application/
│   ├── port/inbound/OAuthLoginUseCase.java
│   └── service/auth/OAuthLoginService.java
├── adapter/
│   ├── inbound/rest/
│   │   └── OAuthController.java
│   └── outbound/client/
│       ├── OAuthClientFactory.java
│       ├── GoogleOAuthClient.java
│       ├── FacebookOAuthClient.java
│       ├── InstagramOAuthClient.java
│       └── OAuthTokenEncryptor.java         # DLD §11.4 AES-256-GCM
```

**API Contracts:**
- `GET /api/v1/auth/oauth/{provider}` — Initiate OAuth flow (redirect to provider)
- `GET /api/v1/auth/oauth/{provider}/callback` — OAuth callback
- `POST /api/v1/auth/oauth/link` — Link OAuth to existing account

**Configuration:**
```yaml
oauth:
  google:
    client-id: ${GOOGLE_CLIENT_ID}
    client-secret: ${GOOGLE_CLIENT_SECRET}
    redirect-uri: https://auth.platform.com/api/v1/auth/oauth/google/callback
  facebook: ...
  instagram: ...
```

**Error Handling:**
- Resilience4j circuit breaker for external OAuth calls (DLD §9.2)
- Handle provider token expiry gracefully
- Log OAuth failures at WARN level with provider name

**Test Expectations:**
- Mock external OAuth provider responses
- Test OAuth token encryption/decryption (AES-256-GCM)
- Test account linking with existing email
- Circuit breaker integration tests

**Dependencies:** Task 2.1

---

#### Task 2.3: MFA Implementation (4 SP)

**Description:** Implement TOTP, SMS, and Email multi-factor authentication with backup codes.

**DLD References:** §4.1.3 MFA Module, §5.1 MFA Challenge Flow

**Files to Create:**
```
auth-service/src/main/java/com/platform/auth/
├── application/
│   ├── port/inbound/
│   │   ├── MfaChallengeUseCase.java
│   │   ├── SetupMfaUseCase.java
│   │   └── DisableMfaUseCase.java
│   └── service/auth/
│       ├── MfaService.java
│       ├── MfaChallengeService.java
│       └── MfaSetupService.java
├── domain/service/
│   ├── TOTPGenerator.java              # RFC 6238
│   ├── BackupCodeManager.java
│   └── MfaVerificationService.java
├── adapter/
│   ├── inbound/rest/
│   │   └── MfaController.java
│   └── outbound/client/
│       ├── SmsOtpSender.java           # Twilio/SNS adapter
│       └── EmailOtpSender.java         # SMTP/SES adapter
│   └── persistence/JpaMfaConfigRepository.java
```

**API Contracts:**
- `POST /api/v1/auth/mfa/setup` — Initialize MFA setup (returns TOTP secret + QR code URI)
- `POST /api/v1/auth/mfa/verify` — Verify MFA setup with code
- `POST /api/v1/auth/mfa/challenge` — Submit MFA challenge during login
- `POST /api/v1/auth/mfa/disable` — Disable MFA (requires current password)
- `GET /api/v1/auth/mfa/methods` — List enabled MFA methods

**Configuration:**
```yaml
mfa:
  totp:
    issuer: Platform
    digits: 6
    period: 30
  sms:
    provider: twilio
    from-number: ${SMS_FROM_NUMBER}
  email:
    from: security@platform.com
  backup-codes:
    count: 10
    length: 8
```

**Error Handling:**
- InvalidMfaCodeException (401)
- MfaRequiredException (428, with allowed methods)
- Rate limit MFA attempts separately from login

**Logging:**
- Log MFA setup at INFO with userId, method
- Log MFA failures at WARN with userId, method, IP
- Log backup code usage at WARN

**Test Expectations:**
- TOTP generation conforms to RFC 6238
- Backup codes are one-time-use
- SMS/Email sender adapters are mockable
- MFA challenge verification during login flow

**Dependencies:** Task 2.1

---

#### Task 2.4: Rate Limiting (2 SP)

**Description:** Implement token-bucket rate limiting for authentication endpoints per DLD §9.2.

**DLD References:** §9.2 Resilience Patterns (Rate Limiting), §12.1 Configuration

**Files to Create:**
```
auth-service/src/main/java/com/platform/auth/
├── application/service/auth/RateLimitingService.java
├── domain/service/LoginAttemptTracker.java
├── adapter/
│   ├── inbound/rest/filter/RateLimitingFilter.java
│   └── outbound/cache/RedisRateLimitCounter.java
```

**API Contracts:** No new endpoints; applied as a filter on auth endpoints.

**Rate Limiting Keys (DLD §9.2):**
```
Key: ratelimit:{tenantId}:{endpointGroup}:{windowStart}
Key: ratelimit:ip:{clientIp}:auth:{windowStart}
```

**Configuration (DLD §12.1):**
```yaml
app:
  rate-limiting:
    login:
      max-attempts: 5
      window-seconds: 60
    registration:
      max-attempts: 3
      window-seconds: 60
    password-reset:
      max-attempts: 3
      window-hours: 1
```

**Error Handling:** Return 429 with `Retry-After` header and RateLimitExceededException.

**Logging:** Log rate limit triggers at WARN with key, current count, limit.

**Test Expectations:**
- Verify token bucket replenishes correctly
- Verify separate counters per IP vs per tenant
- Verify Lua script atomicity for Redis counters
- Integration test with Redis Testcontainer

**Dependencies:** Task 1.3 (Redis cache), Task 2.1

---

#### Task 2.5: JWKS Endpoint (2 SP)

**Description:** Implement JWKS public key endpoint with 90-day rotation and 7-day overlap per ADR-004.

**DLD References:** ADR-004 (RS256 Key Rotation), §4.2 Token Module, §11.2 JWT Config

**Files to Create:**
```
auth-service/src/main/java/com/platform/auth/
├── application/service/token/
│   ├── KeyManagementService.java
│   └── KeyRotationScheduler.java
├── adapter/
│   ├── inbound/rest/JwksController.java
│   └── outbound/
│       ├── client/VaultKeyStore.java
│       └── cache/LocalKeyCache.java      # Caffeine cache
```

**API Contracts:**
- `GET /api/v1/auth/.well-known/jwks.json` — Returns JWKS key set
- `POST /api/v1/auth/keys/rotate` — Trigger manual rotation (admin only)

**Configuration (DLD §11.2):**
```yaml
jwt:
  key-rotation:
    interval: 90
    overlap: 7
```

**Error Handling:**
- Handle Vault unavailability gracefully (serve cached keys)
- Log key rotation events at INFO
- Alert on key generation failure

**Test Expectations:**
- Verify JWKS endpoint returns valid RSA public keys
- Verify old key remains valid during overlap period
- Verify new key is used for token issuance after rotation
- Unit test KeyManagementService with mock Vault

**Dependencies:** Task 1.1 (JWT), Task 1.3 (Caffeine cache)

---

### Phase 3: User Service Implementation (Weeks 3-4, 7 SP)

---

#### Task 3.1: User Profile Management (4 SP)

**Description:** Implement user CRUD operations, profile management, and GDPR compliance (data export/deletion).

**DLD References:** §4.0 Service Boundaries, §1.3 Service Coordination

**Files to Create:**
```
user-service/src/main/java/com/platform/user/
├── application/
│   ├── port/inbound/
│   │   ├── GetUserProfileUseCase.java
│   │   ├── UpdateUserProfileUseCase.java
│   │   ├── DeleteUserUseCase.java
│   │   ├── GdprDataExportUseCase.java
│   │   └── GdprDataDeletionUseCase.java
│   └── service/
│       ├── UserProfileService.java
│       ├── GdprService.java
│       └── UserSearchService.java
├── domain/model/
│   ├── User.java
│   ├── UserProfile.java
│   └── GdprExportRequest.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── UserController.java
│   │   └── dto/UserProfileDto.java
│   └── outbound/
│       ├── persistence/JpaUserRepository.java
│       └── event/UserEventPublisher.java
├── UserApplication.java
└── application.yml
```

**API Contracts:**
- `GET /api/v1/users/me` — Get current user profile
- `PUT /api/v1/users/me` — Update profile
- `DELETE /api/v1/users/me` — Self-delete (GDPR)
- `GET /api/v1/users/{userId}` — Get user by ID (admin)
- `GET /api/v1/users` — List/search users (admin, paginated)
- `GET /api/v1/users/me/gdpr/export` — GDPR data export
- `POST /api/v1/users/me/gdpr/delete` — GDPR account deletion

**Configuration:**
```yaml
app:
  gdpr:
    export-format: JSON
    deletion-grace-period-hours: 48
```

**Error Handling:**
- UserNotFoundException (404)
- DeleteProtectedAccountException (409) — can't delete last admin
- Validate email uniqueness on update

**Logging:**
- Log GDPR export at INFO with userId
- Log account deletion at INFO with userId, reason
- Log profile updates at INFO with changed fields

**Test Expectations:**
- Full CRUD integration tests with Testcontainers
- GDPR export produces valid JSON with all user data
- GDPR deletion cascades to auth, tenant memberships
- Pagination and search work correctly

**Dependencies:** Tasks 1.1, 1.2, 1.4

---

#### Task 3.2: User Invitations (3 SP)

**Description:** Implement user invitation system with token-based invitation flow.

**DLD References:** §4.3 Tenant-User Membership, §12.1 Configuration

**Files to Create:**
```
user-service/src/main/java/com/platform/user/
├── application/
│   ├── port/inbound/
│   │   ├── SendInvitationUseCase.java
│   │   ├── AcceptInvitationUseCase.java
│   │   └── CancelInvitationUseCase.java
│   └── service/InvitationService.java
├── domain/
│   ├── model/Invitation.java
│   └── service/InvitationTokenGenerator.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── InvitationController.java
│   │   └── dto/InvitationRequest.java / InvitationResponse.java
│   └── outbound/
│       ├── persistence/JpaInvitationRepository.java
│       └── client/EmailClient.java
```

**API Contracts:**
- `POST /api/v1/invitations` — Send invitation (requires TENANT_ADMIN)
- `GET /api/v1/invitations/{token}/verify` — Verify invitation token
- `POST /api/v1/invitations/{token}/accept` — Accept invitation
- `DELETE /api/v1/invitations/{id}` — Cancel invitation

**Configuration:**
```yaml
app:
  invitation:
    expiry-hours: 168  # 7 days
```

**Error Handling:**
- InvitationExpiredException (410)
- InvitationAlreadyUsedException (409)
- Log invitation sends at INFO, accepts at INFO, failures at WARN

**Test Expectations:**
- Token uniqueness and expiry verification
- Invitation acceptance creates TenantUser membership
- Duplicate accept is idempotent

**Dependencies:** Task 3.1

---

### Phase 4: Tenant Service Implementation (Weeks 4-5, 11 SP)

---

#### Task 4.1: Tenant Lifecycle (4 SP)

**Description:** Implement tenant CRUD, suspension, reactivation, and plan management.

**DLD References:** §4.3 Tenant Module, §5.4 Tenant Provisioning Flow, §6.1 tenants table

**Files to Create:**
```
tenant-service/src/main/java/com/platform/tenant/
├── application/
│   ├── port/inbound/
│   │   ├── CreateTenantUseCase.java
│   │   ├── SuspendTenantUseCase.java
│   │   └── ReactivateTenantUseCase.java
│   └── service/
│       ├── TenantLifecycleService.java
│       ├── TenantValidationService.java
│       └── TenantPlanService.java
├── domain/
│   ├── model/Tenant.java
│   └── event/
│       ├── TenantCreatedEvent.java
│       ├── TenantSuspendedEvent.java
│       └── TenantPlanChangedEvent.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── TenantController.java
│   │   └── dto/TenantRequest.java / TenantResponse.java
│   └── outbound/
│       ├── persistence/JpaTenantRepository.java
│       └── event/TenantEventPublisher.java
├── TenantApplication.java
└── application.yml
```

**API Contracts:**
- `POST /api/v1/tenants` — Create tenant (PLATFORM_ADMIN)
- `GET /api/v1/tenants` — List tenants (paginated, filterable)
- `GET /api/v1/tenants/{tenantId}` — Get tenant details
- `PATCH /api/v1/tenants/{tenantId}` — Update tenant
- `POST /api/v1/tenants/{tenantId}/suspend` — Suspend tenant
- `POST /api/v1/tenants/{tenantId}/reactivate` — Reactivate tenant
- `DELETE /api/v1/tenants/{tenantId}` — Delete tenant (soft)

**Error Handling:**
- SlugAlreadyExistsException (409)
- TenantNotFoundException (404)
- TenantSuspendedException (403) for operations on suspended tenants
- Log tenant creation at INFO, suspension at WARN

**Test Expectations:**
- Full lifecycle CRUD integration tests
- Slug uniqueness validation
- Tenant suspension cascades (check RLS isolation)
- Soft delete with `deleted_at` filter

**Dependencies:** Tasks 1.1, 1.2, 1.4

---

#### Task 4.2: Tenant Settings & Applications (3 SP)

**Description:** Implement tenant-level settings and application subscriptions.

**DLD References:** §6.2 Supporting Tables (tenant_settings, tenant_applications), §4.3 Tenant Module

**Files to Create:**
```
tenant-service/src/main/java/com/platform/tenant/
├── application/
│   ├── port/inbound/
│   │   ├── TenantSettingsUseCase.java
│   │   └── TenantApplicationUseCase.java
│   └── service/
│       ├── TenantSettingsService.java
│       └── TenantApplicationService.java
├── domain/model/
│   ├── TenantSetting.java
│   └── TenantApplication.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── TenantSettingsController.java
│   │   ├── TenantApplicationController.java
│   │   └── dto/
│   └── outbound/persistence/
│       ├── JpaTenantSettingsRepository.java
│       └── JpaTenantApplicationRepository.java
```

**API Contracts:**
- `GET /api/v1/tenants/{tenantId}/settings` — Get all settings
- `PUT /api/v1/tenants/{tenantId}/settings/{key}` — Update setting
- `GET /api/v1/tenants/{tenantId}/applications` — List subscribed apps
- `POST /api/v1/tenants/{tenantId}/applications/{appId}/enable` — Enable app
- `POST /api/v1/tenants/{tenantId}/applications/{appId}/disable` — Disable app

**Test Expectations:**
- Settings follow category enum (SECURITY, BRANDING, etc.)
- Application enable/disable creates audit log entry
- Verify RLS policies on both tables

**Dependencies:** Task 4.1

---

#### Task 4.3: Tenant-User Membership (4 SP)

**Description:** Implement tenant-user membership management with role assignments.

**DLD References:** §4.3 Tenant Module, §6.1 tenant_users table

**Files to Create:**
```
tenant-service/src/main/java/com/platform/tenant/
├── application/
│   ├── port/inbound/
│   │   ├── AddTenantMemberUseCase.java
│   │   ├── RemoveTenantMemberUseCase.java
│   │   └── UpdateMembershipUseCase.java
│   └── service/TenantUserManagementService.java
├── domain/model/TenantUser.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── TenantMembershipController.java
│   │   └── dto/MemberRequest.java / MemberResponse.java
│   └── outbound/
│       ├── persistence/JpaTenantUserRepository.java
│       └── client/RbacServiceClient.java      # HTTP client to RBAC service
```

**API Contracts:**
- `GET /api/v1/tenants/{tenantId}/members` — List members
- `POST /api/v1/tenants/{tenantId}/members` — Add member
- `PATCH /api/v1/tenants/{tenantId}/members/{userId}` — Update role
- `DELETE /api/v1/tenants/{tenantId}/members/{userId}` — Remove member
- `GET /api/v1/tenants/{tenantId}/members/{userId}/roles` — Get member roles

**Error Handling:**
- TenantUserAlreadyExistsException (409)
- LastOwnerRemovalException (400)
- Log membership changes at INFO

**Test Expectations:**
- Verify last owner can't be removed
- Verify role enum validation (OWNER, ADMIN, MEMBER, GUEST)
- Integration with RBAC service for role assignments

**Dependencies:** Tasks 4.1, 3.1 (for user lookup)

---

### Phase 5: RBAC Service Implementation (Weeks 5-6, 12 SP)

---

#### Task 5.1: Role & Permission Management (4 SP)

**Description:** Implement role CRUD, permission definitions, and role-permission assignments.

**DLD References:** §4.4 Role & Permission Module, §6.1 roles/permissions/role_permissions tables

**Files to Create:**
```
rbac-service/src/main/java/com/platform/rbac/
├── application/
│   ├── port/inbound/
│   │   ├── CreateRoleUseCase.java
│   │   ├── UpdateRoleUseCase.java
│   │   ├── DeleteRoleUseCase.java
│   │   ├── AssignPermissionUseCase.java
│   │   └── RevokePermissionUseCase.java
│   └── service/role/
│       ├── RoleManagementService.java
│       ├── PermissionManagementService.java
│       └── RoleHierarchyResolver.java
├── domain/
│   ├── model/
│   │   ├── Role.java
│   │   ├── Permission.java
│   │   └── RolePermission.java
│   └── event/
│       ├── RoleAssignedEvent.java
│       └── PermissionsChangedEvent.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── RoleController.java
│   │   ├── PermissionController.java
│   │   └── dto/
│   └── outbound/persistence/
│       ├── JpaRoleRepository.java
│       ├── JpaPermissionRepository.java
│       └── JpaRolePermissionRepository.java
├── RbacApplication.java
└── application.yml
```

**API Contracts:**
- `GET /api/v1/roles` — List roles (filterable by tenant/system)
- `POST /api/v1/roles` — Create role
- `PUT /api/v1/roles/{roleId}` — Update role
- `DELETE /api/v1/roles/{roleId}` — Delete role
- `GET /api/v1/permissions` — List all permissions
- `POST /api/v1/roles/{roleId}/permissions` — Assign permissions to role
- `DELETE /api/v1/roles/{roleId}/permissions/{permId}` — Revoke permission

**Error Handling:**
- SystemRoleDeletionException (400) — can't delete system roles
- LastAdminRoleException (400) — must keep at least one admin role per tenant
- Log role CRUD at INFO

**Test Expectations:**
- System roles are read-only for tenant admins
- Permission scope validation (SYSTEM, TENANT, APPLICATION)
- Role hierarchy resolution (inheritance)
- Audit log for role changes

**Dependencies:** Tasks 1.1, 1.2, 1.4

---

#### Task 5.2: Permission Check Service (5 SP)

**Description:** Implement highly-performant permission check with two-level caching.

**DLD References:** §4.4 PermissionCheckService, §5.2 Permission Check Flow, §8 Cache Strategy

**Files to Create:**
```
rbac-service/src/main/java/com/platform/rbac/
├── application/
│   ├── port/inbound/CheckPermissionUseCase.java
│   └── service/role/
│       ├── PermissionCheckService.java
│       └── UserRoleAssignmentService.java
├── domain/service/
│   ├── EffectivePermissionResolver.java
│   ├── DirectRoleProvider.java
│   ├── GroupRoleProvider.java
│   └── RoleHierarchyProvider.java
├── adapter/
│   ├── inbound/rest/PermissionCheckController.java
│   └── outbound/
│       ├── cache/PermissionCacheAdapter.java      # Caffeine + Redis (DLD §8)
│       └── persistence/
│           ├── JpaUserRoleAssignmentRepository.java
│           └── JpaGroupRoleAssignmentRepository.java
```

**API Contracts:**
- `POST /api/v1/permissions/check` — Check single permission (DLD §5.2)
  ```json
  { "userId": "...", "tenantId": "...", "resource": "tenant.settings", "action": "write" }
  ```
- `POST /api/v1/permissions/check-batch` — Check multiple permissions at once
- `GET /api/v1/users/{userId}/permissions?tenantId={tenantId}` — Get all effective permissions

**Cache Strategy (DLD §8):**
- Local Caffeine: `user-permissions:{uid}:{tid}` — TTL 60s, max 5000 entries
- Redis: `user-permissions:{uid}:{tid}` — TTL 60s, LRU eviction
- Cache-aside pattern: check local → check Redis → compute from DB → populate

**Performance Targets:**
- P50 < 3ms, P99 < 10ms for cached checks
- P50 < 20ms, P99 < 50ms for uncached checks

**Error Handling:**
- Return `{ allowed: false }` with 200 on denied (do not throw 403)
- Cache failures should degrade to DB query (not block)
- Log permission check failures at WARN with userId, resource, action

**Test Expectations:**
- Full cache hit/miss integration tests
- Effective permission resolution across direct roles + groups + hierarchy
- Performance benchmark hitting sub-10ms target
- Cache invalidation via Kafka listener (permissions.changed)

**Dependencies:** Tasks 5.1, 1.3 (caching), 1.4 (events)

---

#### Task 5.3: Group Management (3 SP)

**Description:** Implement group CRUD for organizing users and assigning roles at group level.

**DLD References:** §6.1 tenant_groups, group_members tables; §4.4 RoleManagementService

**Files to Create:**
```
rbac-service/src/main/java/com/platform/rbac/
├── application/
│   ├── port/inbound/
│   │   ├── CreateGroupUseCase.java
│   │   ├── AddGroupMemberUseCase.java
│   │   └── AssignGroupRoleUseCase.java
│   └── service/role/
│       ├── GroupManagementService.java
│       └── GroupRoleService.java
├── domain/model/
│   ├── TenantGroup.java
│   └── GroupMember.java
├── adapter/
│   ├── inbound/rest/
│   │   ├── GroupController.java
│   │   └── dto/
│   └── outbound/persistence/
│       ├── JpaGroupRepository.java
│       └── JpaGroupMemberRepository.java
```

**API Contracts:**
- `GET /api/v1/groups?tenantId={tenantId}` — List groups
- `POST /api/v1/groups` — Create group
- `PUT /api/v1/groups/{groupId}` — Update group
- `DELETE /api/v1/groups/{groupId}` — Delete group
- `GET /api/v1/groups/{groupId}/members` — List members
- `POST /api/v1/groups/{groupId}/members` — Add member
- `DELETE /api/v1/groups/{groupId}/members/{memberId}` — Remove member
- `POST /api/v1/groups/{groupId}/roles` — Assign role to group
- `DELETE /api/v1/groups/{groupId}/roles/{roleId}` — Revoke role from group

**Error Handling:**
- Circular group hierarchy detection (parent_group_id cycle)
- Log group changes at INFO with tenant context

**Test Expectations:**
- Group hierarchy (parent-child) resolution
- Member adds/removes propagate to permission checks
- Group role assignments factor into EffectivePermissionResolver

**Dependencies:** Task 5.1

---

### Phase 6: Integration & Event Handling (Weeks 6-7, 9 SP)

---

#### Task 6.1: User Registration Flow (3 SP)

**Description:** Implement cross-service user registration flow: auth publishes user.registered → tenant creates membership → rbac assigns default roles.

**DLD References:** §1.3 Service Coordination, §5.1 Registration Sequence

**Files to Modify (all services):**
```
auth-service:  EventPublisher publishes UserRegisteredEvent
user-service:  Kafka consumer for user.registered → creates UserProfile
rbac-service:  Kafka consumer for user.registered → assigns default roles
```

**Event Contract (CloudEvents v1.0):**
```json
{
  "specversion": "1.0",
  "type": "user.registered",
  "source": "/auth-service",
  "id": "uuid",
  "time": "2026-06-23T10:00:00Z",
  "subject": "user/{userId}",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "tenantId": "uuid"     // null if registered without tenant invite
  }
}
```

**Files to Create/Modify:**
```
auth-service/
└── adapter/outbound/event/UserEventPublisher.java    # Publish user.registered

user-service/
├── adapter/inbound/event/
│   ├── UserRegisteredConsumer.java                   # Consume user.registered
│   └── UserLifecycleEventHandler.java                # Create profile, publish user.profile.updated

rbac-service/
├── adapter/inbound/event/
│   ├── UserRegisteredConsumer.java                   # Consume user.registered
│   └── DefaultRoleAssignmentHandler.java             # Assign default roles
```

**Configuration:** Kafka topics in consumer config (see Task 1.4)

**Error Handling:**
- If user-service fails to create profile, publish to DLQ and alert
- If RBAC assignment fails, the user is created but has no permissions (graceful degradation)
- Use @Transactional to ensure event consumption + DB write are atomic

**Test Expectations:**
- Integration test: register user → verify profile created in user-service → verify default roles assigned
- Dead-letter handling for poison messages
- Verify idempotent event processing

**Dependencies:** Tasks 2.1, 3.1, 5.1

---

#### Task 6.2: Tenant Suspension Flow (3 SP)

**Description:** Implement cross-service tenant suspension: tenant.suspended → auth revokes sessions → user marks memberships.

**DLD References:** §1.3 Service Coordination

**Event Contract:**
```json
{
  "specversion": "1.0",
  "type": "tenant.suspended",
  "source": "/tenant-service",
  "id": "uuid",
  "time": "...",
  "subject": "tenant/{tenantId}",
  "data": { "tenantId": "uuid", "reason": "payment_failed" }
}
```

**Files to Create/Modify:**
```
tenant-service/
└── adapter/outbound/event/TenantEventPublisher.java     # Publish tenant.suspended

auth-service/
└── adapter/inbound/event/
    ├── TenantSuspendedConsumer.java                     # Revoke all sessions for tenant
    └── SessionRevocationHandler.java                    # Add tokens to blacklist

user-service/
└── adapter/inbound/event/
    ├── TenantSuspendedConsumer.java                     # Mark memberships as SUSPENDED
    └── MembershipStatusHandler.java
```

**Error Handling:**
- Session revocation retries with exponential backoff
- Partial failure: log and alert if some sessions fail to revoke
- Memberships marked SUSPENDED prevent login for that tenant

**Test Expectations:**
- Integration test: suspend tenant → verify sessions revoked → verify memberships suspended
- Verify blacklisted tokens reject API calls

**Dependencies:** Tasks 4.1, 2.1, 3.1

---

#### Task 6.3: Permission Check Integration (3 SP)

**Description:** Integrate permission check as a REST API with full caching and instrumentation.

**DLD References:** §5.2 Permission Check Flow, §10.2 Key Metrics

**Files to Create/Modify:** See Task 5.2 (already implements the controller)

**Additional Implementation:**
- Add permission check client library in platform-common:
  ```
  platform-common/src/main/java/com/platform/common/client/
  └── PermissionCheckClient.java     # HTTP client wrapper for RBAC service
  ```

- Integrate permission check into API Gateway as a filter (optional, deferred)
- Add Micrometer timers (DLD §10.2):
  - `permission_check_duration` — histogram with result tag
  - `cache_hit_ratio` — gauge per cache name

**Test Expectations:**
- Client library unit tests with mock RBAC service
- Performance test hitting sub-10ms target (Gatling per DLD §13.4)
- Micrometer metrics exposed at /actuator/metrics

**Dependencies:** Task 5.2, 1.1 (client library)

---

### Phase 7: Infrastructure & Deployment (Week 8, 7 SP)

---

#### Task 7.1: Docker & K8s Setup (3 SP)

**Description:** Create Dockerfiles, docker-compose for local development, and Kubernetes manifests for all services.

**DLD References:** §1.4 Repository Structure

**Files to Create:**
```
Dockerfile                              # Multi-stage build for all services
docker-compose.yml                      # All services + PostgreSQL + Redis + Kafka + Vault
k8s/
├── namespace.yaml                      # utms namespace
├── configmap.yaml                      # Shared config
├── secrets.yaml                        # Sealed secrets template
├── auth-service/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml                        # Horizontal Pod Autoscaler
│   └── pdb.yaml                        # Pod Disruption Budget
├── user-service/                       # Same structure
├── tenant-service/
├── rbac-service/
├── ingress.yaml                        # Kong/Istio ingress
└── monitoring/
    ├── prometheus-config.yaml
    └── grafana-dashboards/
```

**docker-compose.yml includes:**
- auth-service (:8081), user-service (:8082), tenant-service (:8083), rbac-service (:8084)
- PostgreSQL 16 (single instance with 4 schemas)
- Redis 7 cluster (3 nodes for dev)
- Kafka + Zookeeper (single node for dev)
- HashiCorp Vault (dev mode)
- Jaeger (tracing)

**Test Expectations:**
- `docker-compose up` starts all services
- Health checks pass for all services
- K8s manifests pass `kubectl apply --dry-run=client`

**Dependencies:** All Phase 2-5 tasks

---

#### Task 7.2: API Gateway (2 SP)

**Description:** Set up Kong/Istio as API Gateway with OAuth 2.0 Proxy for external access.

**DLD References:** §1.1 High-Level Architecture

**Files to Create:**
```
k8s/
├── kong/
│   ├── kong-config.yaml                # Kong declarative config
│   ├── oauth2-proxy-deployment.yaml
│   └── routes.yaml                     # Service routing rules
└── istio/
    ├── gateway.yaml
    └── virtual-service.yaml
```

**Routing Rules:**
- `/api/v1/auth/*` → auth-service:8081
- `/api/v1/users/*` → user-service:8082
- `/api/v1/tenants/*` → tenant-service:8083
- `/api/v1/permissions/*` → rbac-service:8084
- `/actuator/health` → all services (for k8s probes)

**Test Expectations:**
- All routes resolve correctly
- OAuth 2.0 Proxy validates tokens before forwarding

**Dependencies:** Task 7.1

---

#### Task 7.3: Vault Integration (2 SP)

**Description:** Set up HashiCorp Vault for secure key management, OAuth token encryption keys, and database credentials.

**DLD References:** §1.1 Architecture (Vault), §11.4 OAuth Token Encryption, §4.2 KeyManagementService

**Files to Create:**
```
k8s/vault/
├── vault-deployment.yaml
├── vault-config.hcl
├── policy/
│   ├── auth-service-policy.hcl
│   ├── user-service-policy.hcl
│   └── rbac-service-policy.hcl
└── init-script.sh                      # Vault initialization + key setup

platform-common/src/main/java/com/platform/common/vault/
├── VaultConfig.java
└── VaultKeyStore.java                  # Implements KeyStore interface
```

**Secrets Stored in Vault:**
- JWT signing keys (RSA 2048-bit private keys)
- OAuth client secrets (encrypted)
- Database credentials (dynamic DB creds if possible)
- Encryption keys for OAuth tokens at rest

**Test Expectations:**
- Vault unseal and authentication works
- Key rotation creates new version without losing old keys
- Application starts with Vault unavailable (graceful degradation to cached keys)

**Dependencies:** Task 7.1

---

## Dependency Graph

### Service Dependencies
- **Auth Service**: Independent (Phase 2)
- **User Service**: Depends on Auth service for user reference (Phase 3, after Phase 2)
- **Tenant Service**: Depends on Auth service for tenant reference (Phase 4, after Phase 2)
- **RBAC Service**: Depends on Auth service + Tenant service (Phase 5, after Phase 2-4)

### Implementation Order
```
Week 1:    Phase 1 (Core Infrastructure)
Weeks 2-3: Phase 2 (Auth Service) — Independent
Weeks 3-4: Phase 3 (User Service) — After Auth
Weeks 4-5: Phase 4 (Tenant Service) — After Auth
Weeks 5-6: Phase 5 (RBAC Service) — After Auth + Tenant
Weeks 6-7: Phase 6 (Integration & Events)
Week 8:    Phase 7 (Infrastructure & Deployment)
```

### Critical Path
1.1 → 1.2 → 2.1 → 2.3 → 2.5
1.1 → 1.3 → 1.4 → 2.1
1.1 → 1.2 → 1.3 → 1.4 → 3.1 → 3.2
1.1 → 1.2 → 1.4 → 4.1 → 4.2 → 4.3
1.1 → 1.2 → 1.4 → 5.1 → 5.2 → 5.3
All → 6.1 → 6.2 → 6.3
All → 7.1 → 7.2 → 7.3

---

## Risk Mitigation

### High Priority Risks
1. **Distributed Transaction Complexity**: Use eventual consistency via Kafka for cross-service operations; idempotent consumers
2. **Security Vulnerabilities**: Implement comprehensive security testing for JWT, OAuth, and RLS
3. **Performance Issues**: Implement caching and optimize database queries; P99 targets defined
4. **Deployment Complexity**: Use Flyway expand-contract pattern (ADR-005) for zero-downtime deployments

### Medium Priority Risks
1. **Event Ordering**: Ensure proper event ordering in Kafka; use partition keys
2. **Monitoring & Observability**: Implement comprehensive monitoring (DLD §10)
3. **Error Handling**: Implement robust error handling and retry mechanisms

### Low Priority Risks
1. **Key Rotation**: Implement automated JWT key rotation (ADR-004)
2. **Multi-tenancy**: Ensure proper tenant isolation via RLS (ADR-002)
3. **Scalability**: Design for horizontal scaling from day 1

---

## Success Metrics

### Technical Metrics
- Authentication latency < 100ms (P99)
- Permission check latency < 10ms (P99 cached), < 50ms (uncached)
- Event processing < 50ms
- Database query performance optimized

### Quality Metrics
- Test coverage > 80%
- Security scan passes
- Performance benchmarks met
- Documentation complete

### Business Metrics
- User registration time < 5 seconds
- Tenant provisioning time < 2 minutes
- System availability > 99.9%

---

## Next Steps

1. Create child issues for each phase lead task
2. Set up blockedByIssueIds dependencies between tasks
3. Assign Phase 1 to Backend Engineer to begin
4. Schedule Phase 2-5 in parallel where dependencies allow
