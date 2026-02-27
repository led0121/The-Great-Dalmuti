const { v4: uuidv4 } = require('uuid');
const Game = require('./Game');
const OneCardGame = require('./OneCardGame');
const BlackjackGame = require('./BlackjackGame');
const PokerGame = require('./PokerGame');

class RoomManager {
    constructor(io, userDB) {
        this.io = io;
        this.userDB = userDB;
        this.rooms = new Map();

        // Auto-cleanup interval
        setInterval(() => this.cleanupRooms(), 5 * 60 * 1000);
    }

    cleanupRooms() {
        const now = Date.now();
        const MAX_INACTIVITY = 30 * 60 * 1000;

        this.rooms.forEach((room, roomId) => {
            if (now - room.lastActivity > MAX_INACTIVITY) {
                console.log(`Auto-deleting inactive room: ${roomId} (${room.name})`);
                this.rooms.delete(roomId);
                this.broadcastRoomList();
            }
        });
    }

    createRoom(socket, data) {
        if (!socket.data.username) return;

        // Support both old string format and new object format
        let roomName, betAmount;
        if (typeof data === 'string') {
            roomName = data;
            betAmount = 0;
        } else {
            roomName = data.roomName || data;
            betAmount = parseInt(data.betAmount) || 0;
            if (betAmount < 0) betAmount = 0;
        }

        const roomId = uuidv4().slice(0, 8);
        const room = {
            id: roomId,
            name: roomName,
            players: [],
            game: null,
            ownerId: socket.id,
            status: 'LOBBY',
            betAmount: betAmount,
            settings: {
                gameType: 'dalmuti',
                timerDuration: 30,
                attackCardCount: 1,
                sameNumberPlay: false,
                maxCards: 0,
                attackCards: {
                    two: { enabled: true, power: 2 },
                    ace: { enabled: true, power: 3 },
                    blackJoker: { enabled: true, power: 5 },
                    colorJoker: { enabled: true, power: 7 }
                },
                // Blackjack settings
                minBet: 100,
                maxBet: 10000,
                // Poker settings
                smallBlind: 50,
                bigBlind: 100
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
            // Get user balance from DB
            let balance = 0;
            if (socket.data.userId && this.userDB) {
                balance = this.userDB.getBalance(socket.data.userId);
            }

            room.players.push({
                id: socket.id,
                username: socket.data.displayName || socket.data.username,
                userId: socket.data.userId || null,
                ready: false,
                balance: balance
            });
            this.io.to(roomId).emit('room_update', this.getRoomData(room));
            this.broadcastRoomList();
        } else {
            if (room.game) {
                room.game.addWaitingPlayer({
                    id: socket.id,
                    username: socket.data.displayName || socket.data.username
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
        if (room.ownerId !== socket.id) return;

        const gameType = room.settings.gameType || 'dalmuti';
        const minPlayers = (gameType === 'blackjack') ? 1 : 2;

        if (room.players.length < minPlayers) {
            socket.emit('error', `Need at least ${minPlayers} players to start`);
            return;
        }

        // Deduct bet amount from all players (Dalmuti/OneCard only)
        // Blackjack/Poker have their own internal betting, settled in handleRestartGame
        const needsBetDeduction = (gameType === 'dalmuti' || gameType === 'onecard');
        if (needsBetDeduction && room.betAmount > 0 && this.userDB) {
            for (const player of room.players) {
                if (player.userId) {
                    const balance = this.userDB.getBalance(player.userId);
                    if (balance < room.betAmount) {
                        socket.emit('error', `${player.username}님의 잔고가 부족합니다`);
                        return;
                    }
                }
            }
            // All checks passed, deduct
            for (const player of room.players) {
                if (player.userId) {
                    this.userDB.deductBalance(player.userId, room.betAmount);
                    // Update player balance in their socket
                    const playerSocket = this.io.sockets.sockets.get(player.id);
                    if (playerSocket) {
                        playerSocket.emit('balance_update', {
                            balance: this.userDB.getBalance(player.userId)
                        });
                    }
                }
            }
        }

        room.status = 'PLAYING';
        room.lastActivity = Date.now();

        const playersWithBalance = room.players.map(p => ({
            ...p,
            balance: p.userId && this.userDB ? this.userDB.getBalance(p.userId) : 10000,
            displayName: p.username
        }));

        if (gameType === 'onecard') {
            // Auto-set maxCards
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

            room.game = new OneCardGame(room.players, (gameState) => {
                this.io.to(roomId).emit('game_update', gameState);
            }, room.settings);
            room.game.start();

        } else if (gameType === 'blackjack') {
            room.game = new BlackjackGame(playersWithBalance, (gameState) => {
                this.io.to(roomId).emit('game_update', gameState);
            }, room.settings);
            room.game.start();

        } else if (gameType === 'poker') {
            room.game = new PokerGame(playersWithBalance, (gameState) => {
                const playingPlayerIds = new Set(gameState.players.map(p => p.id));
                const allSockets = Array.from(this.io.sockets.sockets.values()).filter(s => s.data.roomId === roomId);

                for (const socket of allSockets) {
                    const playerState = JSON.parse(JSON.stringify(gameState));
                    if (gameState.phase !== 'SHOWDOWN') {
                        playerState.players.forEach(p => {
                            // Mask cards for others
                            if (p.id !== socket.id) {
                                p.hand = p.hand.map(c => ({ ...c, id: 'hidden', suit: 'hidden', rank: 'hidden' }));
                            }
                        });
                    }
                    socket.emit('game_update', playerState);
                }
            }, room.settings);
            room.game.start();

        } else {
            room.game = new Game(room.players, (gameState) => {
                this.io.to(roomId).emit('game_update', gameState);
            }, room.settings);
            room.game.start();
        }

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
        this.broadcastRoomList();
    }

    // === Game Action Handlers ===

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

    handleCallOneCard(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'onecard') return;
        room.lastActivity = Date.now();
        room.game.callOneCard(socket.id);
    }

    // === Blackjack Handlers ===

    handleBlackjackBet(socket, amount) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'blackjack') return;
        room.lastActivity = Date.now();

        const success = room.game.placeBet(socket.id, amount);
        if (!success) socket.emit('error', '유효하지 않은 베팅입니다');
    }

    handleBlackjackHit(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'blackjack') return;
        room.lastActivity = Date.now();

        const success = room.game.hit(socket.id);
        if (!success) socket.emit('error', 'Cannot hit now');
    }

    handleBlackjackStand(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'blackjack') return;
        room.lastActivity = Date.now();

        const success = room.game.stand(socket.id);
        if (!success) socket.emit('error', 'Cannot stand now');
    }

    handleBlackjackDouble(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'blackjack') return;
        room.lastActivity = Date.now();

        const success = room.game.doubleDown(socket.id);
        if (!success) socket.emit('error', 'Cannot double down');
    }

    // === Poker Handlers ===

    handlePokerFold(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'poker') return;
        room.lastActivity = Date.now();
        room.game.fold(socket.id);
    }

    handlePokerCall(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'poker') return;
        room.lastActivity = Date.now();
        room.game.call(socket.id);
    }

    handlePokerCheck(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'poker') return;
        room.lastActivity = Date.now();
        room.game.check(socket.id);
    }

    handlePokerRaise(socket, amount) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'poker') return;
        room.lastActivity = Date.now();
        room.game.raise(socket.id, amount);
    }

    handlePokerAllIn(socket) {
        const room = this.rooms.get(socket.data.roomId);
        if (!room || !room.game) return;
        if (room.settings.gameType !== 'poker') return;
        room.lastActivity = Date.now();
        room.game.allInAction(socket.id);
    }

    // === Common Handlers ===

    /**
     * Record game results for all players in a room
     */
    recordGameResults(room) {
        if (!this.userDB || !room || !room.game) return;

        const gameType = room.settings.gameType || 'dalmuti';
        const totalPlayers = room.players.length;

        if (gameType === 'blackjack') {
            const payouts = room.game.getPayouts();
            for (const p of payouts) {
                const player = room.players.find(pl => pl.id === p.playerId);
                if (player && player.userId) {
                    this.userDB.recordGameResult(player.userId, {
                        gameType: 'blackjack',
                        result: p.result || (p.payout > p.bet ? 'win' : p.payout === p.bet ? 'push' : 'lose'),
                        totalPlayers,
                        earnings: p.payout || 0,
                        spent: p.bet || 0,
                        details: `Bet: ${p.bet}, Payout: ${p.payout}`
                    });
                }
            }
        } else if (gameType === 'poker') {
            const payouts = room.game.getPayouts();
            for (const p of payouts) {
                const player = room.players.find(pl => pl.id === p.playerId);
                if (player && player.userId) {
                    this.userDB.recordGameResult(player.userId, {
                        gameType: 'poker',
                        result: p.payout > 0 ? 'win' : 'lose',
                        totalPlayers,
                        earnings: p.payout || 0,
                        spent: p.bet || 0,
                        details: `Bet: ${p.bet}, Payout: ${p.payout}`
                    });
                }
            }
        } else if (gameType === 'dalmuti') {
            const gamePlayers = room.game.players || [];
            for (const gp of gamePlayers) {
                const player = room.players.find(pl => pl.id === gp.id);
                if (player && player.userId) {
                    const rank = gp.rank || totalPlayers;
                    this.userDB.recordGameResult(player.userId, {
                        gameType: 'dalmuti',
                        result: rank === 1 ? 'win' : 'lose',
                        rank,
                        totalPlayers,
                        earnings: rank === 1 ? (room.betAmount * totalPlayers) : 0,
                        spent: room.betAmount || 0,
                        details: `Rank: ${rank}/${totalPlayers}`
                    });
                }
            }
        } else if (gameType === 'onecard') {
            const gamePlayers = room.game.players || [];
            const finishedOrder = room.game.finishedOrder || [];
            for (const gp of gamePlayers) {
                const player = room.players.find(pl => pl.id === gp.id);
                if (player && player.userId) {
                    const rankIndex = finishedOrder.indexOf(gp.id);
                    const rank = rankIndex >= 0 ? rankIndex + 1 : totalPlayers;
                    this.userDB.recordGameResult(player.userId, {
                        gameType: 'onecard',
                        result: rank === 1 ? 'win' : 'lose',
                        rank,
                        totalPlayers,
                        earnings: rank === 1 ? (room.betAmount * totalPlayers) : 0,
                        spent: room.betAmount || 0,
                        details: `Rank: ${rank}/${totalPlayers}`
                    });
                }
            }
        }
    }

    handleRestartGame(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.ownerId === socket.id && room.game) {
            const gameType = room.settings.gameType || 'dalmuti';

            // Record game results BEFORE settling
            this.recordGameResults(room);

            // Settle balances for gambling games
            if ((gameType === 'blackjack' || gameType === 'poker') && this.userDB) {
                const payouts = room.game.getPayouts();
                for (const p of payouts) {
                    const player = room.players.find(pl => pl.id === p.playerId);
                    if (player && player.userId) {
                        // payout already includes the original bet for winners
                        // So net result = payout - bet
                        // win: payout=bet*2, net=+bet (profit)
                        // blackjack: payout=bet*2.5, net=+bet*1.5
                        // push: payout=bet, net=0
                        // lose: payout=0, net=-bet (loss)
                        const netResult = p.payout - p.bet;
                        if (netResult > 0) {
                            this.userDB.addBalance(player.userId, netResult);
                        } else if (netResult < 0) {
                            this.userDB.deductBalance(player.userId, Math.abs(netResult));
                        }
                        // push (netResult === 0): no change

                        const playerSocket = this.io.sockets.sockets.get(player.id);
                        if (playerSocket) {
                            playerSocket.emit('balance_update', {
                                balance: this.userDB.getBalance(player.userId)
                            });
                        }
                    }
                }
            }

            // Settle balances for Dalmuti / OneCard
            if ((gameType === 'dalmuti' || gameType === 'onecard') && this.userDB && room.betAmount > 0) {
                const totalPrize = room.betAmount * room.players.length;
                let winnerId = null;

                if (gameType === 'dalmuti') {
                    // 1등 (rank === 1)인 플레이어
                    const gamePlayers = room.game.players || [];
                    const winner = gamePlayers.find(gp => gp.rank === 1);
                    if (winner) winnerId = winner.id;
                } else if (gameType === 'onecard') {
                    // finishedOrder 첫 번째 플레이어
                    const finishedOrder = room.game.finishedOrder || [];
                    if (finishedOrder.length > 0) winnerId = finishedOrder[0];
                }

                if (winnerId) {
                    const winnerPlayer = room.players.find(pl => pl.id === winnerId);
                    if (winnerPlayer && winnerPlayer.userId) {
                        // 참가비는 startGame에서 이미 차감됨, 상금풀 전체를 1등에게
                        this.userDB.addBalance(winnerPlayer.userId, totalPrize);
                        const winnerSocket = this.io.sockets.sockets.get(winnerPlayer.id);
                        if (winnerSocket) {
                            winnerSocket.emit('balance_update', {
                                balance: this.userDB.getBalance(winnerPlayer.userId)
                            });
                        }
                    }
                }

                // 모든 플레이어에게 잔고 업데이트 전송
                for (const player of room.players) {
                    if (player.userId) {
                        const playerSocket = this.io.sockets.sockets.get(player.id);
                        if (playerSocket) {
                            playerSocket.emit('balance_update', {
                                balance: this.userDB.getBalance(player.userId)
                            });
                        }
                    }
                }
            }

            // Send updated stats to all players
            for (const player of room.players) {
                if (player.userId) {
                    const playerSocket = this.io.sockets.sockets.get(player.id);
                    if (playerSocket) {
                        playerSocket.emit('stats_update', this.userDB.getStats(player.userId));
                    }
                }
            }

            if (gameType === 'onecard') {
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

                room.game = new OneCardGame(room.players, (gameState) => {
                    this.io.to(roomId).emit('game_update', gameState);
                }, room.settings);
                room.game.start();
            } else if (gameType === 'blackjack') {
                const playersWithBalance = room.players.map(p => ({
                    ...p,
                    balance: p.userId && this.userDB ? this.userDB.getBalance(p.userId) : 10000,
                    displayName: p.username
                }));
                room.game = new BlackjackGame(playersWithBalance, (gameState) => {
                    this.io.to(roomId).emit('game_update', gameState);
                }, room.settings);
                room.game.start();
            } else if (gameType === 'poker') {
                const playersWithBalance = room.players.map(p => ({
                    ...p,
                    balance: p.userId && this.userDB ? this.userDB.getBalance(p.userId) : 10000,
                    displayName: p.username
                }));
                room.game = new PokerGame(playersWithBalance, (gameState) => {
                    const allSockets = Array.from(this.io.sockets.sockets.values()).filter(s => s.data.roomId === roomId);
                    for (const socket of allSockets) {
                        const playerState = JSON.parse(JSON.stringify(gameState));
                        if (gameState.phase !== 'SHOWDOWN') {
                            playerState.players.forEach(p => {
                                if (p.id !== socket.id) {
                                    p.hand = p.hand.map(c => ({ ...c, id: 'hidden', suit: 'hidden', rank: 'hidden' }));
                                }
                            });
                        }
                        socket.emit('game_update', playerState);
                    }
                }, room.settings);
                room.game.start();
            } else {
                room.game.startNextRound();
            }
        }
    }

    handleDisconnect(socket) {
        const roomId = socket.data.roomId;
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                if (room.status === 'PLAYING' && room.game) {
                    room.game.setPlayerConnectionStatus(socket.id, false);
                    const remaining = room.game.players.filter(p => p.connected).length;
                    if (remaining === 0) {
                        console.log(`Room ${roomId} deleted (All players disconnected)`);
                        this.rooms.delete(roomId);
                        this.broadcastRoomList();
                    }
                } else {
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
                sender: socket.data.displayName || socket.data.username,
                text: message,
                timestamp: Date.now()
            });
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

    handleUpdateSettings(socket, settings) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.ownerId !== socket.id) return;

        const validSettings = { ...room.settings };

        if (settings.timerDuration !== undefined) {
            let val = parseInt(settings.timerDuration);
            if (isNaN(val)) val = 30;
            if (val < 5) val = 5;
            if (val > 30) val = 30;
            validSettings.timerDuration = val;
        }

        if (settings.gameType !== undefined) {
            if (['dalmuti', 'onecard', 'blackjack', 'poker'].includes(settings.gameType)) {
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

        // Blackjack settings
        if (settings.minBet !== undefined) {
            let val = parseInt(settings.minBet);
            if (isNaN(val) || val < 10) val = 10;
            if (val > 10000) val = 10000;
            validSettings.minBet = val;
        }
        if (settings.maxBet !== undefined) {
            let val = parseInt(settings.maxBet);
            if (isNaN(val) || val < 100) val = 100;
            if (val > 100000) val = 100000;
            validSettings.maxBet = val;
        }

        // Poker settings
        if (settings.smallBlind !== undefined) {
            let val = parseInt(settings.smallBlind);
            if (isNaN(val) || val < 10) val = 10;
            if (val > 10000) val = 10000;
            validSettings.smallBlind = val;
        }
        if (settings.bigBlind !== undefined) {
            let val = parseInt(settings.bigBlind);
            if (isNaN(val) || val < 20) val = 20;
            if (val > 20000) val = 20000;
            validSettings.bigBlind = val;
        }

        // Bet amount for room
        if (settings.betAmount !== undefined) {
            let val = parseInt(settings.betAmount);
            if (isNaN(val) || val < 0) val = 0;
            room.betAmount = val;
        }

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

        room.settings = validSettings;
        room.lastActivity = Date.now();

        this.io.to(roomId).emit('room_update', this.getRoomData(room));
    }

    handleLeaveRoom(socket) {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        this.handleDisconnect(socket);

        socket.leave(roomId);
        delete socket.data.roomId;

        socket.emit('left_room');
    }

    handleDebugEndRound(socket) {
        const roomId = socket.data.roomId;
        const room = this.rooms.get(roomId);
        if (room && room.game && room.game.debugEndRound) {
            room.game.debugEndRound();
        }
    }

    getRoomData(room) {
        return {
            id: room.id,
            name: room.name,
            players: room.players,
            ownerId: room.ownerId,
            status: room.status,
            settings: room.settings,
            betAmount: room.betAmount || 0
        };
    }

    getRoomListData() {
        return Array.from(this.rooms.values()).map(r => ({
            id: r.id,
            name: r.name,
            playerCount: r.players.length,
            status: r.status,
            gameType: r.settings.gameType || 'dalmuti',
            betAmount: r.betAmount || 0
        }));
    }

    broadcastRoomList() {
        this.io.emit('room_list', this.getRoomListData());
    }
}

module.exports = RoomManager;
