#!/bin/bash

# TaxChat 서버 전체 시작 스크립트

echo "=========================================="
echo "TaxChat 서버 전체 시작"
echo "=========================================="

# 기존 프로세스 정리
echo ""
echo "1. 기존 프로세스 정리 중..."
# 포트 3001 (백엔드) 정리
PID_BACKEND=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PID_BACKEND" ]; then
  echo "   백엔드 프로세스(PID: $PID_BACKEND) 종료 중..."
  kill -9 $PID_BACKEND 2>/dev/null
  sleep 1
fi

# 포트 5173 (프론트엔드) 정리
PID_FRONTEND=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$PID_FRONTEND" ]; then
  echo "   프론트엔드 프로세스(PID: $PID_FRONTEND) 종료 중..."
  kill -9 $PID_FRONTEND 2>/dev/null
  sleep 1
fi

# 다른 Vite 포트들도 정리
for port in 5174 5175 5176; do
  PID=$(lsof -ti:$port 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo "   포트 $port 프로세스(PID: $PID) 종료 중..."
    kill -9 $PID 2>/dev/null
  fi
done

sleep 2

# 백엔드 서버 시작
echo ""
echo "2. 백엔드 서버 시작 중..."
cd server
export NODE_ENV=development
export SKIP_AUTH=true
export PORT=3001
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export DB_NAME=${DB_NAME:-taxchat}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export CORS_ORIGIN=http://localhost:5173
npm run dev &
BACKEND_PID=$!
echo "   백엔드 서버 PID: $BACKEND_PID"
sleep 3

# 프론트엔드 서버 시작
echo ""
echo "3. 프론트엔드 서버 시작 중..."
cd ../ui
npm run dev &
FRONTEND_PID=$!
echo "   프론트엔드 서버 PID: $FRONTEND_PID"

echo ""
echo "=========================================="
echo "서버가 시작되었습니다!"
echo "=========================================="
echo "백엔드: http://localhost:3001"
echo "프론트엔드: http://localhost:5173 (또는 터미널에서 확인)"
echo ""
echo "서버를 중지하려면 Ctrl+C를 누르세요"
echo "=========================================="

# 프로세스 종료 시그널 처리
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 프로세스가 종료될 때까지 대기
wait

