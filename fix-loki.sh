#!/usr/bin/env bash
set -e
echo "Dang lam moi dich vu Loki va Promtail..."
cd /home/luongmanhha/LMS-Online
docker rm -f lms-loki lms-promtail || true
docker volume rm lms-online_loki_data || true
docker compose up -d loki promtail
echo ""
echo "================================================"
echo "✓ DA KHOI CHAY THANH CONG LOKI VA PROMTAIL!"
echo "================================================"
