#!/bin/bash

# PostgreSQL 연결 테스트 스크립트

echo "=========================================="
echo "PostgreSQL 연결 테스트"
echo "=========================================="

# 여러 가지 비밀번호 시도
PASSWORDS=("postgres" "" "password" "root" "admin")

for PASSWORD in "${PASSWORDS[@]}"; do
  echo ""
  echo "비밀번호 시도: ${PASSWORD:-'(빈 비밀번호)'}"
  
  if [ -z "$PASSWORD" ]; then
    export PGPASSWORD=""
    psql -U postgres -h localhost -d taxchat -c "SELECT version();" 2>&1
  else
    export PGPASSWORD="$PASSWORD"
    psql -U postgres -h localhost -d taxchat -c "SELECT version();" 2>&1
  fi
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 연결 성공! 비밀번호: ${PASSWORD:-'(빈 비밀번호)'}"
    echo ""
    echo "이 비밀번호를 사용하여 서버를 시작하세요:"
    echo "export DB_PASSWORD=\"$PASSWORD\""
    echo "./start-servers.sh"
    exit 0
  fi
done

echo ""
echo "❌ 연결 실패: 올바른 비밀번호를 찾을 수 없습니다."
echo ""
echo "다음 명령어로 직접 비밀번호를 확인하세요:"
echo "psql -U postgres -h localhost"
echo ""
echo "또는 PostgreSQL 설정 파일을 확인하세요:"
echo "- macOS (Homebrew): /opt/homebrew/var/postgresql@*/postgresql.conf"
echo "- Linux: /etc/postgresql/*/main/postgresql.conf"

