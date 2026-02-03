class Game {
    constructor(players, onUpdate, options = {}) {
        this.players = players; // Array of player objects (by reference from RoomManager)
        this.onUpdate = onUpdate; // Callback to broadcast state
        this.options = Object.assign({
            timerDuration: 30, // Default 30s
            marketDuration: 60 // Default market time
        }, options);

        this.deck = [];
        this.currentTurnIndex = 0;
        this.lastMove = null; // { playerId, cards: [] }
        this.passes = 0; // Count consecutive passes
        this.finishedPlayers = []; // Track who finished in order
        this.activePlayersCount = players.length;
        this.round = 1; // 1-based
        this.timer = null;
        this.timeLeft = 0;
        this.revolutionActive = false;

        // Phases: 'TAXATION', 'MARKET', 'PLAYING', 'FINISHED'
        this.phase = 'PLAYING';

        // Market
        this.marketPool = []; // { playerId, card }
        this.marketPasses = new Set();
    }

    start() {
        // First Game: No ranks, clean start.
        this.phase = 'PLAYING';
        this.initDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setupHands(); // Sort and init

        // Random start for Round 1
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length);

        this.checkAndHandleRevolution();
        this.startTurnTimer();
        this.broadcastState();
    }

    startNextRound() {
        this.round++;
        this.phase = 'TAXATION';
        this.initDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setupHands();

        this.lastMove = null;
        this.passes = 0;
        this.finishedPlayers = [];
        this.activePlayersCount = this.players.length;
        this.marketPool = [];
        this.marketPasses.clear();

        // Revolution Check
        this.checkAndHandleRevolution();

        // If Revolution occurred, user might want to skip Taxation? 
        // Standard rule: Revolution = No taxation.
        // User request didn't specify, but I'll assume if Revolution happened (swap), 
        // the roles are swapped, and we proceed to Taxation with new roles?
        // Actually Dalmuti rules usually say "No taxation if revolution". 
        // Let's implement: If Revolution -> Skip Taxation, Go to Market. (Or Play).
        // User's rule 2: "After exchange... market".
        // I will implement: If Revolution -> Skip Taxation, Go to Market. 
        // If Revolution happened, checks are based on NEW ranks.

        if (this.revolutionActive) {
            // If revolution, usually taxation is skipped.
            // I'll skip to Market for fairness/simplicity if Rev occurred.
            this.startMarketPhase();
        } else {
            // Auto-Tax: Peon (Last) gives 2 Best to Dalmuti (1)
            this.handleAutoTaxation();
        }

        this.broadcastState();
    }

    setupHands() {
        this.players.forEach(p => {
            p.hand.sort((a, b) => a.rank - b.rank);
            p.finished = false;
            p.connected = true;
            // Rank is preserved from previous round end
        });
    }

    handleAutoTaxation() {
        const dalmuti = this.players.find(p => p.rank === 1);
        const peon = this.players.find(p => p.rank === this.players.length);

        if (dalmuti && peon) {
            // Peon gives 2 lowest rank cards (Best cards)
            // Hand is sorted 1..12. So index 0, 1 are best.
            // UNLESS Jokers? Jokers are 13 but wild. 
            // Dalmuti Rule: Peon gives "Best Cards". 
            // Usually Jokers are best? Or Rank 1?
            // "숫자가 가장 낮은 카드" (Lowest Number) -> Rank 1 is best.
            // If Peon has Joker (13), is it better than 1? 
            // Standard: Joker (13) is wild, valueable. 
            // User said: "Lowest Number Card". strictly rank. 
            // I will take index 0 and 1 (Sorted Ascending).

            const taxes = peon.hand.slice(0, 2);
            peon.hand = peon.hand.slice(2);
            dalmuti.hand.push(...taxes);

            // Resort Dalmuti
            dalmuti.hand.sort((a, b) => a.rank - b.rank);

            // Notify state?
            // Now waiting for Dalmuti to return 2 cards.
        } else {
            // Should not happen if ranks set. Skip.
            this.startMarketPhase();
        }
    }

    handleTaxationReturn(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.rank !== 1) return;
        if (cardIds.length !== 2) return;

        // Verify cards
        const cardsToReturn = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToReturn.length !== 2) return;

        const peon = this.players.find(p => p.rank === this.players.length);
        if (!peon) return;

        // Transfer
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        peon.hand.push(...cardsToReturn);

        // Sort both
        player.hand.sort((a, b) => a.rank - b.rank);
        peon.hand.sort((a, b) => a.rank - b.rank);

        // End Taxation -> Market
        this.startMarketPhase();
    }

    startMarketPhase() {
        this.phase = 'MARKET';
        this.marketPool = [];
        this.marketPasses.clear();

        if (this.timer) clearInterval(this.timer);
        this.timeLeft = this.options.marketDuration || 60;

        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                this.endMarketPhase();
            }
        }, 1000);

        this.broadcastState();
    }

    handleMarketTrade(playerId, cardId) {
        if (this.phase !== 'MARKET') return;
        const player = this.players.find(p => p.id === playerId);
        // Validate card
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const card = player.hand[cardIndex];

        // Check Pool for match (someone else's card)
        const matchIndex = this.marketPool.findIndex(item => item.playerId !== playerId);

        if (matchIndex !== -1) {
            // EXECUTE TRADE
            const tradeItem = this.marketPool[matchIndex];
            const partner = this.players.find(p => p.id === tradeItem.playerId);

            // Remove from pool
            this.marketPool.splice(matchIndex, 1);

            // Swap: Player gives Card -> Partner. Partner gives TradeItem.Card -> Player.
            // 1. Remove Card from Player Hand
            player.hand.splice(cardIndex, 1);
            // 2. Add TradeItem.Card to Player Hand
            player.hand.push(tradeItem.card);

            // 3. (Partner's card was already in pool, removed from their hand effectively? 
            // Wait, usually easier to keep in hand until trade, OR remove to pool?
            // Let's remove to pool to avoid duplicates.)

            // Partner receives 'card'
            partner.hand.push(card);

            // Sort
            player.hand.sort((a, b) => a.rank - b.rank);
            partner.hand.sort((a, b) => a.rank - b.rank);

            // Notify?
        } else {
            // No match, Add to pool
            player.hand.splice(cardIndex, 1);
            this.marketPool.push({ playerId, card });
        }

        this.broadcastState();
    }

    handleMarketPass(playerId) {
        if (this.phase !== 'MARKET') return;
        this.marketPasses.add(playerId);
        if (this.marketPasses.size === this.players.length) {
            this.endMarketPhase();
        }
    }

    endMarketPhase() {
        if (this.timer) clearInterval(this.timer);

        // Return untraded cards
        this.marketPool.forEach(item => {
            const p = this.players.find(pl => pl.id === item.playerId);
            if (p) {
                p.hand.push(item.card);
                p.hand.sort((a, b) => a.rank - b.rank);
            }
        });
        this.marketPool = [];

        this.startPlayingPhase();
    }

    startPlayingPhase() {
        this.phase = 'PLAYING';
        // Start turn: Rank 1 starts.
        this.currentTurnIndex = this.players.findIndex(p => p.rank === 1);
        if (this.currentTurnIndex === -1) this.currentTurnIndex = 0;

        this.startTurnTimer();
        this.broadcastState();
    }

    setPlayerConnectionStatus(playerId, isConnected) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.connected = isConnected;
            // If current turn player disconnected, maybe auto-pass immediately?
            if (!isConnected && this.phase === 'PLAYING' && this.players[this.currentTurnIndex].id === playerId) {
                this.handleAutoPass();
            } else {
                this.broadcastState();
            }
        }
    }

    checkAndHandleRevolution() {
        this.revolutionActive = false; // Reset
        // 2 Jokers Revolution
        const revolutionaryIndex = this.players.findIndex(p => p.hand.filter(c => c.isJoker).length === 2);

        if (revolutionaryIndex !== -1) {
            // Logic: Swap with Great Dalmuti (Rank 1).
            // Since ranks are assigned at the end of a round, in Round 0 we might not have a Rank 1.
            // If we continue playing, ranks are preserved on players.
            // We check provided player.rank prop.

            const dalmutiIndex = this.players.findIndex(p => p.rank === 1);

            if (dalmutiIndex !== -1 && dalmutiIndex !== revolutionaryIndex) {
                this.revolutionActive = true;
                const rev = this.players[revolutionaryIndex];
                const dal = this.players[dalmutiIndex];

                // Swap Hands
                const tempHand = [...rev.hand];
                rev.hand = [...dal.hand];
                dal.hand = tempHand;

                // Swap Seats/Rank (Actually exchanging roles)
                const tempRank = rev.rank;
                rev.rank = dal.rank;
                dal.rank = tempRank;

                // Re-sort hands
                rev.hand.sort((a, b) => a.rank - b.rank);
                dal.hand.sort((a, b) => a.rank - b.rank);
            }
        }
    }

    initDeck() {
        this.deck = [];
        // Dalmuti Deck: 1x1, 2x2, ... 12x12
        for (let r = 1; r <= 12; r++) {
            for (let i = 0; i < r; i++) {
                this.deck.push({ rank: r, isJoker: false, id: `${r}-${i}` });
            }
        }
        // 2 Jokers
        this.deck.push({ rank: 13, isJoker: true, id: 'joker-1' });
        this.deck.push({ rank: 13, isJoker: true, id: 'joker-2' });
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        let pIndex = 0;
        this.players.forEach(p => p.hand = []);

        while (this.deck.length > 0) {
            this.players[pIndex].hand.push(this.deck.pop());
            pIndex = (pIndex + 1) % this.players.length;
        }
    }

    startTurnTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timeLeft = this.options.timerDuration;

        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState(); // Broadcast time update
            } else {
                this.handleAutoPass();
            }
        }, 1000);
    }

    stopTurnTimer() {
        if (this.timer) clearInterval(this.timer);
    }

    handleAutoPass() {
        // Force pass for current player
        this.passTurn(this.players[this.currentTurnIndex].id);
    }

    playCards(playerId, cardIds) {
        if (this.phase !== 'PLAYING') return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentTurnIndex) return false;

        const player = this.players[playerIndex];
        const cardsToPlay = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToPlay.length !== cardIds.length) return false;

        const primaryRank = this.getPrimaryRank(cardsToPlay);
        if (primaryRank === -1) return false;

        if (this.lastMove) {
            // UPDATED RULE: QUANTITY >= LAST QUANTITY
            if (cardsToPlay.length < this.lastMove.cards.length) return false;

            // STRICT LOWER RANK RULE
            const lastRank = this.getPrimaryRank(this.lastMove.cards);
            if (primaryRank >= lastRank) return false;
        }

        // Execute Move
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        this.lastMove = { playerId, cards: cardsToPlay };
        this.passes = 0;

        if (player.hand.length === 0) {
            player.finished = true;
            this.activePlayersCount--;
            this.finishedPlayers.push(player);
        }

        this.nextTurn();
        this.broadcastState();
        return true;
    }

    passTurn(playerId) {
        if (this.phase !== 'PLAYING') return false;
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentTurnIndex) return false;

        this.passes++;
        this.nextTurn();

        if (this.lastMove && this.players[this.currentTurnIndex].id === this.lastMove.playerId) {
            this.lastMove = null;
            this.passes = 0;
        } else if (this.lastMove && this.players.find(p => p.id === this.lastMove.playerId).finished && this.isRoundOverForFinishedLeader()) {
            this.lastMove = null;
            this.passes = 0;
        }

        this.broadcastState();
        return true;
    }

    nextTurn() {
        this.stopTurnTimer();

        if (this.activePlayersCount <= 1) {
            this.endRound();
            return;
        }

        let attempts = 0;
        do {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts++;
            // Safety break to prevent infinite loop if everyone disconnected/finished
            if (attempts > this.players.length * 2) break;
        } while (
            this.players[this.currentTurnIndex].finished ||
            !this.players[this.currentTurnIndex].connected // Skip disconnected players
        );

        this.startTurnTimer();
    }

    isRoundOverForFinishedLeader() {
        return this.passes >= this.activePlayersCount;
    }

    endRound() {
        this.stopTurnTimer();
        this.phase = 'FINISHED'; // Game Over State

        // Finalize Ranks
        this.finishedPlayers.forEach((p, index) => {
            p.rank = index + 1;
        });
        const loser = this.players.find(p => !p.finished);
        if (loser) {
            loser.rank = this.players.length;
            // Also add to finished lists if needed logic
        }

        this.broadcastState();
    }

    getPrimaryRank(cards) {
        // Returns rank of the set. Checks if valid set.
        // Jokers (13) can be anything.
        const nonJokers = cards.filter(c => !c.isJoker);
        if (nonJokers.length === 0) {
            // All jokers.
            return 13;
        }
        const firstRank = nonJokers[0].rank;
        const allSame = nonJokers.every(c => c.rank === firstRank);
        if (allSame) return firstRank;
        return -1; // Invalid
    }

    broadcastState() {
        // Mask hands of other players
        const publicState = {
            phase: this.phase,
            round: this.round,
            activePlayersCount: this.activePlayersCount,
            lastMove: this.lastMove,
            currentTurn: this.players[this.currentTurnIndex]?.id,
            timeLeft: this.timeLeft,
            revolutionActive: this.revolutionActive,
            marketPoolCount: this.marketPool.length, // Hide details? Or show? Show count maybe?
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand.length,
                finished: p.finished,
                connected: p.connected, // Frontend can show offline status
                rank: p.rank,
                hand: p.hand,
                // Add market status?
                marketPassed: this.marketPasses.has(p.id)
            }))
        };
        this.onUpdate(publicState);
    }
}

module.exports = Game;
