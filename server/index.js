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
        socket.data.username = username;
        socket.emit('login_success', { id: socket.id, username });
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
    socket.on('market_trade', (cardId) => roomManager.handleMarketTrade(socket, cardId));
    socket.on('market_pass', () => roomManager.handleMarketPass(socket));

    socket.on('disconnect', () => {
        roomManager.handleDisconnect(socket);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
