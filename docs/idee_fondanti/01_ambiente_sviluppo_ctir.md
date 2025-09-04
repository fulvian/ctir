# Setup Ambiente di Sviluppo per CTIR

## Struttura Consigliata del Progetto

### Organizzazione Directory Principale

```bash
ctir/                                    # Main project directory
├── README.md
├── package.json                         # Main project dependencies  
├── tsconfig.json                        # TypeScript configuration
├── .env.example                         # Environment variables template
├── .gitignore
├── 
├── src/                                 # CTIR core source code
│   ├── core/
│   ├── integrations/
│   ├── models/
│   └── utils/
├── 
├── submodules/                          # Git submodules for external repos
│   ├── cc-sessions/                     # Git submodule
│   ├── claude-code-router/              # Git submodule  
│   └── local-llm-mcp-servers/           # Git submodule or custom
├── 
├── local-development/                   # Development utilities
│   ├── docker/                          # Docker containers for services
│   ├── scripts/                         # Setup and utility scripts
│   └── configs/                         # Development configurations
├── 
├── tests/
├── docs/
└── dist/                               # Compiled TypeScript output
```


## Setup Passo per Passo

### 1. Creazione Struttura Base

```bash
# Crea directory principale
mkdir ctir && cd ctir

# Inizializza git repository principale
git init

# Crea struttura base
mkdir -p src/{core,integrations,models,utils}
mkdir -p submodules
mkdir -p local-development/{docker,scripts,configs}
mkdir -p tests/{unit,integration}
mkdir -p docs
```


### 2. Setup Git Submodules per Dipendenze Esterne

```bash
# Aggiungi cc-sessions come submodule
git submodule add https://github.com/GWUDCAP/cc-sessions.git submodules/cc-sessions

# Aggiungi CCR come submodule  
git submodule add https://github.com/musistudio/claude-code-router.git submodules/claude-code-router

# Per MCP servers, se esistono repo specifici o crea il tuo
mkdir submodules/ctir-mcp-servers
cd submodules/ctir-mcp-servers && git init

# Inizializza e aggiorna submodules
cd ../..
git submodule update --init --recursive
```


### 3. Setup Node.js Environment

#### Package.json Principale

```json
{
  "name": "ctir",
  "version": "1.0.0",
  "description": "Claude Task Intelligence Router",
  "main": "dist/index.js",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc && tsc-alias",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "setup": "node local-development/scripts/setup.js",
    "setup:models": "node local-development/scripts/setup-models.js",
    "submodules:install": "node local-development/scripts/install-submodules.js"
  },
  "dependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.2.0",
    "tsx": "^4.0.0",
    "tsc-alias": "^1.8.8",
    "dotenv": "^16.3.1",
    "sqlite3": "^5.1.6",
    "ws": "^8.14.0",
    "express": "^4.18.0",
    "zod": "^3.22.0",
    "ollama": "^0.5.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "vitest": "^0.34.0",
    "@vitest/coverage-v8": "^0.34.0"
  }
}
```


### 4. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@/core/*": ["src/core/*"],
      "@/integrations/*": ["src/integrations/*"],
      "@/models/*": ["src/models/*"],
      "@/utils/*": ["src/utils/*"],
      "@cc-sessions/*": ["submodules/cc-sessions/src/*"],
      "@ccr/*": ["submodules/claude-code-router/src/*"]
    }
  },
  "include": [
    "src/**/*",
    "submodules/*/src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```


## Python Environment per MCP Servers

### Setup Virtual Environment

```bash
# Crea Python venv per MCP servers
python3 -m venv local-development/venv

# Attiva virtual environment  
source local-development/venv/bin/activate

# Crea requirements.txt per MCP servers
cat > local-development/requirements.txt << EOF
pydantic>=2.0.0
fastapi>=0.100.0
uvicorn>=0.23.0
ollama-python>=0.1.0
sqlite3-utils>=3.34.0
websockets>=11.0.0
python-dotenv>=1.0.0
pytest>=7.4.0
black>=23.0.0
flake8>=6.0.0
EOF

# Installa dipendenze Python
pip install -r local-development/requirements.txt
```


## Script di Setup Automatico

### Script Setup Principale

```bash
#!/bin/bash
# local-development/scripts/setup.sh

set -e

echo "🚀 Setting up CTIR development environment..."

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current: $(node --version)"
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup submodules
echo "🔗 Setting up Git submodules..."
git submodule update --init --recursive

# Install submodule dependencies
echo "📦 Installing submodule dependencies..."
cd submodules/cc-sessions && npm install && cd ../..
cd submodules/claude-code-router && npm install && cd ../..

# Setup Python environment for MCP servers
echo "🐍 Setting up Python environment..."
python3 -m venv local-development/venv
source local-development/venv/bin/activate
pip install -r local-development/requirements.txt

# Create .env file
if [ ! -f .env ]; then
    echo "⚙️ Creating .env file..."
    cp .env.example .env
    echo "Please edit .env file with your configurations"
fi

# Setup database
echo "💾 Setting up database..."
npm run build
node dist/scripts/setup-database.js

echo "✅ Setup complete! Run 'npm run dev' to start development."
```


### Script Setup Modelli Ollama

```bash
#!/bin/bash  
# local-development/scripts/setup-models.sh

echo "🤖 Setting up local models..."

# Install Ollama if not present
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Start Ollama service
echo "Starting Ollama service..."
ollama serve &
OLLAMA_PID=$!

# Wait for service to be ready
sleep 5

# Pull required models
echo "Downloading models (this may take a while)..."
ollama pull qwen2.5-coder:7b &

wait

echo "✅ All models downloaded successfully!"
```


## Configurazione Development Environment

### VS Code Settings

```json
// .vscode/settings.json
{
  "typescript.preferences.paths": "non-relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.workingDirectories": ["./", "./submodules/cc-sessions", "./submodules/claude-code-router"],
  "python.defaultInterpreterPath": "./local-development/venv/bin/python",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```


### .env.example

```bash
# CTIR Configuration
NODE_ENV=development
LOG_LEVEL=debug
DB_PATH=./local-development/ctir.db

# Ollama Configuration  
OLLAMA_HOST=http://localhost:11434
DEFAULT_DEBUG_MODEL=qwen2.5-coder:7b
DEFAULT_GENERATION_MODEL=qwen2.5-coder:7b
DEFAULT_FORMATTING_MODEL=qwen2.5-coder:7b

# Claude Code Integration
CLAUDE_API_KEY=your_api_key_here
TOKEN_BUDGET_LIMIT=100000

# MCP Server Configuration
MCP_SERVER_PORT=3001
WEBSOCKET_PORT=3002

# cc-sessions Integration
CC_SESSIONS_PATH=./submodules/cc-sessions
CC_SESSIONS_CONFIG=./local-development/configs/cc-sessions.json

# CCR Integration
CCR_PATH=./submodules/claude-code-router
CCR_CONFIG=./local-development/configs/ccr.json
```


## Workflow di Sviluppo Raccomandato

### 1. Setup Iniziale

```bash
# Clone repository
git clone <your-ctir-repo> ctir
cd ctir

# Run setup script
chmod +x local-development/scripts/setup.sh
./local-development/scripts/setup.sh

# Setup models
chmod +x local-development/scripts/setup-models.sh  
./local-development/scripts/setup-models.sh
```


### 2. Sviluppo Quotidiano

```bash
# Start development mode
npm run dev

# In separate terminal - start MCP servers
source local-development/venv/bin/activate
python submodules/ctir-mcp-servers/debug-server.py

# Run tests
npm test

# Build for production
npm run build
```


### 3. Gestione Submodules

```bash
# Update all submodules to latest
git submodule update --recursive --remote

# Update specific submodule
cd submodules/cc-sessions
git pull origin main
cd ../..
git add submodules/cc-sessions
git commit -m "Update cc-sessions submodule"
```


## Considerazioni per macOS/Apple Silicon

### Ollama Optimization

```bash
# ~/.ollama/config.json (create if doesn't exist)
{
  "experimental": true,
  "gpu_memory_fraction": 0.8,
  "num_gpu": 1,
  "num_thread": 8
}
```


### Memory Management

```bash
# Aggiungi al .env per ottimizzare per 16GB RAM
MAX_MODEL_MEMORY=6GB
ENABLE_MODEL_UNLOADING=true
MODEL_CACHE_SIZE=2GB
```

Questa struttura ti permette di:

- **Mantenere separati** i progetti esistenti come submodules
- **Sviluppare CTIR** come progetto principale integrato
- **Gestire facilmente** aggiornamenti dei submodules
- **Avere un ambiente** completamente configurato e reproducibile
- **Ottimizzare** per il tuo MacBook Pro 16GB

Vuoi che procediamo con la creazione di alcuni di questi file di configurazione?
