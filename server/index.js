const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const RoomManager = require('./RoomManager');
const UserDB = require('./UserDB');

const userDB = new UserDB();
const roomManager = new RoomManager(io, userDB);

// ===== Online User Count =====
let onlineUsers = new Map(); // socketId -> { userId, username }

function broadcastOnlineCount() {
    io.emit('online_count', onlineUsers.size);
}

// ===== Daily Refill Scheduler =====
function scheduleDailyRefill() {
    const now = new Date();
    // Calculate ms until next midnight (KST = UTC+9)
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
        userDB.runDailyRefillAll();
        // Broadcast balance updates to all connected users
        for (const [socketId, userData] of onlineUsers) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket && userData.userId) {
                const user = userDB.getPublicUser(userData.userId);
                if (user) {
                    socket.emit('balance_update', { balance: user.balance });
                }
            }
        }
        // Schedule next one (every 24h)
        setInterval(() => {
            userDB.runDailyRefillAll();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    console.log(`Daily refill scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}
scheduleDailyRefill();

// ===== Socket Connection =====
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ===== Auth Events =====
    socket.on('register', ({ username, password, displayName }, callback) => {
        const result = userDB.register(username, password, displayName);
        if (result.success) {
            socket.data.userId = result.user.id;
            socket.data.username = result.user.displayName;
            socket.data.displayName = result.user.displayName;
            onlineUsers.set(socket.id, { userId: result.user.id, username: result.user.displayName });
            broadcastOnlineCount();
        }
        if (callback) callback(result);
    });

    socket.on('auth_login', ({ username, password }, callback) => {
        const result = userDB.login(username, password);
        if (result.success) {
            socket.data.userId = result.user.id;
            socket.data.username = result.user.displayName;
            socket.data.displayName = result.user.displayName;
            onlineUsers.set(socket.id, { userId: result.user.id, username: result.user.displayName });
            broadcastOnlineCount();
        }
        if (callback) callback(result);
    });

    socket.on('get_balance', (_, callback) => {
        if (socket.data.userId) {
            const balance = userDB.getBalance(socket.data.userId);
            if (callback) callback({ balance });
        }
    });

    // Legacy login (still works for backward compat)
    socket.on('login', (username) => {
        const safeName = (username || 'Guest').trim().substring(0, 16);
        socket.data.username = safeName;
        socket.data.displayName = safeName;
        socket.emit('login_success', { id: socket.id, username: safeName });
        onlineUsers.set(socket.id, { userId: null, username: safeName });
        broadcastOnlineCount();
    });

    // ===== Room Events =====
    socket.on('create_room', (data) => roomManager.createRoom(socket, data));
    socket.on('join_room', (roomId) => roomManager.joinRoom(socket, roomId));
    socket.on('start_game', (options) => roomManager.startGame(socket, options));
    socket.on('play_cards', (data) => roomManager.handlePlay(socket, data));
    socket.on('pass_turn', () => roomManager.handlePass(socket));
    socket.on('chat_message', (msg) => roomManager.handleChat(socket, msg));

    // Dalmuti specific
    socket.on('restart_game', () => roomManager.handleRestartGame(socket));
    socket.on('taxation_return', (cardIds) => roomManager.handleTaxationReturn(socket, cardIds));
    socket.on('taxation_pay', (cardIds) => roomManager.handleTaxationPay(socket, cardIds));
    socket.on('market_trade', (cardId) => roomManager.handleMarketTrade(socket, cardId));
    socket.on('leave_room', () => roomManager.handleLeaveRoom(socket));
    socket.on('market_pass', () => roomManager.handleMarketPass(socket));
    socket.on('select_seat_card', (cardId) => roomManager.handleSeatSelection(socket, cardId));
    socket.on('revolution_choice', (declare) => roomManager.handleRevolutionChoice(socket, declare));
    socket.on('debug_end_round', () => roomManager.handleDebugEndRound(socket));
    socket.on('update_settings', (settings) => roomManager.handleUpdateSettings(socket, settings));

    // OneCard specific
    socket.on('draw_card', () => roomManager.handleDrawCard(socket));
    socket.on('choose_suit', (suit) => roomManager.handleChooseSuit(socket, suit));
    socket.on('call_onecard', () => roomManager.handleCallOneCard(socket));

    // Blackjack specific
    socket.on('blackjack_bet', (amount) => roomManager.handleBlackjackBet(socket, amount));
    socket.on('blackjack_hit', () => roomManager.handleBlackjackHit(socket));
    socket.on('blackjack_stand', () => roomManager.handleBlackjackStand(socket));
    socket.on('blackjack_double', () => roomManager.handleBlackjackDouble(socket));

    // Poker specific
    socket.on('poker_fold', () => roomManager.handlePokerFold(socket));
    socket.on('poker_call', () => roomManager.handlePokerCall(socket));
    socket.on('poker_check', () => roomManager.handlePokerCheck(socket));
    socket.on('poker_raise', (amount) => roomManager.handlePokerRaise(socket, amount));
    socket.on('poker_allin', () => roomManager.handlePokerAllIn(socket));

    // Room List
    socket.on('request_room_list', () => {
        socket.emit('room_list', roomManager.getRoomListData());
    });

    // Online count request
    socket.on('request_online_count', () => {
        socket.emit('online_count', onlineUsers.size);
    });

    socket.on('disconnect', () => {
        roomManager.handleDisconnect(socket);
        onlineUsers.delete(socket.id);
        broadcastOnlineCount();
        console.log('User disconnected:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
