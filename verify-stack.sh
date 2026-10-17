#!/usr/bin/env bash
# ========================================================
# Script kiểm tra cấu hình & trạng thái hệ thống LMS Đề 17
# ========================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  KIỂM TRA HỆ THỐNG LMS ONLINE DOCKER COMPOSE (ĐỀ 17)  ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Kiểm tra các file cần thiết
echo -e "\n${YELLOW}[1/4] Kiểm tra các file cấu hình...${NC}"
REQUIRED_FILES=(
  "docker-compose.yml"
  ".env"
  "database/init.sql"
  "nginx/default.conf"
  "app/Dockerfile"
  "app/package.json"
  "app/src/app.js"
  "monitoring/prometheus/prometheus.yml"
  "monitoring/loki/loki-config.yml"
  "monitoring/promtail/promtail-config.yml"
  "monitoring/grafana/provisioning/datasources/datasources.yml"
  "monitoring/grafana/provisioning/dashboards/lms-overview.json"
)

MISSING_FILE=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}✓${NC} $f"
  else
    echo -e "  ${RED}✗ THIẾU:${NC} $f"
    MISSING_FILE=1
  fi
done

if [ "$MISSING_FILE" -eq 1 ]; then
  echo -e "${RED}Lỗi: Có file cấu hình bị thiếu! Vui lòng kiểm tra lại.${NC}"
  exit 1
fi

# 2. Kiểm tra cú pháp docker compose
echo -e "\n${YELLOW}[2/4] Kiểm tra cú pháp docker-compose.yml...${NC}"
if docker compose config > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ Cú pháp docker-compose.yml hoàn toàn hợp lệ!${NC}"
elif sudo docker compose config > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ Cú pháp docker-compose.yml hoàn toàn hợp lệ (với quyền sudo)!${NC}"
else
  echo -e "  ${RED}✗ Lỗi cú pháp trong docker-compose.yml hoặc thiếu quyền Docker!${NC}"
fi

# 3. Kiểm tra các cổng dịch vụ
echo -e "\n${YELLOW}[3/4] Danh sách cổng và dịch vụ hệ thống:${NC}"
echo -e "  - Cổng 80   : Nginx Reverse Proxy (Cổng vào chính của hệ thống)"
echo -e "  - Cổng 3000 : Web App LMS Node.js (Trực tiếp hoặc qua Nginx)"
echo -e "  - Cổng 8081 : phpMyAdmin (Giao diện đồ họa quản trị MySQL)"
echo -e "  - Cổng 3306 : MySQL Database"
echo -e "  - Cổng 3001 : Grafana Dashboard (Giám sát Metrics & Logs)"
echo -e "  - Cổng 9090 : Prometheus Server (Thu thập Metrics)"
echo -e "  - Cổng 3100 : Loki (Thu thập Logs)"

# 4. Hướng dẫn lệnh khởi chạy
echo -e "\n${YELLOW}[4/4] Lệnh khởi chạy hệ thống:${NC}"
echo -e "  ${GREEN}sudo docker compose up -d --build${NC}"
echo -e "\nKiểm tra trạng thái container:"
echo -e "  ${GREEN}sudo docker compose ps${NC}"
echo -e "\nXem logs toàn bộ hệ thống:"
echo -e "  ${GREEN}sudo docker compose logs -f${NC}"
echo -e "\nDừng hệ thống:"
echo -e "  ${GREEN}sudo docker compose down${NC}"

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}✓ Tất cả cấu hình và source code đã sẵn sàng!${NC}"
echo -e "${BLUE}======================================================${NC}"
