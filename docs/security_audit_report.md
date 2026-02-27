# 종합 코드 분석 및 보안/버그 감사 보고서

팀 프로젝트의 핵심 서버 로직(`server/index.js`, `RoomManager.js`, `UserDB.js`, `BlackjackGame.js`, `PokerGame.js`)의 소스 코드를 면밀히 분석한 결과, 아래와 같은 형태의 잠재적 버그 및 보안(어뷰징) 취약점을 발견했습니다.

특히 **CRITICAL** 및 **HIGH** 항목은 이용자가 시스템을 악용하거나, 게임이 완전히 마비될 수 있는 심각한 문제이므로 빠른 조치가 필요합니다.

---

## 🚨 1. [CRITICAL] 포커/블랙잭 동시 게임을 악용한 무한 코인 복사 (Double Spend & Loss Evasion)
- **발생 위치:** `RoomManager.js` (startGame, handleRestartGame) 및 각 미니게임 로직 (`play_minigame`)
- **원인 (상세):** 
  - 달무티(Dalmuti)나 원카드(OneCard)는 `startGame` 즉시 유저의 DB 잔고에서 입장료(참가비)를 선차감(`userDB.deductBalance`)합니다.
  - 하지만 **포커(Poker)와 블랙잭(Blackjack)**은 게임 특성상 베팅액이 유동적이므로, 현재 `UserDB`의 잔고만 게임 엔진으로 읽어온 뒤(`balance: userDB.getBalance`) **게임이 모두 끝나는 시점 (`handleRestartGame`)에만 최종 등락폭(`netResult`) 추후 정산(차감/지급)** 하도록 짜여 있습니다.
  - **악용 시나리오:**
    1. 유저 A가 10,000 코인을 들고 포커 방에 입장합니다.
    2. 포커 게임 시작 후 본인의 전 재산 10,000 코인을 "올인" 베팅합니다. (DB에서는 차감되지 않고 포커 방 안에서만 처리 중)
    3. 포커 쇼다운(결과) 대기 중에 다른 창이나 모달을 열어 **미니게임(슬롯머신/룰렛)에 나머지 10,000 코인을 전부 배팅**하여 날려버립니다.
    4. 포커 게임 결과, A가 **패배**했습니다. 
    5. `handleRestartGame`에서 서버가 DB에서 `10,000` 차감을 시도(`userDB.deductBalance`)하지만, 유저의 DB 잔고는 이미 미니게임으로 0이 되었으므로 음수 방지 로직에 의해 차감이 실패(무시)됩니다.
    6. 반대로 A가 포커에서 **승리**했다면, 미니게임으로 날린 금액과 상관없이 포커방에서 무에서 유를 창조한 `+20,000`의 상금이 DB에 즉시 지급됩니다!
- **조치 권고:** 
  이중 지불을 방지하기 위해 포커/블랙잭의 경우에도 **베팅을 할 때마다(`Call`, `Raise`, `Bet` 소켓 이벤트 발생 시점) 즉시 `userDB`에서 잔액을 차감**하고, 승리 시 한 번에 지급하는 "상시 동기화" 방식으로 구조를 변경해야 합니다.

## 🚨 2. [HIGH] 방장 이탈 시 방 통제권 영구 상실 (Host Migration 누락)
- **발생 위치:** `RoomManager.js` (`handleDisconnect`, `handleLeaveRoom`)
- **원인:** 방의 소유자(방장, `room.ownerId`)가 브라우저를 끄거나 나가기 버튼으로 나갔을 때, 남은 인원 중 한 명에게 방장 권한을 넘기는 로직이 존재하지 않습니다.
- **결과:**
  - **로비 상태(LOBBY):** 방장이 떠나도 다른 사람이 남아있을 수 있으나, 방장이 아니면 `Start Game` 버튼과 설정 조작을 할 수 없어 빈 방에 갇히게 됩니다.
  - **게임 상태(PLAYING):** 특히 포커/블랙잭의 경우 라운드 종료(`handleRestartGame`) 소켓 이벤트가 **오직 방장만** 보낼 수 있도록 하드코딩 되어 있습니다 (`room.ownerId === socket.id`). 방장이 나가버리면 살아남은 유저들이 라운드를 끝내지도, 돈을 정산받지도 못해 방이 고장납니다.
- **조치 권고:** `handleLeaveRoom` 및 `disconnect` 발생 시, 퇴장하는 유저가 `ownerId`라면 배열의 다음 0번 인덱스 유저에게 `room.ownerId = newOwnerId`를 양도하는 (Host Migration) 코드를 추가해야 합니다.

## 🟡 3. [MEDIUM] 일일 접속 보상(Daily Refill) 시간 불일치로 인한 증식 버그 (Timezone Exploit)
- **발생 위치:** `server/index.js` (`scheduleDailyRefill`) & `UserDB.js` (`checkDailyRefill`, `register`)
- **원인:**
  - `UserDB.js`에서는 최종 출석일을 **UTC 기준 날짜** (`new Date().toISOString().split('T')[0]`)로 저장 및 비교합니다. (한국 시간 아침 9시에 날짜 변경 인식)
  - 반면 `index.js`의 자동 정각 지급 타이머인 `scheduleDailyRefill`은 서버 OS의 **로컬 시간(한국 시간)** 기준 자정(`tomorrow.setHours(24,0,0,0)`)에 동작하여 10,000 코인을 일괄 지급합니다.
- **결과:**
  - 한국 시간 00시에 `index.js`가 모두에게 만원을 줍니다.
  - 9시간 뒤인 아침 09시에 서버의 UTC 날짜가 변경됩니다.
  - 코인을 이미 받은 유저가 09시 이후 로그인하면, `UserDB.js`에서 "오늘(UTC 날짜) 처음 접속했네!" 라고 판단하여 10,000원을 **한 번 더** 지급합니다. (하루 최대 2만원 지급 가능)
- **조치 권고:** 날짜를 비교하거나 타이머를 돌릴 때 반드시 둘 다 UTC 기준으로 통일하거나, 강제로 `getTimezoneOffset`을 더해 KST(한국 표준시)로 통일해야 합니다.

## 🟡 4. [MEDIUM] 게임 도중 강제 퇴장(Leave/Disconnect) 유저에 대한 배당 무효화
- **발생 위치:** `RoomManager.js` (`handleDisconnect`) 와 `PokerGame.js`
- **원인:** 게임(PLAYING) 도중 유저가 명시적인 "나가기(Leave)" 버튼을 누르거나, 인터넷이 끊어진 경우 `room.game.setPlayerConnectionStatus` 로 연결 끊김 처리만 합니다. 남은 게임 엔진들은 이 유저를 `folded` 시키거나 무시합니다.
  - 하지만 이후 라운드가 끝나서 **포커 상금을 정산(`handleRestartGame`)할 때 해당 나간 유저가 잃은 돈**을 DB에서 빼는 로직이 누락되어 있습니다(나간 유저는 방 유저목록에서 제거되거나, 콜백을 받지 않음).
  - 인터넷 선을 뽑는 '랜뽑' 행위 시, 베팅한 돈을 단 1원도 잃지 않는 기적을 볼 수 있습니다.
- **조치 권고:** 유저가 방을 나갈 때, 현재 그 사람이 포커 팟(Pot)이나 블랙잭 베팅에 기여해둔 돈(`totalBet`, `bet`)이 있다면 나가는 즉시 해당 액수만큼 `userDB`에서 차감 벌어들여야 (몰수해야) 합니다.

---

### 총평
현재 뼈대가 되는 로직(비밀번호 해싱, 플레이어 검증, 각 엔진별 독립 구현) 등은 상당히 잘 짜여 있습니다. 
하지만 **인게임 머니(잔고)와 글로벌 DB 지갑(UserDB) 사이의 동기화**가 게임 종료(쇼다운) 시점에만 한 번 이루어지는 '지연 정산(Lazy Settlement)' 방식이라 **이중 지불(Double Spend) 및 강종 무효화**라는 치명적인 약점을 안고 있습니다.

위 4가지 문제에 대한 픽스(Fix) 코드가 필요하시다면 즉시 수정된 파일을 적용해 드릴 수 있습니다. 어떤 것부터 먼저 고칠까요?
