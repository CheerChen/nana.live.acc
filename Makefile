# Makefile

# Variable definitions
PYTHON = python3
PIP = pip3
VENV_DIR = venv
REQUIREMENTS = requirements.txt
SCRIPT = scripts/crawler.py
DDL_FILE = database/ddl.sql
FRONTEND_PORT = 3000

# Default target
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make setup         - Create virtual environment and install dependencies"
	@echo "  make install       - Install Python dependencies"
	@echo "  make run           - Run the crawler"
	@echo "  make db-init       - Initialize database (requires environment variables)"
	@echo "  make clean         - Clean virtual environment"
	@echo "  make env-check     - Check environment variables"
	@echo "  make test-db       - Test database connection"
	@echo "  make dev-setup     - Complete development environment setup"
	@echo "  make start-frontend - Start frontend development server"
	@echo "  make frontend-install - Install frontend dependencies"
	@echo "  make frontend-build - Build frontend for production"
	@echo "  make export-data   - Export database data to static JSON files"
	@echo "  make status        - Show project status"

# Create virtual environment
$(VENV_DIR):
	@echo "Creating Python virtual environment..."
	$(PYTHON) -m venv $(VENV_DIR)
	@echo "Virtual environment created successfully"

# Install dependencies
.PHONY: install
install: $(VENV_DIR)
	@echo "Activating virtual environment and installing dependencies..."
	. $(VENV_DIR)/bin/activate && $(PIP) install --upgrade pip
	. $(VENV_DIR)/bin/activate && $(PIP) install -r $(REQUIREMENTS)
	@echo "Dependencies installed successfully"

# Complete setup
.PHONY: setup
setup: install
	@echo "Environment setup completed!"
	@echo "Please ensure the following environment variables are set:"
	@echo "  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT"
	@echo "Or create a .env file"

# Check environment variables
.PHONY: env-check
env-check:
	@echo "Checking environment variables..."
	@if [ -f .env ]; then \
		echo "Found .env file:"; \
		cat .env; \
	else \
		echo "No .env file found, checking environment variables:"; \
		echo "DB_HOST = $${DB_HOST:-Not set}"; \
		echo "DB_USER = $${DB_USER:-Not set}"; \
		echo "DB_PASSWORD = $${DB_PASSWORD:-Not set}"; \
		echo "DB_NAME = $${DB_NAME:-Not set}"; \
		echo "DB_PORT = $${DB_PORT:-Not set}"; \
	fi

# Function to load environment variables
define load_env
	$(if $(wildcard .env), set -a && . ./.env && set +a &&, )
endef

# Test database connection
.PHONY: test-db
test-db: $(VENV_DIR)
	@echo "Testing database connection..."
	. $(VENV_DIR)/bin/activate && $(PYTHON) test_db.py

# Initialize database
.PHONY: db-init
db-init:
	@echo "Initializing database..."
	@if [ -f .env ]; then \
		set -a && . ./.env && set +a && \
		psql -h "$${DB_HOST}" -U "$${DB_USER}" -d "$${DB_NAME}" -p "$${DB_PORT}" -f $(DDL_FILE); \
	else \
		psql -h "$${DB_HOST}" -U "$${DB_USER}" -d "$${DB_NAME}" -p "$${DB_PORT}" -f $(DDL_FILE); \
	fi
	@echo "Database initialization completed"

# Run crawler
.PHONY: run
run: $(VENV_DIR)
	@echo "Running Nana Mizuki live history crawler..."
	$(call load_env) . $(VENV_DIR)/bin/activate && $(PYTHON) $(SCRIPT)

# Clean virtual environment
.PHONY: clean
clean:
	@echo "Cleaning virtual environment..."
	rm -rf $(VENV_DIR)
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "Cleanup completed"

# Reset everything
.PHONY: reset
reset: clean setup

# Install frontend dependencies
.PHONY: frontend-install
frontend-install:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Frontend dependencies installed successfully"

# Build frontend for production
.PHONY: frontend-build
frontend-build:
	@echo "Building frontend for production..."
	cd frontend && npm run build
	@echo "Frontend build completed"

# Export database data to static JSON files
.PHONY: export-data
export-data: $(VENV_DIR)
	@echo "Exporting database data to static JSON files..."
	$(call load_env) . $(VENV_DIR)/bin/activate && $(PYTHON) scripts/export_static_data.py
	@echo "Data export completed successfully"

# Complete development environment setup
.PHONY: dev-setup
dev-setup: setup frontend-install
	@echo "Development environment setup completed!"
	@echo "Run 'make export-data' to generate static data files"
	@echo "Run 'make start-frontend' to start the frontend development server"

# Start frontend development server
.PHONY: start-frontend
start-frontend:
	@echo "Starting frontend development server on port $(FRONTEND_PORT)..."
	cd frontend && npm start

# Show project status
.PHONY: status
status:
	@echo "Project Status:"
	@echo "Virtual Environment: $(if $(wildcard $(VENV_DIR)),✅ Created,❌ Not created)"
	@echo "Environment Config: $(if $(wildcard .env),✅ .env file exists,⚠️  .env file missing)"
	@echo "Requirements File: $(if $(wildcard $(REQUIREMENTS)),✅ requirements.txt exists,❌ requirements.txt missing)"
	@echo "Crawler Script: $(if $(wildcard $(SCRIPT)),✅ crawler.py exists,❌ crawler.py missing)"
	@echo "Database DDL: $(if $(wildcard $(DDL_FILE)),✅ ddl.sql exists,❌ ddl.sql missing)"
	@echo "Frontend Project: $(if $(wildcard frontend/package.json),✅ React project exists,❌ React project missing)"
	@echo "Frontend Dependencies: $(if $(wildcard frontend/node_modules),✅ Installed,❌ Not installed)"
	@echo "Static Data Files: $(if $(wildcard frontend/public/data),✅ Generated,❌ Not generated)"

# Frontend status
.PHONY: frontend-status
frontend-status:
	@echo "Frontend Project Status:"
	@echo "package.json: $(if $(wildcard frontend/package.json),✅ Exists,❌ Missing)"
	@echo "node_modules: $(if $(wildcard frontend/node_modules),✅ Installed,❌ Not installed)"
	@echo "Source files: $(if $(wildcard frontend/src),✅ Exists,❌ Missing)"
	@echo "Static data: $(if $(wildcard frontend/public/data),✅ Generated,❌ Not generated)"
