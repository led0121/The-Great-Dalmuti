export const translations = {
    ko: {
        // App / Common
        appTitle: "위대한 달무티",
        loading: "로딩 중...",

        // Login
        enterNameLabel: "닉네임을 입력하세요",
        namePlaceholder: "홍길동",
        enterGameBtn: "게임 입장",

        // Lobby
        welcome: "환영합니다, {name}님",
        createRoomTitle: "방 만들기",
        roomNamePlaceholder: "방 이름",
        turnTimerLabel: "턴 시간 (초):",
        createBtn: "생성",
        joinTitle: "ID로 입장",
        roomIdPlaceholder: "방 ID",
        joinBtn: "입장",
        activeRoomsTitle: "대기 중인 방",
        refreshBtn: "새로고침",
        noRooms: "생성된 방이 없습니다. 새로운 방을 만들어보세요!",
        players: "{count}명",

        // Room List Item
        statusLobby: "대기중",
        statusPlaying: "게임중",
        spectateBtn: "관전하기",

        // Game Room
        roomInfo: "방: {roomId} | 유저: {username}",
        spectatorLabel: "(관전모드)",
        waitingMessage: "👁️ 관전 중 - 다음 라운드부터 참여합니다!",
        hostLabel: "방장",
        startGameBtn: "게임 시작",
        waitingHost: "방장이 게임을 시작하기를 기다리고 있습니다...",
        gameSettings: "게임 설정",
        leaveRoomBtn: "방 나가기",
        howToPlayBtn: "게임 방법",

        // Seat Selection
        chooseDestiny: "운명을 선택하세요",
        challengerSelection: "새로운 도전자 등장!",
        challengerMessage: "도전자들이 농노와 자리를 두고 경쟁합니다!",
        determiningRanks: "계급 정하는 중... 게임 시작!",

        // Roles
        roleDalmuti: "총리 (Dalmuti)", // Rank 1
        roleLesserDalmuti: "부총리 (Lessor Dalmuti)", // Rank 2
        roleMerchant: "상인 (Merchant)",
        roleLesserPeon: "하인 (Lessor Peon)",
        rolePeon: "농노 (Great Peon)", // Last

        // Game Actions
        playBtn: "카드 내기 ({count})",
        passBtn: "패스",
        tradeBtn: "교환 (1장)",
        donePassBtn: "완료 / 패스",
        returnCardsBtn: "카드 반납",

        // Game Notices
        tableEmpty: "테이블이 비었습니다",
        yourTurn: "당신의 턴입니다!",
        opponentsTurn: "{name}님의 턴",
        taxationPhase: "세금 징수 (Taxation)",
        marketPhase: "시장 거래 (Market) ({time}초)",
        rank1TaxMsg: "귀족이여! 농노에게 돌려줄 카드를 선택하세요.",
        peonTaxMsg: "농노여! 귀족에게 바칠 세금을 선택하세요.",
        payTaxBtn: "세금 납부",
        rankLastTaxMsg: "세금을 내는 중입니다... 잠시만 기다려주세요.",
        taxWatching: "세금 납부 지켜보는 중...",
        marketActive: "거래 참여자: {count}명",

        // End Screen
        gameOver: "게임 종료",
        winner: "승자: {name}",
        nextRoundBtn: "다음 라운드",

        // Chat
        chatTitle: "채팅방 ✥",
        chatPlaceholder: "메시지 입력...",
        sendBtn: "전송",
        revolutionTitle: "혁명인가?!",
        revolutionPrompt: "조커 2장을 사용하여 혁명을 일으키겠습니까?",
        revolutionYes: "혁명 선포! (🔥)",
        revolutionNo: "조용히 넘어가기",
        revolutionDesc: "혁명을 선포하면 조커 2장을 버리고 최고 계급과 최하 계급이 뒤바뀝니다! (세금 면제)",
        revolutionWaiting: "누군가 혁명을 고민하고 있습니다...",
    },
    en: {
        // App / Common
        appTitle: "Great Dalmuti",
        loading: "Loading...",

        // Login
        enterNameLabel: "Enter Your Name",
        namePlaceholder: "Guest",
        enterGameBtn: "Enter Game",

        // Lobby
        welcome: "Welcome, {name}",
        createRoomTitle: "Create a New Room",
        roomNamePlaceholder: "Room Name",
        turnTimerLabel: "Turn Timer (sec):",
        createBtn: "Create",
        joinTitle: "Join by ID",
        roomIdPlaceholder: "Room ID",
        joinBtn: "Join",
        activeRoomsTitle: "Active Rooms",
        refreshBtn: "Refresh",
        noRooms: "No active rooms found... Create one!",
        players: "{count} Players",

        // Room List Item
        statusLobby: "LOBBY",
        statusPlaying: "PLAYING",
        spectateBtn: "Spectate",

        // Game Room
        roomInfo: "Room: {roomId} | User: {username}",
        spectatorLabel: "(Spectator)",
        waitingMessage: "👁️ Spectating - You will join next round!",
        hostLabel: "HOST",
        startGameBtn: "Start Game",
        waitingHost: "Waiting for host to start...",
        gameSettings: "Game Settings",
        leaveRoomBtn: "Leave Room",
        howToPlayBtn: "How to Play?",

        // Seat Selection
        chooseDestiny: "Choose Your Destiny",
        challengerSelection: "New Challenger Selection!",
        challengerMessage: "Newcomers are challenging the Great Peon for the starting rank!",
        determiningRanks: "Determining Ranks... Game Starting!",

        // Roles
        roleDalmuti: "Great Dalmuti",
        roleLesserDalmuti: "Lesser Dalmuti",
        roleMerchant: "Merchant",
        roleLesserPeon: "Lesser Peon",
        rolePeon: "Great Peon",

        // Game Actions
        playBtn: "Play Cards ({count})",
        passBtn: "Pass",
        tradeBtn: "TRADE (1 Card)",
        rank1TaxMsg: "Noble! Return 2 cards to the Peon.",
        peonTaxMsg: "Peon! Pay your tax to the Noble.",
        payTaxBtn: "Pay Tax",
        returnCardsBtn: "Return Cards", // This key is kept here as it was in the original "Game Actions"
        donePassBtn: "Done / Pass",

        // Game Notices
        tableEmpty: "TABLE EMPTY",
        yourTurn: "YOUR TURN!",
        opponentsTurn: "{name}'s Turn",
        taxationPhase: "Taxation",
        returnCardsBtn: "Pay Tax",
        taxWatching: "Taxation in progress...",
        rank1TaxMsg: "Collect Tax! Choose cards to return.",
        rankLastTaxMsg: "Paying taxes (Auto).",
        // Market
        marketPhase: "Market Time ({time})",
        marketActive: "Active Traders: {count}",

        // End Screen
        gameOver: "GAME OVER",
        winner: "Winner: {name}",
        nextRoundBtn: "Next Round",

        // Chat
        chatTitle: "Room Chat ✥",
        chatPlaceholder: "Type a message...",
        sendBtn: "Send",
        // Revolution
        revolutionTitle: "REVOLUTION?!",
        revolutionPrompt: "Do you want to use 2 Jokers to start a Revolution?",
        revolutionYes: "DECLARE REVOLUTION! (🔥)",
        revolutionNo: "Stay Quiet",
        revolutionDesc: "Declaring Revolution discards 2 Jokers and swaps the highest and lowest ranks! (No Tax)",
        revolutionWaiting: "Someone is considering a Revolution...",
    }
}
