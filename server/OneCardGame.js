/**
 * OneCardGame - 원카드 게임 엔진
 * 
 * Attack Card Hierarchy (low → high):
 *   2 (+2) → A (+3) → Black Joker (+5) → Color Joker (+7)
 * 
 * Defense Rules:
 *   - Each attack type can ONLY be defended by the SAME type (no higher cards)
 *   - 2 attack → defend with 2 only (stacks +2)
 *   - A attack → defend with A only (stacks +3)
 *   - Black Joker → defend with Black Joker only (stacks +5)
 *   - Color Joker → defend with Color Joker only (stacks +7)
 *   - Exception: 3 can block a 2 attack (nullifies entire pending attack)
 * 
 * Special Cards:
 *   - J: Skip next player
 *   - Q: Reverse direction (3+ players)
 *   - 7: Change suit (player picks new suit)
 *   - 3: Can block (nullify) a 2 attack only
 *   - K: No special effect
 * 
 * Options:
 *   - sameNumberPlay: Allow playing multiple same-rank cards at once
 *   - attackCards: { two, ace, blackJoker, colorJoker } - toggle each attack type
 *   - attackCardCount: Number of card decks (1-3)
 */

class OneCardGame {
    constructor(players, onUpdate, options = {}) {
        this.players = players.map(p => ({
            ...p,
            hand: [],
            connected: true,
            finished: false
        }));
        this.onUpdate = onUpdate;

        // Merge attackCards with defaults carefully
        // Each attack card has { enabled: boolean, power: number }
        const defaultAttackCards = {
            two: { enabled: true, power: 2 },
            ace: { enabled: true, power: 3 },
            blackJoker: { enabled: true, power: 5 },
            colorJoker: { enabled: true, power: 7 }
        };
        const incomingAttackCards = options.attackCards || {};

        // Merge each attack card setting
        const mergedAttackCards = {};
        for (const key of Object.keys(defaultAttackCards)) {
            const incoming = incomingAttackCards[key];
            const def = defaultAttackCards[key];
            if (incoming && typeof incoming === 'object') {
                mergedAttackCards[key] = {
                    enabled: incoming.enabled !== undefined ? !!incoming.enabled : def.enabled,
                    power: (typeof incoming.power === 'number' && incoming.power >= 1 && incoming.power <= 20) ? incoming.power : def.power,
                };
            } else if (typeof incoming === 'boolean') {
                // Backward compatibility: boolean → { enabled, power: default }
                mergedAttackCards[key] = { enabled: incoming, power: def.power };
            } else {
                mergedAttackCards[key] = { ...def };
            }
        }

        this.options = {
            attackCardCount: options.attackCardCount || 1,
            sameNumberPlay: options.sameNumberPlay !== undefined ? options.sameNumberPlay : false,
            timerDuration: options.timerDuration || 30,
            maxCards: parseInt(options.maxCards) || 0, // 0 = no limit, >0 = eliminated when reaching this count
            oneCardPenalty: 2, // Cards drawn when caught not calling
            attackCards: mergedAttackCards
        };

        this.deck = [];
        this.discardPile = [];
        this.currentTurnIndex = 0;
        this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
        this.phase = 'PLAYING'; // 'PLAYING', 'CHOOSE_SUIT', 'FINISHED'
        this.pendingAttack = 0; // Accumulated attack damage
        this.pendingAttackType = null; // '2', 'A', 'BJ', 'CJ'
        this.chosenSuit = null; // Suit chosen by 7 card
        this.suitChooser = null; // Player who needs to choose suit
        this.winner = null;
        this.finishedPlayers = [];

        this.timer = null;
        this.timeLeft = 0;

        this.lastAction = null; // { playerId, action: 'play'|'draw'|'pass', cards: [] }
        this.waitingPlayers = [];

        // One Card calling mechanic
        this.oneCardTarget = null;   // Player ID who has 1 card and hasn't called yet
        this.oneCardCalled = false;  // Whether the target has called
        this.oneCardTimer = null;    // Timer for auto-penalty
    }

    start() {
        this.initDeck();
        this.shuffleDeck();
        const handSize = Math.min(7, Math.floor(this.deck.length / this.players.length) - 1);
        this.dealCards(Math.max(1, handSize)); // Adaptive hand size

        // Place first card on discard pile (must not be special)
        let firstCard = this.deck.pop();
        let safety = 0;
        while (this.isSpecialCard(firstCard) && safety < 200) {
            this.deck.unshift(firstCard);
            this.shuffleDeck();
            firstCard = this.deck.pop();
            safety++;
        }
        this.discardPile.push(firstCard);

        this.phase = 'PLAYING';
        this.startTurnTimer();
        this.broadcastState();
    }

    initDeck() {
        this.deck = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        const deckCount = Math.max(1, Math.min(this.options.attackCardCount, 3));
        for (let d = 0; d < deckCount; d++) {
            // Standard 52 cards
            for (const suit of suits) {
                for (const rank of ranks) {
                    this.deck.push({
                        id: `${suit}-${rank}-${d}`,
                        suit,
                        rank,
                        deckIndex: d
                    });
                }
            }

            // Add Black Joker if enabled
            if (this.options.attackCards.blackJoker?.enabled) {
                this.deck.push({
                    id: `bj-${d}`,
                    suit: null,
                    rank: 'BJ',
                    isJoker: true,
                    jokerType: 'black',
                    deckIndex: d
                });
            }

            // Add Color Joker if enabled
            if (this.options.attackCards.colorJoker?.enabled) {
                this.deck.push({
                    id: `cj-${d}`,
                    suit: null,
                    rank: 'CJ',
                    isJoker: true,
                    jokerType: 'color',
                    deckIndex: d
                });
            }
        }
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards(count) {
        for (let c = 0; c < count; c++) {
            for (const player of this.players) {
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
        }
        this.players.forEach(p => this.sortHand(p));
    }

    sortHand(player) {
        const suitOrder = { 'spades': 0, 'hearts': 1, 'diamonds': 2, 'clubs': 3 };
        const rankOrder = {
            '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15, 'BJ': 16, 'CJ': 17
        };
        player.hand.sort((a, b) => {
            // Jokers go last
            if (!a.suit && b.suit) return 1;
            if (a.suit && !b.suit) return -1;
            if (!a.suit && !b.suit) return (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0);
            if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
            return (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0);
        });
    }

    isSpecialCard(card) {
        return ['A', '2', '7', 'J', 'Q', 'BJ', 'CJ'].includes(card.rank);
    }

    /**
     * Check if a card is an active attack card based on settings
     */
    isAttackCard(card) {
        const ac = this.options.attackCards;
        if (card.rank === '2' && ac.two?.enabled) return true;
        if (card.rank === 'A' && ac.ace?.enabled) return true;
        if (card.rank === 'BJ' && ac.blackJoker?.enabled) return true;
        if (card.rank === 'CJ' && ac.colorJoker?.enabled) return true;
        return false;
    }

    /**
     * Get the attack value for a card (reads from configurable power)
     */
    getAttackValue(card) {
        const ac = this.options.attackCards;
        if (card.rank === '2') return ac.two?.power || 2;
        if (card.rank === 'A') return ac.ace?.power || 3;
        if (card.rank === 'BJ') return ac.blackJoker?.power || 5;
        if (card.rank === 'CJ') return ac.colorJoker?.power || 7;
        return 0;
    }

    getTopCard() {
        return this.discardPile[this.discardPile.length - 1];
    }

    /**
     * Check if a card can be played on the current top card
     * 
     * Under attack:
     *   - SAME type only (no higher cards allowed)
     *   - Exception: 3 can block 2 attacks
     * 
     * Normal:
     *   - Match suit or rank
     *   - 7 can always be played (change suit)
     *   - Jokers can always be played (wild)
     *   - If top card is Joker, any card can be played
     */
    canPlayCard(card, topCard) {
        // === UNDER ATTACK ===
        if (this.pendingAttack > 0) {
            // 3 can block 2 attacks ONLY
            if (this.pendingAttackType === '2' && card.rank === '3') return true;

            // Same type defense only (cannot use higher-tier cards)
            if (card.rank === this.pendingAttackType && this.isAttackCard(card)) return true;

            // Everything else blocked
            return false;
        }

        // === SUIT CHANGED BY 7 ===
        if (this.chosenSuit) {
            if (card.rank === '7') return true;
            // Jokers can be played anytime
            if (card.rank === 'BJ' || card.rank === 'CJ') return true;
            return card.suit === this.chosenSuit || card.rank === topCard.rank;
        }

        // === TOP CARD IS JOKER (no suit) ===
        if (topCard && (topCard.rank === 'BJ' || topCard.rank === 'CJ')) {
            return true; // Any card can be played on a Joker
        }

        // === NORMAL PLAY ===
        // Jokers can always be played (wild)
        if (card.rank === 'BJ' || card.rank === 'CJ') return true;

        // Match suit or rank
        if (card.suit === topCard.suit) return true;
        if (card.rank === topCard.rank) return true;

        // 7 can always change suit
        if (card.rank === '7') return true;

        return false;
    }

    playCards(playerId, cardIds, chosenSuit = null) {
        // === SUIT CHOICE PHASE ===
        if (this.phase === 'CHOOSE_SUIT') {
            if (this.suitChooser === playerId && chosenSuit) {
                this.chosenSuit = chosenSuit;
                this.suitChooser = null;
                this.phase = 'PLAYING';
                this.nextTurn();
                this.broadcastState();
                return true;
            }
            return false;
        }

        if (this.phase !== 'PLAYING') return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentTurnIndex) return false;

        const player = this.players[playerIndex];

        if (!cardIds || cardIds.length === 0) return false;

        // Validate cards exist in hand
        const cardsToPlay = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToPlay.length !== cardIds.length) return false;

        // If same number play is enabled, validate all cards have same rank
        if (cardsToPlay.length > 1) {
            if (!this.options.sameNumberPlay) return false;
            const firstRank = cardsToPlay[0].rank;
            if (!cardsToPlay.every(c => c.rank === firstRank)) return false;
        }

        // Validate the first card can be played
        const topCard = this.getTopCard();
        if (!this.canPlayCard(cardsToPlay[0], topCard)) return false;

        // Execute play
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));

        // Add to discard pile
        cardsToPlay.forEach(c => this.discardPile.push(c));

        // Clear chosen suit when a new card is played
        this.chosenSuit = null;

        this.lastAction = { playerId, action: 'play', cards: cardsToPlay };

        // === PROCESS CARD EFFECTS ===
        let skipCount = 0;
        let reverseCount = 0;
        let attackSum = 0;
        let has7 = false;
        let blocked = false;
        let newAttackType = null;

        for (const card of cardsToPlay) {
            // Check if 3 is blocking a 2 attack
            if (card.rank === '3' && this.pendingAttack > 0 && this.pendingAttackType === '2') {
                blocked = true;
                continue;
            }

            // Check attack cards
            if (this.isAttackCard(card)) {
                attackSum += this.getAttackValue(card);
                newAttackType = card.rank;
            }

            // Other special effects
            switch (card.rank) {
                case 'J':
                    skipCount++;
                    break;
                case 'Q':
                    reverseCount++;
                    break;
                case '7':
                    has7 = true;
                    break;
            }
        }

        // Apply block (3 nullifies 2 attack)
        if (blocked) {
            this.pendingAttack = 0;
            this.pendingAttackType = null;
        }

        // Apply new attack
        if (attackSum > 0) {
            this.pendingAttack += attackSum;
            this.pendingAttackType = newAttackType;
        }

        // Apply reverse (odd number of Q = reverse, even = cancel out)
        if (reverseCount % 2 === 1 && this.players.filter(p => !p.finished).length > 2) {
            this.direction *= -1;
        }

        // Check win (0 cards)
        if (player.hand.length === 0) {
            player.finished = true;
            this.finishedPlayers.push(player);
            // Clear oneCard if this player was target
            if (this.oneCardTarget === playerId) {
                this.clearOneCardWindow();
            }

            const activePlayers = this.players.filter(p => !p.finished);
            if (activePlayers.length <= 1) {
                if (activePlayers.length === 1) {
                    activePlayers[0].finished = true;
                    this.finishedPlayers.push(activePlayers[0]);
                }
                this.endGame();
                return true;
            }
        }

        // Check one card call (1 card left, not finished)
        if (player.hand.length === 1 && !player.finished) {
            this.startOneCardWindow(playerId);
        }

        // Handle 7 - choose suit
        if (has7) {
            this.phase = 'CHOOSE_SUIT';
            this.suitChooser = playerId;
            this.stopTurnTimer();
            this.broadcastState();
            return true;
        }

        // Apply skip and advance turns
        this.stopTurnTimer();

        for (let i = 0; i <= skipCount; i++) {
            this.advanceTurnIndex();
        }

        this.startTurnTimer();
        this.broadcastState();
        return true;
    }

    drawCards(playerId) {
        if (this.phase !== 'PLAYING') return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentTurnIndex) return false;

        const player = this.players[playerIndex];

        this.stopTurnTimer();

        if (this.pendingAttack > 0) {
            // Draw penalty cards
            const drawCount = this.pendingAttack;
            for (let i = 0; i < drawCount; i++) {
                this.ensureDeckHasCards();
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
            this.pendingAttack = 0;
            this.pendingAttackType = null;
        } else {
            // Draw 1 card
            this.ensureDeckHasCards();
            if (this.deck.length > 0) {
                player.hand.push(this.deck.pop());
            }
        }

        this.sortHand(player);
        this.lastAction = { playerId, action: 'draw', cards: [] };

        // Check max cards elimination
        this.checkMaxCards(player);

        this.advanceTurnIndex();
        this.startTurnTimer();
        this.broadcastState();
        return true;
    }

    ensureDeckHasCards() {
        if (this.deck.length === 0 && this.discardPile.length > 1) {
            const topCard = this.discardPile.pop();
            this.deck = [...this.discardPile];
            this.discardPile = [topCard];
            this.shuffleDeck();
        }
    }

    advanceTurnIndex() {
        const activePlayers = this.players.filter(p => !p.finished);
        if (activePlayers.length <= 1) return;

        let attempts = 0;
        do {
            this.currentTurnIndex = (this.currentTurnIndex + this.direction + this.players.length) % this.players.length;
            attempts++;
            if (attempts > this.players.length * 2) break;
        } while (this.players[this.currentTurnIndex].finished || !this.players[this.currentTurnIndex].connected);
    }

    nextTurn() {
        this.stopTurnTimer();
        this.advanceTurnIndex();
        this.startTurnTimer();
    }

    startTurnTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timeLeft = this.options.timerDuration;

        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                // Auto draw on timeout
                this.drawCards(this.players[this.currentTurnIndex].id);
            }
        }, 1000);
    }

    stopTurnTimer() {
        if (this.timer) clearInterval(this.timer);
    }

    endGame() {
        this.stopTurnTimer();
        this.clearOneCardWindow();
        this.phase = 'FINISHED';
        this.winner = this.finishedPlayers[0]?.id || null;
        this.broadcastState();
    }

    // === ONE CARD CALLING MECHANIC ===

    /**
     * Start the one card window when a player goes to 1 card
     */
    startOneCardWindow(playerId) {
        this.clearOneCardWindow();
        this.oneCardTarget = playerId;
        this.oneCardCalled = false;

        // 5-second window to call
        this.oneCardTimer = setTimeout(() => {
            if (this.oneCardTarget && !this.oneCardCalled) {
                // Auto-penalize: target didn't call in time
                this.penalizeOneCardTarget();
            }
        }, 5000);
    }

    /**
     * Clear the one card window
     */
    clearOneCardWindow() {
        if (this.oneCardTimer) {
            clearTimeout(this.oneCardTimer);
            this.oneCardTimer = null;
        }
        this.oneCardTarget = null;
        this.oneCardCalled = false;
    }

    /**
     * Penalize the one card target (draw penalty cards)
     */
    penalizeOneCardTarget() {
        const target = this.players.find(p => p.id === this.oneCardTarget);
        if (target && !target.finished) {
            const penalty = this.options.oneCardPenalty || 2;
            for (let i = 0; i < penalty; i++) {
                this.ensureDeckHasCards();
                if (this.deck.length > 0) {
                    target.hand.push(this.deck.pop());
                }
            }
            this.sortHand(target);
            this.checkMaxCards(target);
        }
        this.oneCardTarget = null;
        this.oneCardCalled = false;
        this.oneCardTimer = null;
        this.broadcastState();
    }

    /**
     * Handle a player calling "One Card!"
     * - If valid target exists and not called yet:
     *   - Target calls → safe
     *   - Others call → target penalized (caught!)
     * - If no valid target → false call, presser draws 1 card
     */
    callOneCard(playerId) {
        if (this.phase === 'FINISHED') return { success: false };

        // Active one card window
        if (this.oneCardTarget && !this.oneCardCalled) {
            if (playerId === this.oneCardTarget) {
                // Target called it - SAFE!
                this.oneCardCalled = true;
                this.clearOneCardWindow();
                this.lastAction = { playerId, action: 'onecard_safe', cards: [] };
                this.broadcastState();
                return { success: true, type: 'safe' };
            } else {
                // Someone caught the target!
                this.penalizeOneCardTarget();
                this.lastAction = { playerId, action: 'onecard_catch', cards: [] };
                this.broadcastState();
                return { success: true, type: 'caught' };
            }
        } else {
            // No valid target - false call penalty
            const presser = this.players.find(p => p.id === playerId);
            if (presser && !presser.finished) {
                this.ensureDeckHasCards();
                if (this.deck.length > 0) {
                    presser.hand.push(this.deck.pop());
                }
                this.sortHand(presser);
                this.checkMaxCards(presser);
            }
            this.lastAction = { playerId, action: 'onecard_false', cards: [] };
            this.broadcastState();
            return { success: true, type: 'false_call' };
        }
    }

    // === MAX CARDS ELIMINATION ===

    /**
     * Check if a player has exceeded max cards and should be eliminated
     */
    checkMaxCards(player) {
        if (this.options.maxCards <= 0) return;
        if (player.finished) return;
        if (player.hand.length >= this.options.maxCards) {
            player.finished = true;
            player.eliminated = true;
            this.finishedPlayers.push(player);

            // Check if game should end
            const activePlayers = this.players.filter(p => !p.finished);
            if (activePlayers.length <= 1) {
                if (activePlayers.length === 1) {
                    // Last remaining player is the winner - add to front
                    const winner = activePlayers[0];
                    winner.finished = true;
                    this.finishedPlayers.unshift(winner);
                }
                this.endGame();
            } else if (this.players[this.currentTurnIndex]?.id === player.id) {
                // If eliminated player was current turn, advance
                this.advanceTurnIndex();
            }
        }
    }

    setPlayerConnectionStatus(playerId, isConnected) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.connected = isConnected;
            if (!isConnected && this.phase === 'PLAYING' && this.players[this.currentTurnIndex].id === playerId) {
                this.drawCards(playerId);
            }
            this.broadcastState();
        }
    }

    addWaitingPlayer(player) {
        this.waitingPlayers.push({
            ...player,
            hand: [],
            finished: false,
            connected: true
        });
        this.broadcastState();
    }

    broadcastState() {
        const topCard = this.getTopCard();

        const state = {
            gameType: 'onecard',
            phase: this.phase,
            direction: this.direction,
            pendingAttack: this.pendingAttack,
            pendingAttackType: this.pendingAttackType,
            chosenSuit: this.chosenSuit,
            suitChooser: this.suitChooser,
            topCard: topCard,
            deckCount: this.deck.length,
            discardCount: this.discardPile.length,
            currentTurn: this.players[this.currentTurnIndex]?.id,
            timeLeft: this.timeLeft,
            winner: this.winner,
            lastAction: this.lastAction,
            // One Card state
            oneCardTarget: this.oneCardTarget,
            oneCardCalled: this.oneCardCalled,
            options: {
                sameNumberPlay: this.options.sameNumberPlay,
                attackCardCount: this.options.attackCardCount,
                attackCards: this.options.attackCards,
                maxCards: this.options.maxCards
            },
            finishedPlayers: this.finishedPlayers.map((p, i) => ({
                id: p.id,
                username: p.username,
                rank: i + 1,
                eliminated: !!p.eliminated
            })),
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand ? p.hand.length : 0,
                finished: p.finished,
                connected: p.connected,
                eliminated: !!p.eliminated,
                hand: p.hand
            })),
            waitingPlayers: this.waitingPlayers.map(p => ({
                id: p.id,
                username: p.username
            }))
        };

        this.onUpdate(state);
    }
}

module.exports = OneCardGame;
