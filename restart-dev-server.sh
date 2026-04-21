#!/bin/bash

# 개발 서버 재시작 스크립트

echo "=========================================="
echo "개발 서버 재시작"
echo "=========================================="

# 프론트엔드 포트 확인 및 종료
echo ""
echo "1. 기존 프로세스 종료 중..."
PORT=5173
PID=$(lsof -ti:$PORT 2>/dev/null)
if [ ! -z "$PID" ]; then
  echo "   포트 $PORT를 사용하는 프로세스(PID: $PID) 종료 중..."
  kill -9 $PID 2>/dev/null
  sleep 1
  echo "   ✅ 종료 완료"
else
  echo "   포트 $PORT를 사용하는 프로세스 없음"
fi

# 다른 가능한 포트들도 확인
for port in 5174 5175 5176 3000; do
  PID=$(lsof -ti:$port 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo "   포트 $port를 사용하는 프로세스(PID: $PID) 종료 중..."
    kill -9 $PID 2>/dev/null
  fi
done

sleep 1

# 프론트엔드 서버 시작
echo ""
echo "2. 프론트엔드 서버 시작 중..."
cd ui
npm run dev

