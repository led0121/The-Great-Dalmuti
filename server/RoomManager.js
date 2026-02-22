const { v4: uuidv4 } = require('uuid');
const Game = require('./Game');
const OneCardGame = require('./OneCardGame');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> { id, name, players: [], game: Game | null, ownerId, settings: {}, lastActivity: number }

        // Auto-cleanup interval (e.g., every 5 minutes)
        setInterval(() => this.cleanupRooms(), 5 * 60 * 1000);
    }

    cleanupRooms() {
        const now = Date.now();
        const MAX_INACTIVITY = 30 * 60 * 1000; // 30 minutes

        this.rooms.forEach((room, roomId) => {
            if (now - room.lastActivity > MAX_INACTIVITY) {
                console.log(`Auto-deleting inactive room: ${roomId} (${room.name})`);
                this.rooms.delete(roomId);
                this.broadcastRoomList();
            }
        });
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
            status: 'LOBBY',
            settings: {
                gameType: 'dalmuti', // 'dalmuti' or 'onecard'
                timerDuration: 30, // Default
                // OneCard specific settings
                attackCardCount: 1, // Number of decks (1-3)
                sameNumberPlay: false, // Allow playing same number cards at once
                attackCards: {
                    two: true,       // 2 (+2 attack)
                    ace: true,       // A (+3 attack)
                    blackJoker: true, // Black Joker (+5 attack)
                    colorJoker: true  // Color Joker (+7 attack)
                }
            },
            lastActivity: Date.now()
        };
        this.rooms.set(roomId, room);
        this.joinRoom(socket, roomId);
        this.broadcastRoomList();
    }

    joinRoom(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        if (room.status === 'LOBBY') {
            room.players.push({
                id: socket.id,
                username: socket.data.username,
                ready: false
            });
            this.io.to(roomId).emit('room_update', this.getRoomData(room));
            this.broadcastRoomList();
        } else {
            // Determine if Spectator or Waiting
            if (room.game) {
                room.game.addWaitingPlayer({
                    id: socket.id,
                    username: socket.data.username
                });
                socket.emit('room_update', this.getRoomData(room));
                room.game.broadcastState();
            }
        }
    }

    startGame(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.ownerId !== socket.id) return; // Only owner

        if (room.players.length < 2) {
            socket.emit('error', 'Need at least 2 players to start');
            return;
        }

        room.status = 'PLAYING';
        room.lastActivity = Date.now();

        const gameType = room.settings.gameType || 'dalmuti';

        if (gameType === 'onecard') {
            room.game = new OneCardGame(room.players, (gameState) => {
                this.io.to(roomId).emit('game_update', gameState);
            }, room.settings);
            room.game.start();
        } else {
            // Default: Dalmuti
            room.game = new Game(room.players, (gameState) => {
                this.io.to(roomId).emit('game_update', gameState);
            }, room.settings);
            room.game.start();
        }

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
        this.broadcastRoomList();
    }

    handlePlay(socket, { cards, chosenSuit }) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            room.lastActivity = Date.now();
            const gameType = room.settings.gameType || 'dalmuti';

            if (gameType === 'onecard') {
                const success = room.game.playCards(socket.id, cards, chosenSuit);
                if (!success) socket.emit('error', 'Invalid move');
            } else {
                const success = room.game.playCards(socket.id, cards);
                if (!success) socket.emit('error', 'Invalid move');
            }
        }
    }

    handlePass(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            const gameType = room.settings.gameType || 'dalmuti';
            if (gameType === 'dalmuti') {
                room.game.passTurn(socket.id);
            }
            // OneCard doesn't have pass - only draw
        }
    }

    handleDrawCard(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            const gameType = room.settings.gameType || 'dalmuti';
            if (gameType === 'onecard') {
                room.lastActivity = Date.now();
                const success = room.game.drawCards(socket.id);
                if (!success) socket.emit('error', 'Cannot draw now');
            }
        }
    }

    handleChooseSuit(socket, suit) {
        const room = this.rooms.get(socket.data.roomId);
        if (room && room.game) {
            const gameType = room.settings.gameType || 'dalmuti';
            if (gameType === 'onecard') {
                room.lastActivity = Date.now();
                room.game.playCards(socket.id, [], suit);
            }
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

                    // Check if *everyone* disconnected from the game
                    const remaining = room.game.players.filter(p => p.connected).length;
                    if (remaining === 0) {
                        console.log(`Room ${roomId} deleted (All players disconnected from game)`);
                        this.rooms.delete(roomId);
                        this.broadcastRoomList();
                    }
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
            const gameType = room.settings.gameType || 'dalmuti';
            if (gameType === 'onecard') {
                // Restart OneCard game
                room.game = new OneCardGame(room.players, (gameState) => {
                    this.io.to(roomId).emit('game_update', gameState);
                }, room.settings);
                room.game.start();
            } else {
                room.game.startNextRound();
            }
        }
    }

    handleTaxationReturn(socket, cardIds) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room) room.lastActivity = Date.now();

        if (room && room.game && room.game.handleTaxationReturn) {
            room.game.handleTaxationReturn(socket.id, cardIds);
        }
    }

    handleUpdateSettings(socket, settings) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.ownerId !== socket.id) return; // Only owner

        // Validate Settings
        const validSettings = { ...room.settings };

        if (settings.timerDuration !== undefined) {
            let val = parseInt(settings.timerDuration);
            if (isNaN(val)) val = 30;
            if (val < 5) val = 5;
            if (val > 30) val = 30;
            validSettings.timerDuration = val;
        }

        if (settings.gameType !== undefined) {
            if (['dalmuti', 'onecard'].includes(settings.gameType)) {
                validSettings.gameType = settings.gameType;
            }
        }

        if (settings.attackCardCount !== undefined) {
            let val = parseInt(settings.attackCardCount);
            if (isNaN(val)) val = 1;
            if (val < 1) val = 1;
            if (val > 3) val = 3;
            validSettings.attackCardCount = val;
        }

        if (settings.sameNumberPlay !== undefined) {
            validSettings.sameNumberPlay = !!settings.sameNumberPlay;
        }

        // Validate attack card toggles
        if (settings.attackCards !== undefined && typeof settings.attackCards === 'object') {
            if (!validSettings.attackCards) {
                validSettings.attackCards = { two: true, ace: true, blackJoker: true, colorJoker: true };
            }
            const ac = settings.attackCards;
            if (ac.two !== undefined) validSettings.attackCards.two = !!ac.two;
            if (ac.ace !== undefined) validSettings.attackCards.ace = !!ac.ace;
            if (ac.blackJoker !== undefined) validSettings.attackCards.blackJoker = !!ac.blackJoker;
            if (ac.colorJoker !== undefined) validSettings.attackCards.colorJoker = !!ac.colorJoker;
        }

        // Update settings
        room.settings = validSettings;
        room.lastActivity = Date.now();

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
    }

    handleLeaveRoom(socket) {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        this.handleDisconnect(socket);

        // Clean up socket data
        socket.leave(roomId);
        delete socket.data.roomId;

        socket.emit('left_room');
    }

    handleTaxationPay(socket, cardIds) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.handleTaxationPay) {
            room.game.handleTaxationPay(socket.id, cardIds);
        }
    }

    handleRevolutionChoice(socket, declare) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.handleRevolutionChoice) {
            room.game.handleRevolutionChoice(socket.id, declare);
        }
    }

    handleMarketTrade(socket, cardId) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.handleMarketTrade) {
            room.game.handleMarketTrade(socket.id, cardId);
        }
    }

    handleMarketPass(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.handleMarketPass) {
            room.game.handleMarketPass(socket.id);
        }
    }

    handleSeatSelection(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.handleSeatCardSelection) {
            room.game.handleSeatCardSelection(socket.id);
        }
    }

    getRoomData(room) {
        return {
            id: room.id,
            name: room.name,
            players: room.players,
            ownerId: room.ownerId,
            status: room.status,
            settings: room.settings
        };
    }

    getRoomListData() {
        // Return summary of all rooms
        return Array.from(this.rooms.values()).map(r => ({
            id: r.id,
            name: r.name,
            playerCount: r.players.length,
            status: r.status,
            gameType: r.settings.gameType || 'dalmuti'
        }));
    }

    broadcastRoomList() {
        this.io.emit('room_list', this.getRoomListData());
    }

    handleDebugEndRound(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.debugEndRound) {
            room.game.debugEndRound();
        }
    }
}

module.exports = RoomManager;
