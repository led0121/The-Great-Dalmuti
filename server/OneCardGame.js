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
        const defaultAttackCards = { two: true, ace: true, blackJoker: true, colorJoker: true };
        const incomingAttackCards = options.attackCards || {};

        this.options = {
            attackCardCount: options.attackCardCount || 1,
            sameNumberPlay: options.sameNumberPlay !== undefined ? options.sameNumberPlay : false,
            timerDuration: options.timerDuration || 30,
            attackCards: {
                two: incomingAttackCards.two !== undefined ? incomingAttackCards.two : defaultAttackCards.two,
                ace: incomingAttackCards.ace !== undefined ? incomingAttackCards.ace : defaultAttackCards.ace,
                blackJoker: incomingAttackCards.blackJoker !== undefined ? incomingAttackCards.blackJoker : defaultAttackCards.blackJoker,
                colorJoker: incomingAttackCards.colorJoker !== undefined ? incomingAttackCards.colorJoker : defaultAttackCards.colorJoker,
            }
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
    }

    start() {
        this.initDeck();
        this.shuffleDeck();
        this.dealCards(7); // 7 cards each

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
            if (this.options.attackCards.blackJoker) {
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
            if (this.options.attackCards.colorJoker) {
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
        if (card.rank === '2' && ac.two) return true;
        if (card.rank === 'A' && ac.ace) return true;
        if (card.rank === 'BJ' && ac.blackJoker) return true;
        if (card.rank === 'CJ' && ac.colorJoker) return true;
        return false;
    }

    /**
     * Get the attack value for a card
     */
    getAttackValue(card) {
        if (card.rank === '2') return 2;
        if (card.rank === 'A') return 3;
        if (card.rank === 'BJ') return 5;
        if (card.rank === 'CJ') return 7;
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

        // Check win
        if (player.hand.length === 0) {
            player.finished = true;
            this.finishedPlayers.push(player);

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
        this.phase = 'FINISHED';
        this.winner = this.finishedPlayers[0]?.id || null;
        this.broadcastState();
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
            options: {
                sameNumberPlay: this.options.sameNumberPlay,
                attackCardCount: this.options.attackCardCount,
                attackCards: this.options.attackCards
            },
            finishedPlayers: this.finishedPlayers.map((p, i) => ({
                id: p.id,
                username: p.username,
                rank: i + 1
            })),
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand ? p.hand.length : 0,
                finished: p.finished,
                connected: p.connected,
                hand: p.hand // Include hand (prototype approach)
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
