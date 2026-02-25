/**
 * BlackjackGame - 블랙잭 게임 엔진
 * 
 * Rules:
 *   - Goal: Get as close to 21 without going over
 *   - Ace = 1 or 11 (auto-adjusted)
 *   - Face cards (J, Q, K) = 10
 *   - Dealer must hit on 16 or less, stand on 17+
 *   - Blackjack (21 with 2 cards) pays 1.5x
 *   - Push (tie) returns bet
 * 
 * Flow: BET → DEAL → PLAYER_TURN → DEALER_TURN → SETTLE → (repeat or end)
 */

class BlackjackGame {
    constructor(players, onUpdate, options = {}) {
        this.players = players.map(p => ({
            ...p,
            hand: [],
            bet: 0,
            result: null, // 'win', 'lose', 'push', 'blackjack'
            stood: false,
            busted: false,
            connected: true,
            balance: p.balance || 0
        }));
        this.onUpdate = onUpdate;
        this.options = {
            minBet: options.minBet || 100,
            maxBet: options.maxBet || 10000,
            timerDuration: options.timerDuration || 30
        };

        this.deck = [];
        this.dealer = { hand: [], stood: false, busted: false };
        this.phase = 'BETTING'; // BETTING, PLAYING, DEALER_TURN, SETTLED
        this.currentPlayerIndex = 0;
        this.timer = null;
        this.timeLeft = 0;
        this.roundResults = [];
        this.roundNumber = 0;
        this.waitingPlayers = [];
    }

    start() {
        this.roundNumber++;
        this.initDeck();
        this.shuffleDeck();
        this.phase = 'BETTING';
        this.dealer = { hand: [], stood: false, busted: false };
        this.roundResults = [];

        // Reset player states
        this.players.forEach(p => {
            p.hand = [];
            p.bet = 0;
            p.result = null;
            p.stood = false;
            p.busted = false;
        });

        this.startBettingTimer();
        this.broadcastState();
    }

    initDeck() {
        this.deck = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        // Use 6 decks for blackjack (standard casino)
        for (let d = 0; d < 6; d++) {
            for (const suit of suits) {
                for (const rank of ranks) {
                    this.deck.push({ id: `${suit}-${rank}-${d}`, suit, rank });
                }
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() {
        if (this.deck.length < 20) {
            // Reshuffle when low
            this.initDeck();
            this.shuffleDeck();
        }
        return this.deck.pop();
    }

    getCardValue(card) {
        if (['J', 'Q', 'K'].includes(card.rank)) return 10;
        if (card.rank === 'A') return 11; // Adjusted later if bust
        return parseInt(card.rank);
    }

    getHandValue(hand) {
        let total = 0;
        let aces = 0;
        for (const card of hand) {
            total += this.getCardValue(card);
            if (card.rank === 'A') aces++;
        }
        // Adjust aces
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return total;
    }

    isBlackjack(hand) {
        return hand.length === 2 && this.getHandValue(hand) === 21;
    }

    // === BETTING PHASE ===

    placeBet(playerId, amount) {
        if (this.phase !== 'BETTING') return false;

        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        amount = parseInt(amount) || 0;
        if (amount < this.options.minBet || amount > this.options.maxBet) return false;
        if (amount > player.balance) return false;

        player.bet = amount;
        this.broadcastState();

        // Check if all players have bet
        const activePlayers = this.players.filter(p => p.connected && !p.finished);
        if (activePlayers.every(p => p.bet > 0)) {
            this.startDealing();
        }
        return true;
    }

    startBettingTimer() {
        this.stopTimer();
        this.timeLeft = this.options.timerDuration;
        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                // Auto-bet minimum for those who haven't bet
                this.players.forEach(p => {
                    if (p.connected && !p.finished && p.bet === 0) {
                        if (p.balance >= this.options.minBet) {
                            p.bet = this.options.minBet;
                        }
                    }
                });
                this.startDealing();
            }
        }, 1000);
    }

    // === DEALING PHASE ===

    startDealing() {
        this.stopTimer();

        // Remove players who didn't/couldn't bet
        this.players.forEach(p => {
            if (p.bet === 0) p.finished = true;
        });

        // Deal 2 cards to each active player and dealer
        const activePlayers = this.players.filter(p => p.bet > 0 && p.connected);
        for (let i = 0; i < 2; i++) {
            for (const p of activePlayers) {
                p.hand.push(this.drawCard());
            }
            this.dealer.hand.push(this.drawCard());
        }

        // Check for natural blackjacks
        for (const p of activePlayers) {
            if (this.isBlackjack(p.hand)) {
                p.result = 'blackjack';
                p.stood = true;
            }
        }

        this.phase = 'PLAYING';
        this.currentPlayerIndex = this.findNextActivePlayer(-1);

        if (this.currentPlayerIndex === -1) {
            // All players have blackjack or no active players
            this.startDealerTurn();
        } else {
            this.startTurnTimer();
        }
        this.broadcastState();
    }

    findNextActivePlayer(fromIndex) {
        for (let i = fromIndex + 1; i < this.players.length; i++) {
            const p = this.players[i];
            if (p.bet > 0 && p.connected && !p.stood && !p.busted && !p.result) {
                return i;
            }
        }
        return -1;
    }

    // === PLAYER TURN ===

    hit(playerId) {
        if (this.phase !== 'PLAYING') return false;
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;

        player.hand.push(this.drawCard());
        const value = this.getHandValue(player.hand);

        if (value > 21) {
            player.busted = true;
            player.result = 'lose';
            this.advancePlayer();
        } else if (value === 21) {
            player.stood = true;
            this.advancePlayer();
        }

        this.broadcastState();
        return true;
    }

    stand(playerId) {
        if (this.phase !== 'PLAYING') return false;
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;

        player.stood = true;
        this.advancePlayer();
        this.broadcastState();
        return true;
    }

    doubleDown(playerId) {
        if (this.phase !== 'PLAYING') return false;
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (player.hand.length !== 2) return false; // Can only double on first two cards
        if (player.balance < player.bet * 2) return false; // Need enough balance

        player.bet *= 2;
        player.hand.push(this.drawCard());
        const value = this.getHandValue(player.hand);

        if (value > 21) {
            player.busted = true;
            player.result = 'lose';
        }
        player.stood = true;
        this.advancePlayer();
        this.broadcastState();
        return true;
    }

    advancePlayer() {
        this.stopTimer();
        this.currentPlayerIndex = this.findNextActivePlayer(this.currentPlayerIndex);

        if (this.currentPlayerIndex === -1) {
            this.startDealerTurn();
        } else {
            this.startTurnTimer();
        }
    }

    startTurnTimer() {
        this.stopTimer();
        this.timeLeft = this.options.timerDuration;
        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                // Auto-stand on timeout
                const player = this.players[this.currentPlayerIndex];
                if (player) {
                    player.stood = true;
                    this.advancePlayer();
                    this.broadcastState();
                }
            }
        }, 1000);
    }

    // === DEALER TURN ===

    startDealerTurn() {
        this.stopTimer();
        this.phase = 'DEALER_TURN';

        // Check if all players busted
        const activePlayers = this.players.filter(p => p.bet > 0 && !p.busted);
        if (activePlayers.length === 0) {
            this.settle();
            return;
        }

        // Dealer draws until 17+
        this.dealerPlay();
    }

    dealerPlay() {
        while (this.getHandValue(this.dealer.hand) < 17) {
            this.dealer.hand.push(this.drawCard());
        }

        const dealerValue = this.getHandValue(this.dealer.hand);
        if (dealerValue > 21) {
            this.dealer.busted = true;
        }
        this.dealer.stood = true;

        this.settle();
    }

    // === SETTLE ===

    settle() {
        this.phase = 'SETTLED';
        const dealerValue = this.getHandValue(this.dealer.hand);
        const dealerBlackjack = this.isBlackjack(this.dealer.hand);

        this.roundResults = [];

        for (const player of this.players) {
            if (player.bet <= 0) continue;

            const playerValue = this.getHandValue(player.hand);
            const playerBlackjack = this.isBlackjack(player.hand);

            let result = 'lose';
            let payout = 0;

            if (player.busted) {
                result = 'lose';
                payout = 0;
            } else if (playerBlackjack && dealerBlackjack) {
                result = 'push';
                payout = player.bet; // Return bet
            } else if (playerBlackjack) {
                result = 'blackjack';
                payout = Math.floor(player.bet * 2.5); // 1.5x win + original bet
            } else if (this.dealer.busted) {
                result = 'win';
                payout = player.bet * 2;
            } else if (playerValue > dealerValue) {
                result = 'win';
                payout = player.bet * 2;
            } else if (playerValue === dealerValue) {
                result = 'push';
                payout = player.bet;
            } else {
                result = 'lose';
                payout = 0;
            }

            player.result = result;
            this.roundResults.push({
                playerId: player.id,
                username: player.displayName || player.username,
                bet: player.bet,
                result,
                payout,
                handValue: playerValue
            });
        }

        this.broadcastState();
    }

    /**
     * Get the payout results for balance updates
     * Called by RoomManager after settle
     */
    getPayouts() {
        return this.roundResults.map(r => ({
            playerId: r.playerId,
            bet: r.bet,
            payout: r.payout,
            result: r.result
        }));
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    setPlayerConnectionStatus(playerId, isConnected) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.connected = isConnected;
            if (!isConnected && this.phase === 'PLAYING') {
                if (this.players[this.currentPlayerIndex]?.id === playerId) {
                    this.players[this.currentPlayerIndex].stood = true;
                    this.advancePlayer();
                }
            }
            this.broadcastState();
        }
    }

    addWaitingPlayer(player) {
        this.waitingPlayers.push({
            ...player,
            hand: [],
            bet: 0,
            connected: true
        });
        this.broadcastState();
    }

    broadcastState() {
        const state = {
            gameType: 'blackjack',
            phase: this.phase,
            roundNumber: this.roundNumber,
            timeLeft: this.timeLeft,
            options: this.options,
            dealer: {
                hand: this.phase === 'PLAYING' || this.phase === 'BETTING'
                    ? [this.dealer.hand[0], ...(this.dealer.hand.length > 1 ? [{ hidden: true }] : [])]
                    : this.dealer.hand,
                value: this.phase === 'PLAYING' || this.phase === 'BETTING'
                    ? (this.dealer.hand[0] ? this.getCardValue(this.dealer.hand[0]) : 0)
                    : this.getHandValue(this.dealer.hand),
                busted: this.dealer.busted,
                stood: this.dealer.stood
            },
            currentPlayer: this.phase === 'PLAYING' ? this.players[this.currentPlayerIndex]?.id : null,
            players: this.players.map(p => ({
                id: p.id,
                username: p.displayName || p.username,
                hand: p.hand,
                handValue: this.getHandValue(p.hand),
                bet: p.bet,
                result: p.result,
                stood: p.stood,
                busted: p.busted,
                connected: p.connected,
                balance: p.balance
            })),
            roundResults: this.roundResults,
            waitingPlayers: this.waitingPlayers.map(p => ({
                id: p.id,
                username: p.displayName || p.username
            }))
        };

        this.onUpdate(state);
    }
}

module.exports = BlackjackGame;
