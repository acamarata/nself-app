# =============================================================================
# ɳTasks repo-level Makefile
#
# Thin wrapper over backend/Makefile + apps/mobile (React Native/Expo).
#
# nSelf-First: `make up` delegates to `nself start` via backend/Makefile.
# Run `make build` once before first `make up` (generates docker-compose.yml).
# =============================================================================

BACKEND    := backend
APP_MOBILE := apps/mobile

# ---------------------------------------------------------------------------
# Backend — nSelf-First
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build the nSelf backend stack (run once before first `make up`)
	$(MAKE) -C $(BACKEND) build

.PHONY: up
up: ## Start the backend stack via nself start (nSelf-First)
	$(MAKE) -C $(BACKEND) up

.PHONY: down
down: ## Stop the backend stack via nself stop
	$(MAKE) -C $(BACKEND) down

.PHONY: restart
restart: ## Restart the backend stack
	$(MAKE) -C $(BACKEND) restart

.PHONY: logs
logs: ## Tail backend logs
	$(MAKE) -C $(BACKEND) logs

.PHONY: status
status: ## Show backend service status
	$(MAKE) -C $(BACKEND) status

.PHONY: health
health: ## Run backend health checks (Hasura, Auth, Storage)
	$(MAKE) -C $(BACKEND) health

.PHONY: test
test: ## Run the backend smoke-test suite
	$(MAKE) -C $(BACKEND) test

# ---------------------------------------------------------------------------
# Mobile — React Native / Expo (apps/mobile)
# ---------------------------------------------------------------------------

.PHONY: mobile-install
mobile-install: ## Install mobile app dependencies (pnpm install)
	cd $(APP_MOBILE) && pnpm install

.PHONY: mobile-start
mobile-start: ## Start Expo dev server (scan QR with Expo Go)
	cd $(APP_MOBILE) && pnpm start

.PHONY: mobile-ios
mobile-ios: ## Run mobile app on iOS simulator
	cd $(APP_MOBILE) && pnpm ios

.PHONY: mobile-android
mobile-android: ## Run mobile app on Android emulator
	cd $(APP_MOBILE) && pnpm android

.PHONY: mobile-test
mobile-test: ## Run mobile unit tests
	cd $(APP_MOBILE) && pnpm test

.PHONY: mobile-lint
mobile-lint: ## Run mobile linter
	cd $(APP_MOBILE) && pnpm lint

.PHONY: mobile-typecheck
mobile-typecheck: ## Run TypeScript type check on mobile app
	cd $(APP_MOBILE) && pnpm typecheck

.PHONY: mobile-ci-local
mobile-ci-local: ## Run the same gate CI runs for apps/mobile/ (lint + typecheck + test)
	@echo "==> [mobile-ci-local] lint"
	cd $(APP_MOBILE) && pnpm lint
	@echo "==> [mobile-ci-local] typecheck"
	cd $(APP_MOBILE) && pnpm typecheck
	@echo "==> [mobile-ci-local] test"
	cd $(APP_MOBILE) && pnpm test
	@echo "==> [mobile-ci-local] DONE"

.PHONY: ci-mobile
ci-mobile: mobile-lint mobile-typecheck mobile-test ## Run full mobile CI gate

# ---------------------------------------------------------------------------
# Bootstrap / Upgrade / Demo
# ---------------------------------------------------------------------------

.PHONY: bootstrap
bootstrap: ## One-command local dev setup: backend + mobile install (idempotent)
	$(MAKE) -C $(BACKEND) bootstrap
	@echo "--- Mobile ---"
	cd $(APP_MOBILE) && pnpm install
	@echo ""
	@echo "Bootstrap complete!"
	@echo "  Backend:      http://localhost:8080"
	@echo "  Hasura Console: http://localhost:8080/console"
	@echo "  Mailhog UI:   http://localhost:8025"
	@echo "  Mobile:       make mobile-start"

.PHONY: upgrade
upgrade: ## Upgrade ntask to latest (backup -> pull -> rebuild -> migrate -> health)
	$(MAKE) -C $(BACKEND) upgrade

.PHONY: demo-seed
demo-seed: ## Seed demo data (requires DEMO_SEED=1 to prevent accidents)
	$(MAKE) -C $(BACKEND) demo-seed DEMO_SEED=$(DEMO_SEED)

# ---------------------------------------------------------------------------
# Combined gates
# ---------------------------------------------------------------------------

.PHONY: ci-local
ci-local: mobile-ci-local test ## Run full CI gate: mobile lint/typecheck/test + backend smoke

.PHONY: test-all
test-all: ## Run all lint + test suites (RN + backend)
	$(MAKE) mobile-ci-local && $(MAKE) test

# ---------------------------------------------------------------------------
# Legacy Flutter targets (archived — app/ was removed in RN migration)
# These are kept so forks that still have app/ do not break.
# ---------------------------------------------------------------------------

.PHONY: flutter-run
flutter-run: ## (Legacy Flutter shell — not the active app surface)
	@echo "WARNING: Flutter app/ is archived. Active app is apps/mobile (React Native)."
	@echo "Use: make mobile-start"

.PHONY: flutter-test
flutter-test: ## (Legacy Flutter shell — not the active app surface)
	@echo "WARNING: Flutter app/ is archived. Active tests are in apps/mobile."
	@echo "Use: make mobile-test"

.PHONY: flutter-analyze
flutter-analyze: ## (Legacy Flutter shell — not the active app surface)
	@echo "WARNING: Flutter app/ is archived."
	@echo "Use: make mobile-lint && make mobile-typecheck"

.PHONY: flutter-build-web
flutter-build-web: ## (Legacy Flutter shell — not the active app surface)
	@echo "WARNING: Flutter app/ is archived. Web surface is web/ntask (Vite)."

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
