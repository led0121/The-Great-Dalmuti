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

// ===== Helper Function =====
function handleDuplicateLogin(userId, currentSocketId) {
    let duplicateFound = false;
    for (const [socketId, userData] of onlineUsers.entries()) {
        if (userData.userId === userId && socketId !== currentSocketId) {
            const existingSocket = io.sockets.sockets.get(socketId);
            if (existingSocket) {
                // Send warning to the existing socket
                existingSocket.emit('force_logout', '다른 장소에서 로그인 되었습니다. 기존 연결이 끊어집니다.');
                existingSocket.disconnect(true);
            }
            onlineUsers.delete(socketId);
            duplicateFound = true;
        }
    }
    return duplicateFound;
}

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
            // Check for previous sessions and disconnect them
            const hasDuplicate = handleDuplicateLogin(result.user.id, socket.id);
            if (hasDuplicate) {
                socket.emit('error', '기존 로그인된 기기에서 연결을 끊고 새로 접속했습니다.');
            }

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
            // Check for previous sessions and disconnect them
            const hasDuplicate = handleDuplicateLogin(result.user.id, socket.id);
            if (hasDuplicate) {
                socket.emit('error', '기존 로그인된 기기에서 연결을 끊고 새로 접속했습니다.');
            }

            onlineUsers.set(socket.id, { userId: result.user.id, username: result.user.displayName });
            broadcastOnlineCount();
        }
        if (callback) callback(result);
    });

    socket.on('auth_find_account', ({ displayName }, callback) => {
        const result = userDB.findAccount(displayName);
        if (callback) callback(result);
    });

    socket.on('auth_reset_password', ({ username, displayName, newPassword }, callback) => {
        const result = userDB.resetPassword(username, displayName, newPassword);
        if (callback) callback(result);
    });

    socket.on('auth_update_account', ({ newDisplayName, currentPassword, newPassword }, callback) => {
        if (!socket.data.userId) return callback({ success: false, error: 'Not logged in' });
        const result = userDB.updateAccount(socket.data.userId, newDisplayName, currentPassword, newPassword);
        if (result.success) {
            socket.data.displayName = result.user.displayName;
            socket.data.username = result.user.displayName;
        }
        if (callback) callback(result);
    });

    socket.on('get_balance', (_, callback) => {
        if (socket.data.userId) {
            const balance = userDB.getBalance(socket.data.userId);
            if (callback) callback({ balance });
        }
    });

    // Stats & Profile
    socket.on('get_profile', (targetUserId, callback) => {
        const userId = targetUserId || socket.data.userId;
        if (userId) {
            const profile = userDB.getProfile(userId);
            if (callback) callback(profile);
        }
    });

    socket.on('get_stats', (_, callback) => {
        if (socket.data.userId) {
            const stats = userDB.getStats(socket.data.userId);
            if (callback) callback(stats);
        }
    });

    socket.on('get_game_history', ({ limit } = {}, callback) => {
        if (socket.data.userId) {
            const history = userDB.getGameHistory(socket.data.userId, limit || 20);
            if (callback) callback(history);
        }
    });

    socket.on('get_leaderboard', ({ sortBy, limit } = {}, callback) => {
        const leaderboard = userDB.getLeaderboard(sortBy || 'winRate', limit || 10);
        if (callback) callback(leaderboard);
    });

    socket.on('play_minigame', ({ gameType, betAmount, extraData }, callback) => {
        if (!socket.data.userId) {
            if (callback) callback({ success: false, error: 'Not logged in' });
            return;
        }

        const validBet = parseInt(betAmount);
        if (isNaN(validBet) || validBet <= 0) {
            if (callback) callback({ success: false, error: 'Invalid bet' });
            return;
        }

        if (!userDB.deductBalance(socket.data.userId, validBet)) {
            if (callback) callback({ success: false, error: 'Insufficient funds' });
            return;
        }

        let payout = 0;
        let resultData = {};

        if (gameType === 'slot') {
            const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
            const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
            const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
            const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

            resultData.reels = [reel1, reel2, reel3];

            if (reel1 === reel2 && reel2 === reel3) {
                if (reel1 === '7️⃣') payout = validBet * 20;
                else if (reel1 === '💎') payout = validBet * 10;
                else payout = validBet * 5;
                resultData.message = 'JACKPOT';
            } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
                payout = validBet; // 1x payout (just money back for 2 matching) to cap player EV at 84%
                resultData.message = 'MINOR';
            } else {
                payout = 0;
                resultData.message = 'LOSE';
            }
        } else if (gameType === 'roulette') {
            const num = Math.floor(Math.random() * 15); // 0=green, 1-7=red, 8-14=black
            let color = 'green';
            if (num >= 1 && num <= 7) color = 'red';
            if (num >= 8 && num <= 14) color = 'black';

            resultData.number = num;
            resultData.color = color;

            const predictedColor = extraData?.color;
            if (predictedColor === color) {
                payout = color === 'green' ? validBet * 14 : validBet * 2;
                resultData.message = 'WIN';
            } else {
                payout = 0;
                resultData.message = 'LOSE';
            }
        }

        if (payout > 0) {
            userDB.addBalance(socket.data.userId, payout);
        }

        // Add to stats
        userDB.recordGameResult(socket.data.userId, {
            gameType: gameType,
            result: payout > validBet ? 'win' : payout === validBet ? 'draw' : 'lose',
            earnings: payout,
            spent: validBet,
            details: resultData
        });

        const newBalance = userDB.getBalance(socket.data.userId);

        // Notify user of new balance
        socket.emit('balance_update', { balance: newBalance });
        // Also inform all sockets of this user (if multiple)
        const allSockets = Array.from(io.sockets.sockets.values());
        for (const s of allSockets) {
            if (s.data.userId === socket.data.userId && s.id !== socket.id) {
                s.emit('balance_update', { balance: newBalance });
            }
        }

        if (callback) {
            callback({
                success: true,
                payout,
                resultData,
                newBalance
            });
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
