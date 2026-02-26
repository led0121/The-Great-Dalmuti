#!/bin/bash
# ============================================================
#  🎲 달무티 & 보드게임 라운지 - 원클릭 설치 및 실행 스크립트
#  설치 → 빌드 → 서버 시작 → 클라이언트 시작
# ============================================================

# pipefail: 파이프라인 에러도 감지
set -eo pipefail

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# 프로젝트 루트 디렉토리 (이 스크립트가 위치한 곳)
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 포트 설정
SERVER_PORT=3000
CLIENT_PORT=18000

# ============================================================
#  함수 정의
# ============================================================

print_banner() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${BOLD}🎲 달무티 & 보드게임 라운지${NC}                         ${PURPLE}║${NC}"
    echo -e "${PURPLE}║${NC}  ${CYAN}Dalmuti • OneCard • Blackjack • Poker${NC}          ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}▶${NC} ${BOLD}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}  ✅ $1${NC}"
}

print_info() {
    echo -e "${CYAN}  ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}  ❌ $1${NC}"
}

# ============================================================
#  Step 0: 사전 요구 사항 확인
# ============================================================
check_prerequisites() {
    print_step "Step 0: 사전 요구 사항 확인"

    if ! command -v node &> /dev/null; then
        print_error "Node.js가 설치되어 있지 않습니다!"
        echo -e "  ${YELLOW}설치 방법:${NC}"
        echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "    sudo apt-get install -y nodejs"
        exit 1
    fi
    NODE_VERSION=$(node -v)
    print_success "Node.js: ${NODE_VERSION}"

    if ! command -v npm &> /dev/null; then
        print_error "npm이 설치되어 있지 않습니다!"
        exit 1
    fi
    NPM_VERSION=$(npm -v)
    print_success "npm: v${NPM_VERSION}"

    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version | awk '{print $3}')
        print_success "git: v${GIT_VERSION}"
    else
        print_info "git이 설치되어 있지 않습니다 (선택 사항)"
    fi
}

# ============================================================
#  Step 1: 서버 의존성 설치
# ============================================================
install_server() {
    print_step "Step 1: 서버 패키지 설치"

    cd "$PROJECT_DIR/server"

    if [ -d "node_modules" ]; then
        print_info "기존 node_modules 발견 → 재설치합니다"
        rm -rf node_modules
    fi

    # package-lock.json이 있으면 npm ci (정확한 버전 설치), 없으면 npm install
    if [ -f "package-lock.json" ]; then
        if npm ci 2>&1; then
            print_success "서버 패키지 설치 완료 (npm ci)"
        else
            print_info "npm ci 실패, npm install로 재시도..."
            if npm install --legacy-peer-deps 2>&1; then
                print_success "서버 패키지 설치 완료"
            else
                print_error "서버 패키지 설치 실패!"
                exit 1
            fi
        fi
    else
        if npm install --legacy-peer-deps 2>&1; then
            print_success "서버 패키지 설치 완료"
        else
            print_error "서버 패키지 설치 실패!"
            exit 1
        fi
    fi

    mkdir -p "$PROJECT_DIR/server/data"
    print_success "데이터 디렉토리 준비 완료 (server/data/)"
}

# ============================================================
#  Step 2: 클라이언트 의존성 설치
# ============================================================
install_client() {
    print_step "Step 2: 클라이언트 패키지 설치"

    cd "$PROJECT_DIR/client"

    if [ -d "node_modules" ]; then
        print_info "기존 node_modules 발견 → 재설치합니다"
        rm -rf node_modules
    fi

    # package-lock.json이 있으면 npm ci (정확한 버전 설치), 없으면 npm install
    if [ -f "package-lock.json" ]; then
        if npm ci 2>&1; then
            print_success "클라이언트 패키지 설치 완료 (npm ci)"
        else
            print_info "npm ci 실패, npm install --legacy-peer-deps로 재시도..."
            if npm install --legacy-peer-deps 2>&1; then
                print_success "클라이언트 패키지 설치 완료"
            else
                print_info "npm install --force로 재시도..."
                if npm install --force 2>&1; then
                    print_success "클라이언트 패키지 설치 완료 (--force)"
                else
                    print_error "클라이언트 패키지 설치 실패!"
                    exit 1
                fi
            fi
        fi
    else
        if npm install --legacy-peer-deps 2>&1; then
            print_success "클라이언트 패키지 설치 완료"
        else
            print_info "npm install --force로 재시도..."
            if npm install --force 2>&1; then
                print_success "클라이언트 패키지 설치 완료 (--force)"
            else
                print_error "클라이언트 패키지 설치 실패!"
                exit 1
            fi
        fi
    fi
}

# ============================================================
#  Step 3: 클라이언트 빌드 (선택사항)
# ============================================================
build_client() {
    print_step "Step 3: 클라이언트 빌드 확인"

    cd "$PROJECT_DIR/client"

    # vite가 설치되어 있는지 확인
    if [ ! -f "node_modules/.bin/vite" ]; then
        print_error "vite가 설치되지 않았습니다! Step 2를 다시 확인해주세요."
        exit 1
    fi

    if npx vite build 2>&1; then
        print_success "클라이언트 빌드 완료"
    else
        print_error "빌드 실패!"
        exit 1
    fi
}

# ============================================================
#  Step 4: 포트 정리
# ============================================================

# 특정 포트의 프로세스를 종료하는 함수
kill_port() {
    local port=$1
    local found=false

    # 방법 1: fuser
    if command -v fuser &> /dev/null; then
        fuser -k ${port}/tcp > /dev/null 2>&1 && found=true
    fi

    # 방법 2: lsof
    if command -v lsof &> /dev/null; then
        lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null && found=true
    fi

    # 방법 3: ss + kill (대부분의 Linux에 기본 설치)
    if command -v ss &> /dev/null; then
        local pids=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null && found=true
        fi
    fi

    # 방법 4: /proc 기반 (최후의 수단)
    if command -v netstat &> /dev/null; then
        local pids=$(netstat -tlnp 2>/dev/null | grep ":${port}" | awk '{print $7}' | grep -oP '[0-9]+' | sort -u)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -9 2>/dev/null && found=true
        fi
    fi

    return 0
}

# 포트가 사용 중인지 확인하는 함수
is_port_in_use() {
    local port=$1

    # 방법 1: ss (가장 보편적)
    if command -v ss &> /dev/null; then
        ss -tln "sport = :${port}" 2>/dev/null | grep -q ":${port}" && return 0
    fi

    # 방법 2: fuser
    if command -v fuser &> /dev/null; then
        fuser ${port}/tcp > /dev/null 2>&1 && return 0
    fi

    # 방법 3: lsof
    if command -v lsof &> /dev/null; then
        lsof -ti:${port} > /dev/null 2>&1 && return 0
    fi

    # 방법 4: node로 직접 확인
    if command -v node &> /dev/null; then
        node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen(${port},'0.0.0.0',()=>{s.close();process.exit(0)})" 2>/dev/null
        return $?
    fi

    return 1  # 사용 중이 아님
}

cleanup_ports() {
    print_step "Step 4: 포트 정리"

    local ports=($SERVER_PORT $CLIENT_PORT)

    for port in "${ports[@]}"; do
        if is_port_in_use $port; then
            print_info "포트 ${port} 사용 중 → 종료 시도..."
            kill_port $port
            sleep 2

            # 재확인
            if is_port_in_use $port; then
                print_info "포트 ${port} 강제 종료 재시도 (SIGKILL)..."
                kill_port $port
                sleep 3

                if is_port_in_use $port; then
                    print_error "포트 ${port}을 해제할 수 없습니다!"
                    print_info "수동으로 해제하세요: kill -9 \$(lsof -ti:${port}) 또는 fuser -k -9 ${port}/tcp"
                    exit 1
                fi
            fi
            print_success "포트 ${port} 정리 완료"
        else
            print_success "포트 ${port} 사용 가능"
        fi
    done
}

# ============================================================
#  Step 5: 서버 & 클라이언트 실행
# ============================================================
start_app() {
    print_step "Step 5: 서버 & 클라이언트 실행"

    # 서버 시작
    cd "$PROJECT_DIR/server"
    node index.js &
    SERVER_PID=$!
    sleep 2

    # 서버가 살아있는지 확인
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        print_error "서버 시작 실패! 로그를 확인해주세요."
        exit 1
    fi
    print_success "서버 시작 (PID: ${SERVER_PID}, 포트: ${SERVER_PORT})"

    # 클라이언트 시작
    cd "$PROJECT_DIR/client"
    HOST=0.0.0.0 npx vite --host --port ${CLIENT_PORT} &
    CLIENT_PID=$!
    sleep 2

    # 클라이언트가 살아있는지 확인
    if ! kill -0 $CLIENT_PID 2>/dev/null; then
        print_error "클라이언트 시작 실패! 로그를 확인해주세요."
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    print_success "클라이언트 시작 (PID: ${CLIENT_PID}, 포트: ${CLIENT_PORT})"

    # LAN IP 주소 가져오기
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}🎉 모든 준비가 완료되었습니다!${NC}                    ${GREEN}║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}📌 로컬 접속:${NC}                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}     http://localhost:${CLIENT_PORT}                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}📡 LAN 접속 (같은 네트워크):${NC}                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}     http://${LOCAL_IP}:${CLIENT_PORT}                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}🎮 지원 게임:${NC}                                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}     👑 달무티  🃏 원카드                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}     🂡 블랙잭  ♠️ 포커                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${RED}Ctrl+C${NC} 를 눌러 종료합니다                       ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    # 종료 시 프로세스 정리
    cleanup() {
        echo ""
        echo -e "${YELLOW}🛑 서버를 종료합니다...${NC}"
        kill $SERVER_PID 2>/dev/null
        kill $CLIENT_PID 2>/dev/null
        pkill -P $SERVER_PID 2>/dev/null || true
        pkill -P $CLIENT_PID 2>/dev/null || true
        echo -e "${GREEN}✅ 종료 완료${NC}"
        exit 0
    }

    trap cleanup SIGINT SIGTERM

    # 프로세스 유지
    wait
}

# ============================================================
#  옵션 파싱
# ============================================================
show_help() {
    print_banner
    echo "사용법: bash setup.sh [옵션]"
    echo ""
    echo "옵션:"
    echo "  (없음)       전체 설치 + 빌드 + 실행"
    echo "  --install    설치만 (실행하지 않음)"
    echo "  --start      실행만 (이미 설치된 경우)"
    echo "  --help       이 도움말 표시"
    echo ""
    echo "예시:"
    echo "  bash setup.sh              # 처음 설치 시 (전체)"
    echo "  bash setup.sh --install    # 패키지 재설치만"
    echo "  bash setup.sh --start      # 바로 실행"
    echo ""
}

# ============================================================
#  메인 실행
# ============================================================
main() {
    print_banner

    case "${1:-}" in
        --help|-h)
            show_help
            exit 0
            ;;
        --install)
            check_prerequisites
            install_server
            install_client
            build_client
            echo ""
            print_success "설치 완료! 실행하려면: bash setup.sh --start"
            ;;
        --start)
            check_prerequisites
            cleanup_ports
            start_app
            ;;
        *)
            # 전체 설치 + 실행
            check_prerequisites
            install_server
            install_client
            build_client
            cleanup_ports
            start_app
            ;;
    esac
}

main "$@"
