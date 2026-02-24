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
                maxCards: 0, // 0 = no limit, >0 = eliminated at this hand size
                attackCards: {
                    two: { enabled: true, power: 2 },
                    ace: { enabled: true, power: 3 },
                    blackJoker: { enabled: true, power: 5 },
                    colorJoker: { enabled: true, power: 7 }
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
            // Auto-set maxCards based on player count if not configured
            const playerCount = room.players.length;
            const deckCount = room.settings.attackCardCount || 1;
            const hasBlackJoker = room.settings.attackCards?.blackJoker?.enabled !== false;
            const hasColorJoker = room.settings.attackCards?.colorJoker?.enabled !== false;
            const jokersPerDeck = (hasBlackJoker ? 1 : 0) + (hasColorJoker ? 1 : 0);
            const totalCards = deckCount * (52 + jokersPerDeck);

            if (!room.settings.maxCards || room.settings.maxCards <= 0) {
                // Auto-calculate: ensure no player can hold more than ~60% of total cards
                // but at least 15 cards, and scale down for more players
                const autoMax = Math.max(15, Math.min(Math.floor(totalCards * 0.6 / playerCount) + 10, 30));
                room.settings.maxCards = autoMax;
            }

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
                // Auto-set maxCards based on player count if not configured
                const playerCount = room.players.length;
                const deckCount = room.settings.attackCardCount || 1;
                const hasBlackJoker = room.settings.attackCards?.blackJoker?.enabled !== false;
                const hasColorJoker = room.settings.attackCards?.colorJoker?.enabled !== false;
                const jokersPerDeck = (hasBlackJoker ? 1 : 0) + (hasColorJoker ? 1 : 0);
                const totalCards = deckCount * (52 + jokersPerDeck);

                if (!room.settings.maxCards || room.settings.maxCards <= 0) {
                    const autoMax = Math.max(15, Math.min(Math.floor(totalCards * 0.6 / playerCount) + 10, 30));
                    room.settings.maxCards = autoMax;
                }

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

    handleCallOneCard(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'onecard') return;
        room.lastActivity = Date.now();
        room.game.callOneCard(socket.id);
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

        if (settings.maxCards !== undefined) {
            let val = parseInt(settings.maxCards);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 50) val = 50;
            validSettings.maxCards = val;
        }

        // Validate attack card settings (enabled + power)
        if (settings.attackCards !== undefined && typeof settings.attackCards === 'object') {
            if (!validSettings.attackCards) {
                validSettings.attackCards = {
                    two: { enabled: true, power: 2 },
                    ace: { enabled: true, power: 3 },
                    blackJoker: { enabled: true, power: 5 },
                    colorJoker: { enabled: true, power: 7 }
                };
            }
            const ac = settings.attackCards;
            for (const key of ['two', 'ace', 'blackJoker', 'colorJoker']) {
                if (ac[key] !== undefined && typeof ac[key] === 'object') {
                    if (!validSettings.attackCards[key]) {
                        validSettings.attackCards[key] = { enabled: true, power: 2 };
                    }
                    if (ac[key].enabled !== undefined) {
                        validSettings.attackCards[key].enabled = !!ac[key].enabled;
                    }
                    if (ac[key].power !== undefined) {
                        let p = parseInt(ac[key].power);
                        if (isNaN(p) || p < 1) p = 1;
                        if (p > 20) p = 20;
                        validSettings.attackCards[key].power = p;
                    }
                }
            }
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
