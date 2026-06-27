# =============================================================================
# ɳTasks Backend — Makefile
#
# Quick commands for managing the backend stack.
#
# nSelf-First: backend starts via nself CLI, not docker compose directly.
#   make up        — alias for `nself start` (nSelf-First)
#   make down      — alias for `nself stop`
#   make build     — alias for `nself build`
#
# Legacy docker compose commands are preserved for reference apps forking
# this codebase without the nSelf CLI.
# =============================================================================

NSELF = nself
COMPOSE = docker compose
COMPOSE_STAGING = docker compose -f docker-compose.yml -f docker-compose.staging.yml
COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.production.yml

# Default values (override via .env.dev)
POSTGRES_USER ?= postgres
POSTGRES_DB ?= ntask
HASURA_ADMIN_SECRET ?= nself-admin-secret

# ---------------------------------------------------------------------------
# Local Development — nSelf-First (preferred)
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build the nSelf stack (generates docker-compose.yml + nginx + SSL)
	$(NSELF) build

.PHONY: up
up: ## Start the backend stack (nSelf-First; wraps `nself start`)
	$(NSELF) start

.PHONY: down
down: ## Stop all services (wraps `nself stop`)
	$(NSELF) stop

.PHONY: restart
restart: down up ## Restart all services

.PHONY: logs
logs: ## View logs from all services
	$(COMPOSE) logs -f

.PHONY: logs-hasura
logs-hasura: ## View Hasura logs only
	$(COMPOSE) logs -f graphql-engine

.PHONY: logs-auth
logs-auth: ## View auth service logs only
	$(COMPOSE) logs -f auth

.PHONY: status
status: ## Show service status
	$(COMPOSE) ps

.PHONY: health
health: ## Check health of all services
	@echo "--- PostgreSQL ---"
	@docker compose exec postgres pg_isready -U $(POSTGRES_USER) 2>/dev/null || echo "DOWN"
	@echo "--- Hasura ---"
	@curl -sf http://localhost:8080/healthz && echo " OK" || echo "DOWN"
	@echo "--- Auth ---"
	@curl -sf http://localhost:4000/healthz && echo " OK" || echo "DOWN"
	@echo "--- Storage ---"
	@curl -sf http://localhost:8484/healthz && echo " OK" || echo "DOWN"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

.PHONY: psql
psql: ## Connect to PostgreSQL shell
	docker compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

.PHONY: backup
backup: ## Create a database backup
	@mkdir -p ./backups
	docker compose exec postgres pg_dump -U $(POSTGRES_USER) $(POSTGRES_DB) > ./backups/backup-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backup created in ./backups/"

.PHONY: restore
restore: ## Restore from most recent backup (usage: make restore FILE=backups/backup-xxx.sql)
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backups/backup-xxx.sql"; exit 1; fi
	docker compose exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $(FILE)

.PHONY: backup-remote
backup-remote: ## Stream pg_dump to Cloudflare R2 (requires BACKUP_* env vars from .env.dev)
	@echo "Starting remote backup to R2..."
	@bash scripts/backup-remote.sh

.PHONY: restore-remote
restore-remote: ## Restore from R2 backup (usage: FILE=ntask/backup-xxx.sql.gz make restore-remote)
	@if [ -z "$(FILE)" ]; then echo "Usage: FILE=ntask/backup-xxx.sql.gz make restore-remote"; exit 1; fi
	@bash scripts/restore-remote.sh

.PHONY: list-backups
list-backups: ## List available R2 backups (most recent 20)
	@bash scripts/list-backups.sh

.PHONY: dr-test
dr-test: ## Disaster recovery drill: restore latest backup to scratch DB and verify (non-destructive)
	@echo "--- DR Test: Restore to scratch database ---"
	@echo "This test downloads the latest backup from R2 and restores it to DR_DATABASE_URL."
	@echo "It does NOT touch the production database."
	@if [ -z "$(DR_DATABASE_URL)" ]; then \
	  echo "DR_DATABASE_URL not set. Using local scratch: postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/ntask_dr_test"; \
	  export DR_DATABASE_URL="postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/ntask_dr_test"; \
	fi
	@LATEST=$$(bash scripts/list-backups.sh 2>/dev/null | grep -v '^\[' | head -1 | awk '{print $$NF}'); \
	 if [ -z "$$LATEST" ]; then echo "No backups found in R2. Run make backup-remote first."; exit 1; fi; \
	 echo "Restoring: $$LATEST"; \
	 DATABASE_URL="$${DR_DATABASE_URL:-postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5432/ntask_dr_test}" \
	 FILE="${BACKUP_S3_PREFIX:-ntask}/$$LATEST" bash scripts/restore-remote.sh; \
	 echo "--- DR Test complete. Verify row counts manually with: make psql ---"

# ---------------------------------------------------------------------------
# Hasura
# ---------------------------------------------------------------------------

.PHONY: console
console: ## Open Hasura Console (requires hasura-cli)
	cd hasura && hasura console --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: migrate
migrate: ## Apply all pending Hasura migrations
	cd hasura && hasura migrate apply --database-name default --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: migrate-status
migrate-status: ## Show migration status
	cd hasura && hasura migrate status --database-name default --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: metadata-apply
metadata-apply: ## Apply Hasura metadata
	cd hasura && hasura metadata apply --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: metadata-export
metadata-export: ## Export current Hasura metadata
	cd hasura && hasura metadata export --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: seed
seed: ## Seed the database (runs from frontend)
	cd .. && npm run db:seed

# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------

.PHONY: staging-up
staging-up: ## Start staging stack
	$(COMPOSE_STAGING) up -d

.PHONY: staging-down
staging-down: ## Stop staging stack
	$(COMPOSE_STAGING) down

.PHONY: staging-logs
staging-logs: ## View staging logs
	$(COMPOSE_STAGING) logs -f

# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------

.PHONY: prod-up
prod-up: ## Start production stack
	$(COMPOSE_PROD) up -d

.PHONY: prod-down
prod-down: ## Stop production stack
	$(COMPOSE_PROD) down

.PHONY: prod-logs
prod-logs: ## View production logs
	$(COMPOSE_PROD) logs -f

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove all containers and volumes (DESTRUCTIVE - deletes all data)
	@echo "WARNING: This will delete ALL data including the database!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	$(COMPOSE) --profile dev down -v
	@echo "All data removed."

# ---------------------------------------------------------------------------
# Bootstrap / Upgrade / Demo
# ---------------------------------------------------------------------------

.PHONY: bootstrap
bootstrap: ## One-command local dev setup (idempotent; safe to re-run)
	@bash scripts/bootstrap.sh

.PHONY: upgrade
upgrade: ## Upgrade ntask: backup -> pull -> rebuild -> migrate -> health
	@bash scripts/upgrade.sh

.PHONY: migrate
migrate: ## Apply pending Hasura migrations and metadata
	cd hasura && hasura migrate apply --database-name default \
	  --admin-secret $(HASURA_ADMIN_SECRET)
	cd hasura && hasura metadata apply --admin-secret $(HASURA_ADMIN_SECRET)

.PHONY: demo-seed
demo-seed: ## Seed demo data (requires DEMO_SEED=1 to prevent accidents)
	@if [ "$(DEMO_SEED)" != "1" ]; then \
	  echo "Error: Set DEMO_SEED=1 to confirm. Usage: DEMO_SEED=1 make demo-seed"; \
	  exit 1; \
	fi
	@echo "Seeding demo data..."
	docker compose exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) \
	  < postgres/seed/demo-seed.sql
	@echo "Demo data loaded."
	@echo "  Login: demo@example.com / DemoPass123!"
	@echo "  (Change this password before using in production)"

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run the backend smoke-test suite (full up, health, CRUD, teardown)
	./test/smoke.sh

.PHONY: test-keep-up
test-keep-up: ## Run smoke tests but leave the stack running on success
	SMOKE_KEEP_UP=1 ./test/smoke.sh

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
