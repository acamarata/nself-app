# =============================================================================
# ɳTasks repo-level Makefile
#
# Thin wrapper over backend/Makefile + app (Flutter) commands.
#
# nSelf-First: `make up` delegates to `nself start` via backend/Makefile.
# Run `make build` once before first `make up` (generates docker-compose.yml).
# =============================================================================

BACKEND := backend
APP     := app

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

.PHONY: test-app
test-app: ## Run the Flutter app tests
	cd $(APP) && flutter test

.PHONY: analyze
analyze: ## Run flutter analyze on the app
	cd $(APP) && flutter analyze

.PHONY: test-all
test-all: analyze test-app test ## Run all lint + test suites

.PHONY: run
run: ## Run the Flutter app (defaults to connected device / desktop)
	cd $(APP) && flutter run

.PHONY: build-web
build-web: ## Build the Flutter web bundle
	cd $(APP) && flutter build web

.PHONY: clean
clean: ## Remove Flutter build artifacts (safe; not backend data)
	cd $(APP) && flutter clean

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
