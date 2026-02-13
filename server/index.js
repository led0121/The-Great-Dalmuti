const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // For development mostly
        methods: ["GET", "POST"]
    }
});

const RoomManager = require('./RoomManager');
const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('login', (username) => {
        const safeName = (username || 'Guest').trim().substring(0, 16);
        socket.data.username = safeName;
        socket.emit('login_success', { id: socket.id, username: safeName });
    });

    // Proxy room events to RoomManager
    socket.on('create_room', (roomName) => roomManager.createRoom(socket, roomName));
    socket.on('join_room', (roomId) => roomManager.joinRoom(socket, roomId));
    socket.on('start_game', (options) => roomManager.startGame(socket, options));
    socket.on('play_cards', (data) => roomManager.handlePlay(socket, data));
    socket.on('pass_turn', () => roomManager.handlePass(socket));
    socket.on('chat_message', (msg) => roomManager.handleChat(socket, msg));

    // Advanced Phases
    socket.on('restart_game', () => roomManager.handleRestartGame(socket));
    socket.on('taxation_return', (cardIds) => roomManager.handleTaxationReturn(socket, cardIds));
    socket.on('taxation_pay', (cardIds) => roomManager.handleTaxationPay(socket, cardIds));
    socket.on('market_trade', (cardId) => roomManager.handleMarketTrade(socket, cardId));
    socket.on('market_pass', () => roomManager.handleMarketPass(socket));
    socket.on('market_pass', () => roomManager.handleMarketPass(socket));
    socket.on('select_seat_card', (cardId) => roomManager.handleSeatSelection(socket, cardId));
    socket.on('revolution_choice', (declare) => roomManager.handleRevolutionChoice(socket, declare));
    socket.on('debug_end_round', () => roomManager.handleDebugEndRound(socket));
    socket.on('update_settings', (settings) => roomManager.handleUpdateSettings(socket, settings));

    // Room List Request (e.g. on new connection or refresh)
    socket.on('request_room_list', () => {
        socket.emit('room_list', roomManager.getRoomListData());
    });

    socket.on('disconnect', () => {
        roomManager.handleDisconnect(socket);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
