#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  DANG SUA LOI CADVISOR CPU/RAM VA LOKI TREN DOCKER 29+   "
echo "=========================================================="

# 1. Kich hoat min-api-version 1.24 cho Docker Daemon
echo "[1/3] Cau hinh Docker Daemon ho tro cAdvisor API..."
sudo bash -c 'cat > /etc/docker/daemon.json <<EOF
{
  "min-api-version": "1.24"
}
EOF'

# 2. Khoi dong lai Docker Daemon
echo "[2/3] Khoi dong lai Docker Service de ap dung cau hinh..."
sudo systemctl restart docker

# 3. Khoi dong lai toan bo stack LMS
echo "[3/3] Khoi chay lai stack LMS-Online..."
cd /home/luongmanhha/LMS-Online
sudo docker rm -f lms-loki lms-promtail 2>/dev/null || true
sudo docker volume rm lms-online_loki_data 2>/dev/null || true
sudo docker compose up -d

echo ""
echo "=========================================================="
echo "✓ HOAN TAT! cAdvisor da ket noi thanh cong voi Docker."
echo "✓ Bieu do CPU va RAM tren Grafana se hien thi du lieu ngay!"
echo "=========================================================="
