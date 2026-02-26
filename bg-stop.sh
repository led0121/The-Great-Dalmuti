#!/bin/bash
# ============================================================
#  🛑 달무티 & 카지노 게임 - 종료 스크립트
#  bg-start.sh 로 실행된 프로세스를 종료합니다.
# ============================================================

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 프로젝트 루트
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.game.pid"
SERVER_PORT=3000
CLIENT_PORT=18000

echo -e "${YELLOW}🛑 게임 서버를 종료합니다...${NC}"
echo ""

KILLED=0

# ============================================================
#  PID 파일 기반 종료
# ============================================================
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(sed -n '1p' "$PID_FILE")
    CLIENT_PID=$(sed -n '2p' "$PID_FILE")

    # 서버 종료
    if [ -n "$SERVER_PID" ]; then
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            kill "$SERVER_PID" 2>/dev/null
            # 자식 프로세스도 종료
            pkill -P "$SERVER_PID" 2>/dev/null || true
            echo -e "${GREEN}  ✅ 서버 종료됨 (PID: ${SERVER_PID})${NC}"
            KILLED=$((KILLED + 1))
        else
            echo -e "${YELLOW}  ⚠️  서버 프로세스가 이미 종료됨 (PID: ${SERVER_PID})${NC}"
        fi
    fi

    # 클라이언트 종료
    if [ -n "$CLIENT_PID" ]; then
        if kill -0 "$CLIENT_PID" 2>/dev/null; then
            kill "$CLIENT_PID" 2>/dev/null
            pkill -P "$CLIENT_PID" 2>/dev/null || true
            echo -e "${GREEN}  ✅ 클라이언트 종료됨 (PID: ${CLIENT_PID})${NC}"
            KILLED=$((KILLED + 1))
        else
            echo -e "${YELLOW}  ⚠️  클라이언트 프로세스가 이미 종료됨 (PID: ${CLIENT_PID})${NC}"
        fi
    fi

    rm -f "$PID_FILE"
else
    echo -e "${YELLOW}  ⚠️  PID 파일이 없습니다 (.game.pid)${NC}"
    echo -e "${YELLOW}     포트 기반 종료를 시도합니다...${NC}"
fi

# ============================================================
#  포트 기반 추가 정리 (혹시 남은 프로세스)
# ============================================================
kill_port() {
    local port=$1
    local killed=false
    if command -v fuser &> /dev/null; then
        fuser -k ${port}/tcp > /dev/null 2>&1 && killed=true
    fi
    if command -v lsof &> /dev/null; then
        lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null && killed=true
    fi
    if command -v ss &> /dev/null; then
        local pids=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
        [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null && killed=true
    fi
    if command -v netstat &> /dev/null; then
        local pids=$(netstat -tlnp 2>/dev/null | grep ":${port}" | awk '{print $7}' | grep -oP '[0-9]+' | sort -u)
        [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null && killed=true
    fi
    $killed && return 0 || return 1
}

for port in $SERVER_PORT $CLIENT_PORT; do
    if kill_port $port; then
        echo -e "${GREEN}  ✅ 포트 ${port} 정리됨${NC}"
        KILLED=$((KILLED + 1))
    fi
done

echo ""
if [ $KILLED -gt 0 ]; then
    echo -e "${GREEN}✅ 모든 프로세스가 종료되었습니다.${NC}"
else
    echo -e "${YELLOW}ℹ️  종료할 프로세스가 없습니다. 이미 모두 종료된 상태입니다.${NC}"
fi
echo ""
