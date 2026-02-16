const io = require('socket.io-client');

const PORT = 3000;
const URL = `http://localhost:${PORT}`;

// Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class Bot {
    constructor(name) {
        this.name = name;
        this.socket = null;
        this.state = null;
        this.hand = [];
        this.id = null;
    }

    async connect() {
        return new Promise((resolve) => {
            this.socket = io(URL, { forceNew: true, reconnection: false });
            this.socket.on('connect', () => {
                this.id = this.socket.id;
                console.log(`[${this.name}] Connected (${this.id})`);
                this.socket.emit('login', this.name); // Required for server to set socket.data.username
                resolve();
            });
            this.socket.on('disconnect', () => console.log(`[${this.name}] Disconnected`));
            this.socket.on('error', (err) => console.error(`[${this.name}] Socket Error:`, err));
            this.socket.on('game_update', (state) => {
                this.state = state;
                // Update my hand if available (server sends 'myHand' or injected 'hand')
                const me = state.players.find(p => p.id === this.id);
                if (me && me.hand) this.hand = me.hand;
            });
        });
    }

    joinRoom(roomId) {
        this.socket.emit('join_room', roomId);
    }

    createRoom() {
        this.socket.emit('create_room', `${this.name}'s Room`);
    }

    selectSeat(cardId) {
        this.socket.emit('select_seat_card', cardId);
    }

    leaveRoom() {
        this.socket.emit('leave_room');
    }
}

// Scenarios
async function scenarioManyPlayers() {
    console.log("\n=== SCENARIO: 6 Players Game Start ===");
    const bots = [];
    for (let i = 0; i < 6; i++) {
        const bot = new Bot(`Bot${i + 1}`);
        await bot.connect();
        bots.push(bot);
    }

    const host = bots[0];
    let roomId = null;

    // Capture Room ID
    host.socket.on('room_update', (room) => {
        console.log(`[Host] Room Joined: ${room.id}`);
        roomId = room.id;
    });
    host.createRoom();

    let attempts = 0;
    while (!roomId && attempts < 20) {
        await sleep(100);
        attempts++;
    }

    if (!roomId) {
        console.error("FAILED: Could not create room.");
        process.exit(1);
    }
    console.log(`Room Created: ${roomId}`);

    // Others Join
    console.log("Bots joining...");
    for (let i = 1; i < 6; i++) {
        bots[i].joinRoom(roomId);
        await sleep(100);
    }

    // Start
    console.log("Starting Game...");
    host.socket.emit('start_game');

    // Wait for Seat Selection
    console.log("Waiting for state update...");
    await sleep(2000);

    if (host.state) {
        console.log(`Current Phase: ${host.state.phase}`);
        if (host.state.phase === 'SEAT_SELECTION') {
            console.log("\n✅ SUCCESS: Entered Seat Selection with 6 players.");
            console.log(`Seat Deck Count: ${host.state.seatDeck.length} (Expected 6)`);
        } else {
            console.error(`❌ FAILED: Incorrect Phase. Expected SEAT_SELECTION, got ${host.state.phase}`);
        }
    } else {
        console.error("❌ FAILED: No Game State received.");
    }

    // Clean up
    bots.forEach(b => b.socket.disconnect());
}

async function scenarioSpectator() {
    console.log("\n=== SCENARIO: Spectator Join ===");
    const bots = [];
    for (let i = 0; i < 4; i++) {
        const bot = new Bot(`Player${i + 1}`);
        await bot.connect();
        bots.push(bot);
    }

    const host = bots[0];
    let roomId = null;
    host.socket.on('room_update', (room) => { if (!roomId) roomId = room.id; });
    host.createRoom();
    while (!roomId) await sleep(100);

    for (let i = 1; i < 4; i++) bots[i].joinRoom(roomId);

    host.socket.emit('start_game');
    await sleep(2000);
    console.log("Game Started.");

    // Spectator Connects
    const spectator = new Bot("Spectator");
    await spectator.connect();
    spectator.joinRoom(roomId);
    await sleep(1000);

    // Verify
    const specState = spectator.state;
    if (specState && specState.phase === 'SEAT_SELECTION') {
        console.log("SUCCESS: Spectator joined active game.");
        // Check local player list logic (Spectator shouldn't be in main players list if game active? 
        // Actually Dalmuti usually adds late joiners to 'waitingPlayers')
        // Let's check waitingPlayers
        const waiting = specState.waitingPlayers || [];
        const isWaiting = waiting.find(p => p.username === 'Spectator');

        if (isWaiting) {
            console.log("SUCCESS: Spectator is in waiting list.");
        } else {
            // Depending on implementation, might be in players but 'finished'?
            console.log("Spectator status check:", waiting.length > 0 ? "In Waiting" : "Unknown");
        }
    } else {
        console.error("FAILED: Spectator did not receive game state.");
    }

    bots.forEach(b => b.socket.disconnect());
    spectator.socket.disconnect();
}

async function scenarioLeave() {
    console.log("\n=== SCENARIO: Player Leave Functionality ===");
    const bots = [];
    const PLAYER_COUNT = 3;
    for (let i = 0; i < PLAYER_COUNT; i++) {
        const bot = new Bot(`Player${i + 1}`);
        await bot.connect();
        bots.push(bot);
    }

    const host = bots[0];
    const leaver = bots[1];

    let roomId = null;
    host.socket.on('room_update', (room) => { if (!roomId) roomId = room.id; });
    host.createRoom();
    while (!roomId) await sleep(100);
    console.log(`Room Created: ${roomId}`);

    for (let i = 1; i < PLAYER_COUNT; i++) bots[i].joinRoom(roomId);

    console.log("Starting Game...");
    host.socket.emit('start_game');
    await sleep(2000);

    // Verify initial state
    if (host.state && host.state.players.length === 3) {
        console.log("Game started with 3 players.");
    }

    // Leaver leaves room explicitly
    console.log(`Player ${leaver.name} leaving room...`);
    leaver.leaveRoom();

    await sleep(1000);

    // Check host state
    // In 'PLAYING' phase, leaving usually marks as disconnected but keeps player in list?
    // Or if handleDisconnect triggers, it sets connected=false.
    // Let's check status.
    const leaverState = host.state.players.find(p => p.username === leaver.name);
    if (leaverState) {
        if (leaverState.connected === false) {
            console.log("✅ SUCCESS: Leaver marked as disconnected (OFFLINE).");
        } else {
            console.error("❌ FAILED: Leaver still marked as connected.");
        }
    } else {
        // If removed entirely (e.g. if lobby logic applied?)
        console.error("❌ FAILED: Leaver removed from player list (Should remain as Offline in Playing Phase).");
    }

    // Check if Turn Skipping works (Optional re-verification)
    // If it was Leaver's turn, it should pass?
    // We already tested disconnection, this tests the 'leave_room' event specifically triggering it.

    bots.forEach(b => b.socket.disconnect());
}

async function scenarioDisconnectTurn() {
    console.log("\n=== SCENARIO: Disconnect During Turn ===");
    const bots = [];
    const PLAYER_COUNT = 3;
    for (let i = 0; i < PLAYER_COUNT; i++) {
        const bot = new Bot(`Player${i + 1}`);
        await bot.connect();
        bots.push(bot);
    }

    const host = bots[0];
    let roomId = null;
    host.socket.on('room_update', (room) => { if (!roomId) roomId = room.id; });
    host.createRoom();
    while (!roomId) await sleep(100);
    console.log(`Room Created: ${roomId}`);

    for (let i = 1; i < PLAYER_COUNT; i++) bots[i].joinRoom(roomId);

    console.log("Starting Game...");
    host.socket.emit('start_game');

    // Pick Seats
    console.log("Waiting for Seat Selection phase...");
    await sleep(3000); // Wait for Seat Selection phase
    if (host.state && host.state.phase === 'SEAT_SELECTION') {
        const seatDeck = host.state.seatDeck.map(c => c.id);
        bots.forEach((b, i) => b.selectSeat(seatDeck[i]));
    }

    // Wait for PLAYING by checking state loop
    let phase = '';
    let attempts = 0;
    while (phase !== 'PLAYING' && attempts < 30) {
        await sleep(1000);
        attempts++;
        if (host.state) {
            phase = host.state.phase;
            if (host.state.selectedSeats) {
                console.log(`[Wait PLAYING] Phase: ${phase}, Seats: ${host.state.selectedSeats.length}/${PLAYER_COUNT}`);
            }
            if (phase === 'TAXATION' || phase === 'REVOLUTION_CHOICE') {
                console.log(`Entered ${phase} phase. Skipping full gameplay simulation (Data exchange required).`);
                break;
            }
        }
    }

    if (host.state?.phase === 'PLAYING') {
        console.log("Entered PLAYING phase. Disconnecting Turn Player...");
        const turnPlayerId = host.state.currentTurn;
        const turnBot = bots.find(b => b.id === turnPlayerId);

        if (turnBot) {
            turnBot.socket.disconnect();
            await sleep(3000);

            const nextTurnId = host.state.currentTurn;
            if (nextTurnId !== turnPlayerId) {
                console.log(`✅ SUCCESS: Turn passed from disconnected player to ${nextTurnId}`);
            } else {
                console.error(`❌ FAILED: Turn did not pass.`);
            }
        }
    } else if (host.state?.phase === 'TAXATION' || host.state?.phase === 'REVOLUTION_CHOICE') {
        console.log("⚠️ SKIPPED: Disconnect logic (Requires Playing Phase, but got Taxation/Revolution).");
    } else {
        console.log("Could not reach PLAYING phase.");
    }

    bots.forEach(b => { if (b.socket.connected) b.socket.disconnect(); });
}

async function scenarioNextRound() {
    console.log("\n=== SCENARIO: 2nd Round (N-th Game) ===");
    const bots = [];
    for (let i = 0; i < 4; i++) {
        const bot = new Bot(`Bot${i + 1}`);
        await bot.connect();
        bots.push(bot);
    }

    const host = bots[0];
    let roomId = null;
    host.socket.on('room_update', (room) => { if (!roomId) roomId = room.id; });
    host.createRoom();
    while (!roomId) await sleep(100);

    for (let i = 1; i < 4; i++) bots[i].joinRoom(roomId);
    host.socket.emit('start_game');

    // Seat Selection
    await sleep(2000);
    if (host.state?.phase === 'SEAT_SELECTION') {
        const seatDeck = host.state.seatDeck.map(c => c.id);
        bots.forEach((b, i) => b.selectSeat(seatDeck[i]));
    }

    console.log("Waiting for Round 1 start...");
    await sleep(5000);

    // Check Ranks
    if (host.state?.players[0].rank) {
        console.log("Ranks assigned.");
    }

    // FORCE END ROUND to get to Round 2
    console.log("Triggering Debug End Round...");
    host.socket.emit('debug_end_round');

    console.log("Wait for round transition timer (10s)...");
    await sleep(12000);

    if (host.state?.round === 2) {
        console.log("✅ SUCCESS: Advanced to Round 2.");
        if (host.state.phase === 'TAXATION' || host.state.phase === 'REVOLUTION_CHOICE') {
            console.log(`Phase: ${host.state.phase} (Expected TAXATION or REVOLUTION_CHOICE) - OK`);
        } else {
            console.error(`❌ FAILED: Phase is ${host.state.phase} (Expected TAXATION or REVOLUTION_CHOICE)`);
        }
    } else {
        console.error(`❌ FAILED: Round is ${host.state?.round} (Expected 2)`);
    }

    bots.forEach(b => b.socket.disconnect());
}

async function scenarioSettings() {
    console.log("\n=== SCENARIO: Game Settings Validation ===");
    const host = new Bot("HostBot");
    await host.connect();

    let roomId = null;
    let roomSettings = null;

    host.socket.on('room_update', (room) => {
        if (!roomId) roomId = room.id;
        roomSettings = room.settings;
        console.log(`[Host] Room Settings Updated: Timer=${room.settings.timerDuration}`);
    });

    host.createRoom();
    while (!roomId) await sleep(100);
    console.log(`Room Created: ${roomId}`);

    // Default Check
    await sleep(500);
    if (roomSettings.timerDuration === 30) {
        console.log("✅ SUCCESS: Default timer is 30s");
    } else {
        console.error(`❌ FAILED: Default timer is ${roomSettings.timerDuration}`);
    }

    // Test Valid Update
    console.log("Updating timer to 15s...");
    host.socket.emit('update_settings', { timerDuration: 15 });
    await sleep(500);
    if (roomSettings.timerDuration === 15) {
        console.log("✅ SUCCESS: Timer updated to 15s");
    } else {
        console.error(`❌ FAILED: Timer is ${roomSettings.timerDuration}`);
    }

    // Test Under Limit (< 5)
    console.log("Updating timer to 2s (Should cap to 5s)...");
    host.socket.emit('update_settings', { timerDuration: 2 });
    await sleep(500);
    if (roomSettings.timerDuration === 5) {
        console.log("✅ SUCCESS: Timer capped at 5s");
    } else {
        console.error(`❌ FAILED: Timer is ${roomSettings.timerDuration}`);
    }

    // Test Over Limit (> 30)
    console.log("Updating timer to 100s (Should cap to 30s)...");
    host.socket.emit('update_settings', { timerDuration: 100 });
    await sleep(500);
    if (roomSettings.timerDuration === 30) {
        console.log("✅ SUCCESS: Timer capped at 30s");
    } else {
        console.error(`❌ FAILED: Timer is ${roomSettings.timerDuration}`);
    }

    host.socket.disconnect();
}

async function scenarioTransition() {
    console.log("\n=== SCENARIO: 2nd Round Transition Check (Mock) ===");
    console.log("NOTE: Full game play validation is complex to automate.");
    console.log("This test verifies that if we simulate 'End Round', we go to Taxation.");

    // This requires a Mock/Dev event on server to force End Round, 
    // OR we just trust the unit tests/manual tests we did.
    // I will skip 'forcing' it here to avoid corrupting the server with test code.
    console.log("Skipping automated play-through. Please use 'scenarioManyPlayers' to verify initial setup.");
}

// Main Runner
(async () => {
    const args = process.argv.slice(2);
    let mode = 'all';

    // Simple arg parsing
    args.forEach(arg => {
        if (arg.startsWith('--scenario=')) {
            mode = arg.split('=')[1];
        }
    });

    console.log(`Running Scenario Mode: ${mode}`);

    if (mode === 'many' || mode === 'all') await scenarioManyPlayers();
    if (mode === 'spectator' || mode === 'all') await scenarioSpectator();
    if (mode === 'disconnect' || mode === 'all') await scenarioDisconnectTurn();
    if (mode === 'nextRound' || mode === 'all') await scenarioNextRound();
    if (mode === 'settings' || mode === 'all') await scenarioSettings();
    if (mode === 'leave' || mode === 'all') await scenarioLeave();

    console.log("\nTest Suite Completed.");
    process.exit(0);
})();
