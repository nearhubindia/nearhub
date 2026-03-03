#!/bin/bash

# ================================================================
# REDIS & CACHING SETUP SCRIPT
# Initializes Redis and configures caching for Adli
# ================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Adli - Redis & Caching System Setup                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Check if Redis is already installed
echo -e "${YELLOW}[1/5]${NC} Checking for Redis installation..."
if command -v redis-server &> /dev/null; then
  REDIS_VERSION=$(redis-server --version)
  echo -e "${GREEN}✓${NC} Redis already installed: $REDIS_VERSION"
else
  echo -e "${YELLOW}✗${NC} Redis not found. Installing...\n"
  
  OS=$(uname -s)
  
  if [ "$OS" = "Darwin" ]; then
    # macOS
    if command -v brew &> /dev/null; then
      echo "Installing Redis via Homebrew..."
      brew install redis
    else
      echo -e "${RED}Error: Homebrew not found. Please install Redis manually.${NC}"
      exit 1
    fi
  elif [ "$OS" = "Linux" ]; then
    # Linux
    if command -v apt &> /dev/null; then
      echo "Installing Redis via apt..."
      sudo apt update
      sudo apt install -y redis-server
    elif command -v yum &> /dev/null; then
      echo "Installing Redis via yum..."
      sudo yum install -y redis
    else
      echo -e "${RED}Error: Package manager not found. Please install Redis manually.${NC}"
      exit 1
    fi
  else
    echo -e "${RED}Error: Unsupported OS ($OS). Please install Redis manually.${NC}"
    exit 1
  fi
fi

# Check if npm dependencies are installed
echo -e "\n${YELLOW}[2/5]${NC} Checking npm dependencies..."

if grep -q '"redis"' package.json 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Redis package already in package.json"
else
  echo -e "${YELLOW}Installing redis npm package...${NC}"
  npm install redis
  echo -e "${GREEN}✓${NC} Redis package installed"
fi

# Check port availability
echo -e "\n${YELLOW}[3/5]${NC} Checking Redis port (6379)..."

if lsof -i :6379 &> /dev/null 2>&1; then
  echo -e "${YELLOW}✓${NC} Port 6379 is in use (Redis might already be running)"
else
  echo -e "${GREEN}✓${NC} Port 6379 is available"
fi

# Start Redis
echo -e "\n${YELLOW}[4/5]${NC} Starting Redis server..."

OS=$(uname -s)
if [ "$OS" = "Darwin" ]; then
  # macOS - check if running via Homebrew services
  if brew services list 2>/dev/null | grep -q redis; then
    if brew services list | grep redis | grep -q "started"; then
      echo -e "${GREEN}✓${NC} Redis already running (via Homebrew)"
    else
      echo "Starting Redis via Homebrew..."
      brew services start redis
      sleep 2
      echo -e "${GREEN}✓${NC} Redis started"
    fi
  else
    echo "Starting Redis server..."
    redis-server --daemonize yes --logfile /usr/local/var/log/redis.log
    sleep 2
    echo -e "${GREEN}✓${NC} Redis started as daemon"
  fi
else
  # Linux
  echo "Starting Redis server..."
  sudo service redis-server start || redis-server --daemonize yes
  sleep 2
  echo -e "${GREEN}✓${NC} Redis started"
fi

# Verify connection
echo -e "\n${YELLOW}[5/5]${NC} Verifying Redis connection..."
if redis-cli ping 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Redis is running and responding"
else
  echo -e "${RED}✗${NC} Redis connection failed. Check Redis server status."
  exit 1
fi

# Show Redis info
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Redis Setup Complete!${NC}\n"

REDIS_INFO=$(redis-cli INFO server | grep "redis_version" | cut -d: -f2 | tr -d '\r')
REDIS_PORT=$(redis-cli CONFIG GET port | tail -1)
REDIS_MEMORY=$(redis-cli INFO memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')

echo "Redis Server Information:"
echo "  Version: $REDIS_INFO"
echo "  Port: $REDIS_PORT"
echo "  Memory Usage: $REDIS_MEMORY"
echo ""

# Create environment file
echo -e "${YELLOW}Creating .env configuration...${NC}"

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << EOF
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_password (if needed)

# Cache Configuration
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
CACHE_STRATEGY=both
EOF
  echo -e "${GREEN}✓${NC} Created $ENV_FILE"
else
  echo -e "${YELLOW}✓${NC} $ENV_FILE already exists. Update if needed."
fi

# Instructions
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📚 Next Steps:${NC}\n"

echo "1. Initialize Redis in your server code:"
echo "   ${YELLOW}server/index.ts${NC}"
echo ""
echo "   import { redisCache } from './services/redis-cache';"
echo "   await redisCache.connect();"
echo ""

echo "2. Add cache middleware to routes:"
echo "   ${YELLOW}server/routes.ts${NC}"
echo ""
echo "   import { cacheMiddleware } from './services/cache-middleware';"
echo "   app.use(cacheMiddleware(300)); // 5 min TTL"
echo ""

echo "3. Use cache in your API endpoints:"
echo "   See ${YELLOW}CACHING_EXAMPLES.md${NC} for patterns"
echo ""

echo "4. Monitor cache performance:"
echo "   curl http://localhost:5000/api/admin/cache-stats"
echo ""

echo "5. Clear cache when needed:"
echo "   curl -X POST http://localhost:5000/api/admin/cache-clear"
echo ""

# Redis commands reference
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔧 Useful Redis Commands:${NC}\n"

echo "redis-cli ping                  # Check if Redis is running"
echo "redis-cli INFO                  # Server information"
echo "redis-cli KEYS '*'              # List all keys"
echo "redis-cli FLUSHALL              # Clear all data (⚠️ careful!)"
echo "redis-cli MONITOR               # Monitor commands in real-time"
echo "redis-cli --stat                # Show statistics"
echo ""

# Stop instructions
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🛑 To stop Redis:${NC}\n"

if [ "$OS" = "Darwin" ]; then
  echo "brew services stop redis"
else
  echo "sudo service redis-server stop"
  echo "# or"
  echo "redis-cli shutdown"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Test Redis with a simple operation
echo -e "${YELLOW}Testing Redis operations...${NC}"
redis-cli SET "test:key" "Adli Caching System" EX 60 > /dev/null
TEST_VALUE=$(redis-cli GET "test:key")
redis-cli DEL "test:key" > /dev/null

if [ "$TEST_VALUE" = "Adli Caching System" ]; then
  echo -e "${GREEN}✓${NC} Redis read/write test passed"
else
  echo -e "${RED}✗${NC} Redis test failed"
fi

echo ""
