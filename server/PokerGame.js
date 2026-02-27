/**
 * PokerGame - Texas Hold'em Poker Engine
 * 
 * Flow: BETTING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
 * 
 * Hand Rankings (high to low):
 *   1. Royal Flush
 *   2. Straight Flush
 *   3. Four of a Kind
 *   4. Full House
 *   5. Flush
 *   6. Straight
 *   7. Three of a Kind
 *   8. Two Pair
 *   9. One Pair
 *   10. High Card
 */

class PokerGame {
    constructor(players, onUpdate, options = {}) {
        this.players = players.map((p, i) => ({
            ...p,
            hand: [],       // 2 hole cards
            bet: 0,         // Current round bet
            totalBet: 0,    // Total bet this hand
            folded: false,
            allIn: false,
            connected: true,
            balance: p.balance || 0,
            isDealer: false,
            result: null
        }));
        this.onUpdate = onUpdate;
        this.options = {
            smallBlind: options.smallBlind || 50,
            bigBlind: options.bigBlind || 100,
            timerDuration: options.timerDuration || 30
        };

        this.deck = [];
        this.communityCards = [];  // Up to 5 cards
        this.pot = 0;
        this.sidePots = [];
        this.phase = 'WAITING';   // WAITING, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
        this.dealerIndex = 0;
        this.currentBet = 0;       // Current highest bet in the round
        this.currentPlayerIndex = 0;
        this.timer = null;
        this.timeLeft = 0;
        this.roundNumber = 0;
        this.lastRaise = 0;
        this.roundResults = [];
        this.actedThisRound = new Set();
    }

    start() {
        this.roundNumber++;

        // Reset
        this.deck = [];
        this.communityCards = [];
        this.pot = 0;
        this.sidePots = [];
        this.currentBet = 0;
        this.lastRaise = this.options.bigBlind;
        this.roundResults = [];
        this.actedThisRound = new Set();

        this.players.forEach(p => {
            p.hand = [];
            p.bet = 0;
            p.totalBet = 0;
            p.folded = p.balance <= 0;
            p.allIn = false;
            p.result = null;
            p.isDealer = false;
        });

        // Rotate dealer
        if (this.roundNumber > 1) {
            this.dealerIndex = this.nextActiveIndex(this.dealerIndex);
        }
        this.players[this.dealerIndex].isDealer = true;

        this.initDeck();
        this.shuffleDeck();

        // Deal 2 cards to each player
        const activePlayers = this.getActivePlayers();
        for (let i = 0; i < 2; i++) {
            for (const p of activePlayers) {
                p.hand.push(this.deck.pop());
            }
        }

        // Post blinds
        this.postBlinds();

        this.phase = 'PREFLOP';
        // First player after big blind
        const bbIndex = this.getBigBlindIndex();
        this.currentPlayerIndex = this.nextActiveIndex(bbIndex);
        this.startTurnTimer();
        this.broadcastState();
    }

    initDeck() {
        this.deck = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.deck.push({ id: `${suit}-${rank}`, suit, rank });
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    getActivePlayers() {
        return this.players.filter(p => p.connected && p.balance > 0);
    }

    getPlayingPlayers() {
        return this.players.filter(p => !p.folded && p.connected);
    }

    nextActiveIndex(from) {
        for (let i = 1; i <= this.players.length; i++) {
            const idx = (from + i) % this.players.length;
            const p = this.players[idx];
            if (!p.folded && p.connected && !p.allIn) return idx;
        }
        return -1;
    }

    getSmallBlindIndex() {
        if (this.players.length === 2) return this.dealerIndex;
        return this.nextActiveIndex(this.dealerIndex);
    }

    getBigBlindIndex() {
        return this.nextActiveIndex(this.getSmallBlindIndex());
    }

    postBlinds() {
        const sbIndex = this.getSmallBlindIndex();
        const bbIndex = this.getBigBlindIndex();

        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];

        const sbAmount = Math.min(this.options.smallBlind, sbPlayer.balance);
        const bbAmount = Math.min(this.options.bigBlind, bbPlayer.balance);

        sbPlayer.bet = sbAmount;
        sbPlayer.totalBet = sbAmount;
        sbPlayer.balance -= sbAmount;
        if (sbPlayer.balance === 0) sbPlayer.allIn = true;

        bbPlayer.bet = bbAmount;
        bbPlayer.totalBet = bbAmount;
        bbPlayer.balance -= bbAmount;
        if (bbPlayer.balance === 0) bbPlayer.allIn = true;

        this.currentBet = bbAmount;
        this.pot = sbAmount + bbAmount;
    }

    // === PLAYER ACTIONS ===

    fold(playerId) {
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;

        player.folded = true;
        this.actedThisRound.add(playerId);

        // Check if only one player remaining
        const remaining = this.getPlayingPlayers();
        if (remaining.length === 1) {
            this.winByFold(remaining[0]);
            return true;
        }

        this.advanceToNextPlayer();
        return true;
    }

    call(playerId) {
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;

        const callAmount = this.currentBet - player.bet;
        const actualCall = Math.min(callAmount, player.balance);

        player.balance -= actualCall;
        player.bet += actualCall;
        player.totalBet += actualCall;
        this.pot += actualCall;

        if (player.balance === 0) player.allIn = true;
        this.actedThisRound.add(playerId);

        this.advanceToNextPlayer();
        return true;
    }

    check(playerId) {
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;
        if (player.bet < this.currentBet) return false; // Can't check if there's a bet to match

        this.actedThisRound.add(playerId);
        this.advanceToNextPlayer();
        return true;
    }

    raise(playerId, amount) {
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;

        amount = parseInt(amount) || 0;
        const minRaise = this.currentBet + this.lastRaise;
        if (amount < minRaise && amount < player.balance + player.bet) return false;

        const toAdd = Math.min(amount - player.bet, player.balance);
        player.balance -= toAdd;
        player.bet += toAdd;
        player.totalBet += toAdd;
        this.pot += toAdd;

        this.lastRaise = player.bet - this.currentBet;
        this.currentBet = player.bet;

        if (player.balance === 0) player.allIn = true;

        // Reset acted (new raise means others need to act again)
        this.actedThisRound = new Set([playerId]);

        this.advanceToNextPlayer();
        return true;
    }

    allInAction(playerId) {
        const player = this.players[this.currentPlayerIndex];
        if (!player || player.id !== playerId) return false;
        if (this.phase === 'WAITING' || this.phase === 'SHOWDOWN') return false;

        const allInAmount = player.balance;
        const newBet = player.bet + allInAmount;
        player.balance = 0;
        player.totalBet += allInAmount;
        this.pot += allInAmount;

        if (newBet > this.currentBet) {
            this.lastRaise = newBet - this.currentBet;
            this.currentBet = newBet;
            this.actedThisRound = new Set([playerId]);
        } else {
            this.actedThisRound.add(playerId);
        }

        player.bet = newBet;
        player.allIn = true;

        this.advanceToNextPlayer();
        return true;
    }

    advanceToNextPlayer() {
        this.stopTimer();

        // Check if betting round is over
        const playingNotAllIn = this.players.filter(p => !p.folded && p.connected && !p.allIn);

        // If only one non-all-in player or all have acted
        const allActed = playingNotAllIn.every(p => this.actedThisRound.has(p.id) && p.bet === this.currentBet);

        if (playingNotAllIn.length <= 1 || allActed) {
            this.nextBettingRound();
            return;
        }

        // Find next player who needs to act
        let nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        if (nextIdx === -1 || nextIdx === this.currentPlayerIndex) {
            this.nextBettingRound();
            return;
        }

        this.currentPlayerIndex = nextIdx;
        this.startTurnTimer();
        this.broadcastState();
    }

    nextBettingRound() {
        // Reset bets for new round
        this.players.forEach(p => p.bet = 0);
        this.currentBet = 0;
        this.lastRaise = this.options.bigBlind;
        this.actedThisRound = new Set();

        const playingPlayers = this.getPlayingPlayers();
        if (playingPlayers.length <= 1) {
            if (playingPlayers.length === 1) {
                this.winByFold(playingPlayers[0]);
            }
            return;
        }

        switch (this.phase) {
            case 'PREFLOP':
                this.phase = 'FLOP';
                this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
                break;
            case 'FLOP':
                this.phase = 'TURN';
                this.communityCards.push(this.deck.pop());
                break;
            case 'TURN':
                this.phase = 'RIVER';
                this.communityCards.push(this.deck.pop());
                break;
            case 'RIVER':
                this.showdown();
                return;
        }

        // Find first player after dealer
        const nextIdx = this.nextActiveIndex(this.dealerIndex);
        if (nextIdx === -1) {
            // All remaining players are all-in, deal remaining community cards
            this.dealRemainingAndShowdown();
            return;
        }

        this.currentPlayerIndex = nextIdx;
        this.startTurnTimer();
        this.broadcastState();
    }

    dealRemainingAndShowdown() {
        while (this.communityCards.length < 5) {
            if (this.phase === 'PREFLOP') {
                this.phase = 'FLOP';
                this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
            } else if (this.phase === 'FLOP') {
                this.phase = 'TURN';
                this.communityCards.push(this.deck.pop());
            } else if (this.phase === 'TURN') {
                this.phase = 'RIVER';
                this.communityCards.push(this.deck.pop());
            }
        }
        this.showdown();
    }

    winByFold(winner) {
        this.phase = 'SHOWDOWN';
        winner.result = 'win';
        winner.balance += this.pot;
        this.roundResults = [{
            playerId: winner.id,
            username: winner.displayName || winner.username,
            payout: this.pot,
            handRank: 'Fold Win',
            result: 'win'
        }];
        this.pot = 0;
        this.stopTimer();
        this.broadcastState();
    }

    showdown() {
        this.phase = 'SHOWDOWN';
        this.stopTimer();

        const contenders = this.players.filter(p => !p.folded && p.connected);

        // Evaluate hands
        const evaluated = contenders.map(p => ({
            player: p,
            handRank: this.evaluateHand([...p.hand, ...this.communityCards])
        }));

        // Sort by hand rank (highest first)
        evaluated.sort((a, b) => {
            if (a.handRank.rank !== b.handRank.rank) return b.handRank.rank - a.handRank.rank;
            // Compare kickers
            for (let i = 0; i < a.handRank.kickers.length; i++) {
                if (a.handRank.kickers[i] !== b.handRank.kickers[i]) {
                    return b.handRank.kickers[i] - a.handRank.kickers[i];
                }
            }
            return 0;
        });

        // Distribute pot using side pots logic
        const betLevels = [...new Set(contenders.filter(c => c.totalBet > 0).map(c => c.totalBet))].sort((x, y) => x - y);
        let previousLevel = 0;
        const payouts = new Map();

        for (const p of this.players) p.result = 'lose';

        for (const level of betLevels) {
            const levelContribution = level - previousLevel;
            let subPot = 0;

            for (const p of this.players) {
                if (p.totalBet > previousLevel) {
                    subPot += Math.min(p.totalBet - previousLevel, levelContribution);
                }
            }

            const eligible = evaluated.filter(e => e.player.totalBet >= level);
            if (eligible.length > 0 && subPot > 0) {
                const best = eligible[0];
                const tied = eligible.filter(e => {
                    if (e.handRank.rank !== best.handRank.rank) return false;
                    for (let i = 0; i < e.handRank.kickers.length; i++) {
                        if (e.handRank.kickers[i] !== best.handRank.kickers[i]) return false;
                    }
                    return true;
                });

                const share = Math.floor(subPot / tied.length);
                let remainder = subPot % tied.length;

                tied.forEach(winner => {
                    winner.player.result = 'win';
                    let amt = share;
                    if (remainder > 0) {
                        amt += 1;
                        remainder -= 1;
                    }
                    winner.player.balance += amt;
                    payouts.set(winner.player.id, (payouts.get(winner.player.id) || 0) + amt);
                });
            }
            previousLevel = level;
        }

        // Remainder logic if any unawarded chips exist
        let totalDistributed = 0;
        for (const amt of payouts.values()) totalDistributed += amt;
        const remainingPot = this.pot - totalDistributed;
        if (remainingPot > 0 && evaluated.length > 0) {
            evaluated[0].player.balance += remainingPot;
            payouts.set(evaluated[0].player.id, (payouts.get(evaluated[0].player.id) || 0) + remainingPot);
        }

        this.roundResults = evaluated.map(e => {
            const payout = payouts.get(e.player.id) || 0;
            return {
                playerId: e.player.id,
                username: e.player.displayName || e.player.username,
                payout,
                handRank: e.handRank.name,
                result: payout > 0 ? 'win' : 'lose',
                hand: e.player.hand
            };
        });

        this.pot = 0;
        this.broadcastState();
    }

    // === HAND EVALUATION ===

    getRankValue(rank) {
        const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return values[rank] || 0;
    }

    evaluateHand(cards) {
        // Generate all 5-card combinations from 7 cards
        const combos = this.combinations(cards, 5);
        let bestHand = null;

        for (const combo of combos) {
            const evaluation = this.evaluate5Cards(combo);
            if (!bestHand || evaluation.rank > bestHand.rank ||
                (evaluation.rank === bestHand.rank && this.compareKickers(evaluation.kickers, bestHand.kickers) > 0)) {
                bestHand = evaluation;
            }
        }

        return bestHand || { rank: 0, name: 'High Card', kickers: [] };
    }

    combinations(arr, k) {
        const results = [];
        const combine = (start, combo) => {
            if (combo.length === k) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                combine(i + 1, combo);
                combo.pop();
            }
        };
        combine(0, []);
        return results;
    }

    evaluate5Cards(cards) {
        const ranks = cards.map(c => this.getRankValue(c.rank)).sort((a, b) => b - a);
        const suits = cards.map(c => c.suit);
        const isFlush = suits.every(s => s === suits[0]);

        // Check straight
        let isStraight = false;
        let straightHigh = 0;
        if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
            isStraight = true;
            straightHigh = ranks[0];
        }
        // A-2-3-4-5 (wheel)
        if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
            isStraight = true;
            straightHigh = 5;
        }

        // Count ranks
        const rankCounts = {};
        for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
        const counts = Object.entries(rankCounts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

        // Royal Flush
        if (isFlush && isStraight && straightHigh === 14) {
            return { rank: 10, name: 'Royal Flush', kickers: [14] };
        }
        // Straight Flush
        if (isFlush && isStraight) {
            return { rank: 9, name: 'Straight Flush', kickers: [straightHigh] };
        }
        // Four of a Kind
        if (counts[0][1] === 4) {
            return { rank: 8, name: 'Four of a Kind', kickers: [parseInt(counts[0][0]), parseInt(counts[1][0])] };
        }
        // Full House
        if (counts[0][1] === 3 && counts[1][1] === 2) {
            return { rank: 7, name: 'Full House', kickers: [parseInt(counts[0][0]), parseInt(counts[1][0])] };
        }
        // Flush
        if (isFlush) {
            return { rank: 6, name: 'Flush', kickers: ranks };
        }
        // Straight
        if (isStraight) {
            return { rank: 5, name: 'Straight', kickers: [straightHigh] };
        }
        // Three of a Kind
        if (counts[0][1] === 3) {
            const kickers = ranks.filter(r => r !== parseInt(counts[0][0]));
            return { rank: 4, name: 'Three of a Kind', kickers: [parseInt(counts[0][0]), ...kickers] };
        }
        // Two Pair
        if (counts[0][1] === 2 && counts[1][1] === 2) {
            const pairs = [parseInt(counts[0][0]), parseInt(counts[1][0])].sort((a, b) => b - a);
            const kicker = ranks.find(r => r !== pairs[0] && r !== pairs[1]);
            return { rank: 3, name: 'Two Pair', kickers: [...pairs, kicker] };
        }
        // One Pair
        if (counts[0][1] === 2) {
            const pairRank = parseInt(counts[0][0]);
            const kickers = ranks.filter(r => r !== pairRank);
            return { rank: 2, name: 'One Pair', kickers: [pairRank, ...kickers] };
        }
        // High Card
        return { rank: 1, name: 'High Card', kickers: ranks };
    }

    compareKickers(a, b) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const av = a[i] || 0, bv = b[i] || 0;
            if (av !== bv) return av - bv;
        }
        return 0;
    }

    // === TIMER ===

    startTurnTimer() {
        this.stopTimer();
        this.timeLeft = this.options.timerDuration;
        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                // Auto-fold on timeout
                const player = this.players[this.currentPlayerIndex];
                if (player) {
                    if (player.bet >= this.currentBet) {
                        this.check(player.id);
                    } else {
                        this.fold(player.id);
                    }
                }
            }
        }, 1000);
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
            if (!isConnected && this.phase !== 'WAITING' && this.phase !== 'SHOWDOWN') {
                if (this.players[this.currentPlayerIndex]?.id === playerId) {
                    this.fold(playerId);
                }
            }
            this.broadcastState();
        }
    }

    getPayouts() {
        return this.roundResults.map(r => ({
            playerId: r.playerId,
            bet: this.players.find(p => p.id === r.playerId)?.totalBet || 0,
            payout: r.payout,
            result: r.result
        }));
    }

    // === STATE ===

    broadcastState() {
        const state = {
            gameType: 'poker',
            phase: this.phase,
            roundNumber: this.roundNumber,
            timeLeft: this.timeLeft,
            options: this.options,
            pot: this.pot,
            communityCards: this.communityCards,
            currentBet: this.currentBet,
            currentPlayer: this.players[this.currentPlayerIndex]?.id,
            dealerIndex: this.dealerIndex,
            players: this.players.map(p => ({
                id: p.id,
                username: p.displayName || p.username,
                hand: p.hand,  // Will be filtered per-player in RoomManager
                bet: p.bet,
                totalBet: p.totalBet,
                folded: p.folded,
                allIn: p.allIn,
                connected: p.connected,
                balance: p.balance,
                isDealer: p.isDealer,
                result: p.result
            })),
            roundResults: this.roundResults
        };

        this.onUpdate(state);
    }
}

module.exports = PokerGame;
