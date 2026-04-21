#!/bin/bash

# TaxChat 서버 시작 스크립트

echo "=========================================="
echo "TaxChat 서버 시작"
echo "=========================================="

# 백엔드 서버 시작
echo ""
echo "📦 백엔드 서버 시작 중..."
cd server
export NODE_ENV=development
export SKIP_AUTH=true
export PORT=3001
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export DB_NAME=${DB_NAME:-taxchat}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-cmy0816!}
export CORS_ORIGIN=http://localhost:5173
npm run dev &
BACKEND_PID=$!
echo "백엔드 서버 PID: $BACKEND_PID"

# 프론트엔드 서버 시작
echo ""
echo "📦 프론트엔드 서버 시작 중..."
cd ../ui
npm run dev &
FRONTEND_PID=$!
echo "프론트엔드 서버 PID: $FRONTEND_PID"

echo ""
echo "=========================================="
echo "서버가 시작되었습니다!"
echo "=========================================="
echo "백엔드: http://localhost:3001"
echo "프론트엔드: http://localhost:5173"
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요"
echo "=========================================="

# 프로세스 종료 시그널 처리
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# 프로세스가 종료될 때까지 대기
wait

