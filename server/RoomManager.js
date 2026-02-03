const { v4: uuidv4 } = require('uuid');
const Game = require('./Game');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> { id, name, players: [], game: Game | null, ownerId }
    }

    createRoom(socket, roomName) {
        if (!socket.data.username) return;
        const roomId = uuidv4().slice(0, 8);
        const room = {
            id: roomId,
            name: roomName,
            players: [],
            game: null,
            ownerId: socket.id,
            status: 'LOBBY'
        };
        this.rooms.set(roomId, room);
        this.joinRoom(socket, roomId);
    }

    joinRoom(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        if (room.status !== 'LOBBY') {
            socket.emit('error', 'Game already started');
            return;
        }

        // Remove from other rooms if needed (simplified: assume one room at a time)
        socket.join(roomId);
        room.players.push({
            id: socket.id,
            username: socket.data.username,
            ready: false
        });
        socket.data.roomId = roomId;

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
    }

    startGame(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.ownerId !== socket.id) return; // Only owner

        if (room.players.length < 3) { // Constraint from user: 3-8 players
            socket.emit('error', 'Need at least 3 players');
            return;
        }

        room.status = 'PLAYING';
        room.game = new Game(room.players, (gameState) => {
            this.io.to(roomId).emit('game_update', gameState);
        });
        room.game.start();

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
    }

    handlePlay(socket, { cards }) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            const success = room.game.playCards(socket.id, cards);
            if (!success) socket.emit('error', 'Invalid move');
        }
    }

    handlePass(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            room.game.passTurn(socket.id);
        }
    }

    handleDisconnect(socket) {
        const roomId = socket.data.roomId;
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                if (room.status === 'PLAYING' && room.game) {
                    // Game in progress: Mark as disconnected
                    room.game.setPlayerConnectionStatus(socket.id, false);
                } else {
                    // Lobby: Remove player
                    room.players = room.players.filter(p => p.id !== socket.id);
                    if (room.players.length === 0) {
                        this.rooms.delete(roomId);
                    } else {
                        this.io.to(roomId).emit('room_update', this.getRoomData(room));
                    }
                }
            }
        }
    }

    handleChat(socket, message) {
        const roomId = socket.data.roomId;
        if (roomId && socket.data.username) {
            this.io.to(roomId).emit('chat_message', {
                sender: socket.data.username,
                text: message,
                timestamp: Date.now()
            });
        }
    }

    handleRestartGame(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.ownerId === socket.id && room.game) {
            room.game.startNextRound();
        }
    }

    handleTaxationReturn(socket, cardIds) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game) {
            room.game.handleTaxationReturn(socket.id, cardIds);
        }
    }

    handleMarketTrade(socket, cardId) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game) {
            room.game.handleMarketTrade(socket.id, cardId); // Assumes single card trade per request
        }
    }

    handleMarketPass(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game) {
            room.game.handleMarketPass(socket.id);
        }
    }

    getRoomData(room) {
        return {
            id: room.id,
            name: room.name,
            players: room.players,
            ownerId: room.ownerId,
            status: room.status
        };
    }
}

module.exports = RoomManager;
