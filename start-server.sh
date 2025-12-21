#!/bin/bash

# TaxChat 서버 실행 스크립트

echo "TaxChat 서버를 시작합니다..."

# 서버 디렉토리로 이동
cd server

# .env 파일 확인
if [ ! -f .env ]; then
    echo ".env 파일이 없습니다. .env.example을 복사합니다..."
    cp .env.example .env
    echo "⚠️  .env 파일을 열어 데이터베이스 정보를 수정해주세요!"
fi

# node_modules 확인
if [ ! -d "node_modules" ]; then
    echo "의존성을 설치합니다..."
    npm install
fi

# 서버 실행
echo "서버를 시작합니다..."
npm start

