#!/bin/bash

# Test script for Satellite Telemetry System
echo "🚀 Testing Satellite Telemetry System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is responding
check_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Checking $name... "
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ FAILED${NC}"
    return 1
}

# Function to test API endpoints
test_api() {
    local base_url=$1
    local endpoint=$2
    local description=$3
    
    echo -n "Testing $description... "
    if curl -s "$base_url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ FAILED${NC}"
    fi
}

# Check if Docker Compose is running
echo "📋 Checking if services are running..."
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Docker Compose services are not running. Please start them first:${NC}"
    echo "   docker-compose up -d"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose services are running${NC}"

# Wait a bit for services to fully start
echo "⏳ Waiting for services to be ready..."
sleep 10

# Test database connection
echo "🗄️  Testing database connection..."
if docker-compose exec postgres pg_isready -U telemetry_user -d telemetry > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is ready${NC}"
else
    echo -e "${RED}❌ Database is not ready${NC}"
fi

# Test API service
echo "🔌 Testing API service..."
if check_service "API Service" "http://localhost:8080/health"; then
    echo "📊 Testing API endpoints..."
    test_api "http://localhost:8080" "/api/v1/telemetry/current" "Current telemetry endpoint"
    test_api "http://localhost:8080" "/api/v1/telemetry" "Historical telemetry endpoint"
    test_api "http://localhost:8080" "/api/v1/telemetry/anomalies" "Anomalies endpoint"
    test_api "http://localhost:8080" "/api/v1/telemetry/aggregations" "Aggregations endpoint"
else
    echo -e "${RED}❌ API service is not responding${NC}"
fi

# Test frontend
echo "🌐 Testing frontend..."
if check_service "Frontend" "http://localhost:3000"; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test monitoring services
echo "📈 Testing monitoring services..."
if check_service "Prometheus" "http://localhost:9090"; then
    echo -e "${GREEN}✅ Prometheus is accessible${NC}"
else
    echo -e "${RED}❌ Prometheus is not accessible${NC}"
fi

if check_service "Grafana" "http://localhost:3001"; then
    echo -e "${GREEN}✅ Grafana is accessible${NC}"
else
    echo -e "${RED}❌ Grafana is not accessible${NC}"
fi

# Check for telemetry data
echo "📡 Checking for telemetry data..."
sleep 5
if curl -s "http://localhost:8080/api/v1/telemetry/current" | grep -q "temperature"; then
    echo -e "${GREEN}✅ Telemetry data is being generated${NC}"
else
    echo -e "${YELLOW}⚠️  No telemetry data found yet (this is normal if the system just started)${NC}"
fi

# Summary
echo ""
echo "🎯 Test Summary:"
echo "=================="
echo "To access the applications:"
echo "  📊 Dashboard: http://localhost:3000"
echo "  🔌 API: http://localhost:8080"
echo "  📈 Grafana: http://localhost:3001 (admin/admin)"
echo "  📊 Prometheus: http://localhost:9090"
echo ""
echo "To monitor logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop the system:"
echo "  docker-compose down"
echo ""
echo -e "${GREEN}🚀 System test completed!${NC}" 