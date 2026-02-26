#!/bin/bash
# ============================================================
#  🔍 달무티 & 보드게임 라운지 - 상태 확인 스크립트
# ============================================================

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.game.pid"
SERVER_PORT=3000
CLIENT_PORT=18000

echo ""
echo -e "${BOLD}🔍 게임 서버 상태${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVER_RUNNING=false
CLIENT_RUNNING=false

# PID 파일 확인
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(sed -n '1p' "$PID_FILE")
    CLIENT_PID=$(sed -n '2p' "$PID_FILE")

    # 서버 상태
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo -e "  서버:     ${GREEN}● 실행 중${NC} (PID: ${SERVER_PID}, 포트: ${SERVER_PORT})"
        SERVER_RUNNING=true
    else
        echo -e "  서버:     ${RED}● 중지됨${NC}"
    fi

    # 클라이언트 상태
    if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo -e "  클라이언트: ${GREEN}● 실행 중${NC} (PID: ${CLIENT_PID}, 포트: ${CLIENT_PORT})"
        CLIENT_RUNNING=true
    else
        echo -e "  클라이언트: ${RED}● 중지됨${NC}"
    fi
else
    echo -e "  서버:     ${RED}● 중지됨${NC} (PID 파일 없음)"
    echo -e "  클라이언트: ${RED}● 중지됨${NC} (PID 파일 없음)"
fi

echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 접속 정보
if $SERVER_RUNNING && $CLIENT_RUNNING; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -z "$LOCAL_IP" ] && LOCAL_IP="localhost"

    echo -e ""
    echo -e "  ${CYAN}📌 접속:${NC} http://localhost:${CLIENT_PORT}"
    echo -e "  ${CYAN}📡 LAN:${NC}  http://${LOCAL_IP}:${CLIENT_PORT}"
    echo -e ""

    # 로그 마지막 줄
    if [ -f "$PROJECT_DIR/logs/server.log" ]; then
        LAST_LOG=$(tail -1 "$PROJECT_DIR/logs/server.log" 2>/dev/null)
        echo -e "  ${YELLOW}최근 서버 로그:${NC} ${LAST_LOG}"
    fi
else
    echo -e ""
    echo -e "  ${YELLOW}시작하려면:${NC} bash bg-start.sh"
fi

echo ""
