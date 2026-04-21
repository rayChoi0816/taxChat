#!/bin/bash

# 실행 중인 서버 프로세스 종료 스크립트

echo "=========================================="
echo "서버 프로세스 종료"
echo "=========================================="

# 백엔드 서버 (포트 3001)
echo ""
echo "1. 백엔드 서버 종료 중..."
PID_BACKEND=$(lsof -ti:3001 2>/dev/null)
if [ ! -z "$PID_BACKEND" ]; then
  echo "   포트 3001 프로세스(PID: $PID_BACKEND) 종료 중..."
  kill -9 $PID_BACKEND 2>/dev/null
  sleep 1
  echo "   ✅ 백엔드 서버 종료 완료"
else
  echo "   포트 3001을 사용하는 프로세스 없음"
fi

# 프론트엔드 서버 (포트 5173)
echo ""
echo "2. 프론트엔드 서버 종료 중..."
PID_FRONTEND=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$PID_FRONTEND" ]; then
  echo "   포트 5173 프로세스(PID: $PID_FRONTEND) 종료 중..."
  kill -9 $PID_FRONTEND 2>/dev/null
  sleep 1
  echo "   ✅ 프론트엔드 서버 종료 완료"
else
  echo "   포트 5173을 사용하는 프로세스 없음"
fi

# 다른 Vite 포트들도 확인
echo ""
echo "3. 다른 Vite 포트 확인 중..."
for port in 5174 5175 5176; do
  PID=$(lsof -ti:$port 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo "   포트 $port 프로세스(PID: $PID) 종료 중..."
    kill -9 $PID 2>/dev/null
  fi
done

echo ""
echo "=========================================="
echo "프로세스 종료 완료"
echo "=========================================="
echo ""
echo "이제 ./start-servers.sh를 실행하여 서버를 시작하세요."

