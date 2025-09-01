# Nana Mizuki Live ACCOMPLISHMENT

---

## Quick Start

### 1. Setup Environment

```bash
make setup
```

### 2. Configure Database

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Initialize Database

```bash
make db-init
```

### 4. Run Crawler

```bash
make run
```

### 5. Export Data & Start Frontend

```bash
make export-data
make start-frontend
```

---

## Architecture

```t
├── scripts/           # Data collection scripts
├── database/          # Database schema
├── frontend/          # React web interface  
└── docs/             # Documentation
```

---

## Commands

| Command | Description |
|---------|-------------|
| `make setup` | Install dependencies |
| `make run` | Run data crawler |
| `make export-data` | Export to JSON |
| `make start-frontend` | Start web app |

---

## Tech Stack

**Backend**: Python, PostgreSQL  
**Frontend**: React, TypeScript, Material-UI  
**Data Source**: anifesdb.net

---

## License

MIT © [CheerChen](https://github.com/cheerchen)
