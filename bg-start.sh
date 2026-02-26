#!/bin/bash
# ============================================================
#  🎰 달무티 & 카지노 게임 - 백그라운드 실행 스크립트
#  서버와 클라이언트를 백그라운드에서 실행합니다.
#  종료하려면: bash bg-stop.sh
# ============================================================

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# 프로젝트 루트 (이 스크립트가 있는 폴더)
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.game.pid"
LOG_DIR="$PROJECT_DIR/logs"
SERVER_PORT=3000
CLIENT_PORT=18000

# ============================================================
#  이미 실행 중인지 확인
# ============================================================
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(sed -n '1p' "$PID_FILE")
    CLIENT_PID=$(sed -n '2p' "$PID_FILE")

    # 프로세스가 아직 살아있는지 확인
    if kill -0 "$SERVER_PID" 2>/dev/null || kill -0 "$CLIENT_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  이미 실행 중입니다!${NC}"
        echo -e "  서버 PID: ${SERVER_PID}"
        echo -e "  클라이언트 PID: ${CLIENT_PID}"
        echo -e ""
        echo -e "  종료: ${CYAN}bash bg-stop.sh${NC}"
        echo -e "  재시작: ${CYAN}bash bg-stop.sh && bash bg-start.sh${NC}"
        exit 1
    fi
    # 이전 PID 파일이 있지만 프로세스가 죽어있음 → 정리
    rm -f "$PID_FILE"
fi

# ============================================================
#  로그 디렉토리 생성
# ============================================================
mkdir -p "$LOG_DIR"

# ============================================================
#  포트 정리 함수
# ============================================================
kill_port() {
    local port=$1
    if command -v fuser &> /dev/null; then
        fuser -k ${port}/tcp > /dev/null 2>&1 || true
    fi
    if command -v lsof &> /dev/null; then
        lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
    if command -v ss &> /dev/null; then
        local pids=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
        [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
    if command -v netstat &> /dev/null; then
        local pids=$(netstat -tlnp 2>/dev/null | grep ":${port}" | awk '{print $7}' | grep -oP '[0-9]+' | sort -u)
        [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
}

is_port_in_use() {
    local port=$1
    if command -v ss &> /dev/null; then
        ss -tln "sport = :${port}" 2>/dev/null | grep -q ":${port}" && return 0
    fi
    if command -v fuser &> /dev/null; then
        fuser ${port}/tcp > /dev/null 2>&1 && return 0
    fi
    if command -v lsof &> /dev/null; then
        lsof -ti:${port} > /dev/null 2>&1 && return 0
    fi
    if command -v node &> /dev/null; then
        node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen(${port},'0.0.0.0',()=>{s.close();process.exit(0)})" 2>/dev/null
        return $?
    fi
    return 1
}

echo -e "${YELLOW}🔧 포트 정리 중...${NC}"
for port in $SERVER_PORT $CLIENT_PORT; do
    if is_port_in_use $port; then
        kill_port $port
        sleep 2
        if is_port_in_use $port; then
            kill_port $port
            sleep 3
        fi
    fi
done

# ============================================================
#  서버 시작 (백그라운드)
# ============================================================
echo -e "${CYAN}🚀 서버 시작 중...${NC}"
cd "$PROJECT_DIR/server"
nohup node index.js > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
sleep 3

# 서버가 정상 시작되었는지 확인
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}  ❌ 서버 시작 실패! 로그를 확인하세요: $LOG_DIR/server.log${NC}"
    cat "$LOG_DIR/server.log" 2>/dev/null | tail -10
    rm -f "$PID_FILE"
    exit 1
fi
echo -e "${GREEN}  ✅ 서버 시작됨 (PID: ${SERVER_PID})${NC}"

# ============================================================
#  클라이언트 시작 (백그라운드)
# ============================================================
echo -e "${CYAN}🚀 클라이언트 시작 중...${NC}"
cd "$PROJECT_DIR/client"
nohup env HOST=0.0.0.0 npm run dev -- --host --port ${CLIENT_PORT} > "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID=$!
echo -e "${GREEN}  ✅ 클라이언트 시작됨 (PID: ${CLIENT_PID})${NC}"

# ============================================================
#  PID 저장
# ============================================================
echo "$SERVER_PID" > "$PID_FILE"
echo "$CLIENT_PID" >> "$PID_FILE"

sleep 2

# LAN IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

# ============================================================
#  완료 안내
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}🎉 백그라운드 실행 완료!${NC}                        ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}📌 접속 주소:${NC}                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     로컬: http://localhost:${CLIENT_PORT}              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     LAN:  http://${LOCAL_IP}:${CLIENT_PORT}             ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${YELLOW}📄 로그 확인:${NC}                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     서버:    tail -f logs/server.log              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     클라이언트: tail -f logs/client.log           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${RED}🛑 종료:${NC}  bash bg-stop.sh                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ${PURPLE}🔄 상태:${NC}  bash bg-status.sh                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  서버 PID: ${SERVER_PID}                                   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  클라이언트 PID: ${CLIENT_PID}                              ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
