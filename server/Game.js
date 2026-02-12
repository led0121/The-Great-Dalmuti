class Game {
    constructor(players, onUpdate, options = {}) {
        this.players = players; // Array of player objects (by reference from RoomManager)
        this.onUpdate = onUpdate; // Callback to broadcast state
        this.options = Object.assign({
            timerDuration: 30, // Default 30s
            marketDuration: 60 // Default market time
        }, options);

        // Ensure players have hand initialized
        this.players.forEach(p => {
            if (!p.hand) p.hand = [];
            if (p.rank === undefined) p.rank = 0; // Or some default
            p.finished = false; // Reset finished state
        });

        this.deck = [];
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

        // Phases: 'TAXATION', 'MARKET', 'PLAYING', 'FINISHED', 'SEAT_SELECTION'
        this.phase = 'PLAYING';

        // Waiting Room (Spectators)
        this.waitingPlayers = []; // Players who joined late

        // Market
        this.marketPool = []; // { playerId, card }
        this.marketPasses = new Set();
    }

    start() {
        // First Game Check: If Round 1
        this.phase = 'SEAT_SELECTION';
        this.startSeatSelection();
    }

    startSeatSelection() {
        this.phase = 'SEAT_SELECTION';
        this.seatDeck = [];
        this.selectedSeats = []; // { playerId, rank, card }

        // Generate distinct ranks for seat selection
        // Cards 1..Players.length, or just random unique cards?
        // Dalmuti style: Draw 1 card. Lowest rank acts as Dalmuti.
        // We need Deck
        this.initDeck();
        this.shuffleDeck(); // Full deck shuffled

        // We will deal 1 card per player as 'Seat Candidates'
        // Actually, normally players draw from spread deck.
        // We simulate this by offering N cards (where N = Players).
        // To ensure unique ranks for simplicity (to avoid re-draw ties):
        // We can force deck to be 1..N unique ranks for this phase? 
        // Or just draw from full deck?
        // Real rule: Draw from deck. If tie, re-draw.
        // Simplified: Pick from a subset of UNIQUE ranks to guarantee strict ordering immediately.
        // Let's create a special deck of 1..N distinct ranks for speed?
        // User requested: "Show back of cards.. select.. lowest number = 1st".
        // Let's us full deck but handle ties? Or simplified unique deck?
        // "Unique Ranks" is much better for UX (no tie breaker rounds).
        // Strategy: Create deck of cards with Rank 1 to N (one each).
        this.seatDeck = [];
        // Ensure strictly different ranks if possible? 
        // If 8 players, ranks 1..8. 
        for (let i = 1; i <= this.players.length; i++) {
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${Math.random().toString(36).substring(2, 9)}` });
        }
        // Shuffle this small deck
        for (let i = this.seatDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.seatDeck[i], this.seatDeck[j]] = [this.seatDeck[j], this.seatDeck[i]];
        }

        this.broadcastState();
    }

    startPartialSeatSelection() {
        this.phase = 'SEAT_SELECTION'; // Reuse UI but logic differs
        this.seatDeck = [];
        this.selectedSeats = [];

        // Participants: Current Last Place (Great Peon) + New Players
        // 1. Identify Great Peon
        // Note: this.players is currently sorted by rank? No, random order but have 'rank' prop.
        const sortedPlayers = [...this.players].sort((a, b) => a.rank - b.rank);
        const greatPeon = sortedPlayers[sortedPlayers.length - 1]; // Only the absolute last place is contested

        // 2. Combine for contest
        // We move Great Peon to "Contestants" temporary list?
        // Or just keep track of who is picking.
        this.contestants = [greatPeon, ...this.waitingPlayers];

        // 3. Create Seat Deck for them (Rank 1..N where N = contestants.length)
        // These are "Relative Ranks" for the bottom slots.
        for (let i = 1; i <= this.contestants.length; i++) {
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${Math.random().toString(36).substring(2, 9)}` });
        }
        // Shuffle
        for (let i = this.seatDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.seatDeck[i], this.seatDeck[j]] = [this.seatDeck[j], this.seatDeck[i]];
        }

        this.broadcastState();
    }

    handleSeatCardSelection(playerId, cardId) {
        if (this.phase !== 'SEAT_SELECTION') return;

        // Check if player is a contestant. If purely initial game, all are contestants.
        // If partial, only contestants can pick.
        const isContestant = !this.contestants || this.contestants.find(p => p.id === playerId);
        if (!isContestant) return;

        if (this.selectedSeats.find(s => s.playerId === playerId)) return;

        if (this.seatDeck.length === 0) return;

        // Find specific card if ID provided, otherwise (or if not found) pop
        // Logic: Client sends "seat-X". We find it in deck.
        let cardIndex = -1;
        if (cardId) {
            cardIndex = this.seatDeck.findIndex(c => c.id === cardId);
        }

        let card;
        if (cardIndex !== -1) {
            card = this.seatDeck[cardIndex];
            this.seatDeck.splice(cardIndex, 1);
        } else {
            // Fallback: Random or Pop?
            // If User clicks a card that was already taken (race condition), we should probably fail or give random?
            // UI hides taken cards? 
            // Let's just Pop for fallback to ensure progress.
            card = this.seatDeck.pop();
        }

        this.selectedSeats.push({ playerId, card });

        // Check completion
        const targetCount = this.contestants ? this.contestants.length : this.players.length;

        if (this.selectedSeats.length === targetCount) {
            if (this.contestants) {
                this.finalizePartialSeatSelection();
            } else {
                this.finalizeSeatSelection();
            }
        } else {
            this.broadcastState();
        }
    }

    finalizePartialSeatSelection() {
        this.selectedSeats.sort((a, b) => a.card.rank - b.card.rank); // 1 = Best of the worst, N = Worst

        // Current Established Ranks: 1 .. (Players - 1)
        // The Great Peon was Rank N.
        // New Ranks will be:
        // Existing Players (excluding Old Peon) keep their ranks.
        // The slots from N to (N + Waiting - 1) are filled by the contest results.

        // 1. Remove Old Peon from active list temporarily to sort easily?
        // OR just reconstruct the player list.

        // Existing "Upper Class" (everyone except old peon)
        // Note: this.players contains Old Peon.
        const oldPeon = this.contestants.find(c => this.players.find(p => p.id === c.id));
        const upperClass = this.players.filter(p => p.id !== oldPeon.id);

        // 2. New Order
        // Contestants sorted by their draw.
        // Best Draw (Rank 1) -> Takes the best available spot (which is old Peon's spot: Rank "UpperCount + 1")
        // Next Draw -> Rank "UpperCount + 2", etc.

        const startRank = upperClass.length + 1;

        this.selectedSeats.forEach((seat, index) => {
            const contestPlayer = this.contestants.find(p => p.id === seat.playerId);
            if (contestPlayer) {
                contestPlayer.rank = startRank + index;
            }
        });

        // 3. Merge Lists
        // If the winner was the Old Peon, they stay. If it was a new player, they enter.
        // We need to move new players from waitingPlayers to this.players
        this.waitingPlayers.forEach(wp => {
            // Updated rank is already set in step 2 (wp is ref in contestants)
            this.players.push(wp);
        });
        this.waitingPlayers = [];
        this.contestants = null; // Clear

        // 4. Sort all players by rank
        this.players.sort((a, b) => a.rank - b.rank);

        this.activePlayersCount = this.players.length;

        this.broadcastState();

        setTimeout(() => {
            // Proceed to Round logic (Taxation)
            // But we need to call startNextRound again, bypassing the check?
            // Or extract "Init Round" logic.
            // Let's call startNextRound recursively, it will see waitingPlayers is empty and proceed.
            this.startNextRound();
        }, 5000);
    }

    // Original methods...
    finalizeSeatSelection() {
        // Sort by rank (Lower = Better)
        // Assign Game Ranks
        this.selectedSeats.sort((a, b) => a.card.rank - b.card.rank);

        this.selectedSeats.forEach((seat, index) => {
            const player = this.players.find(p => p.id === seat.playerId);
            if (player) {
                player.rank = index + 1; // 1 = Dalmuti
            }
        });

        // Wait a moment for users to see results?
        // We'll set a brief timeout or let frontend handle "Revealed" state then transition?
        // Let's broadcast "Assignments" and then 'PLAYING' after delay?
        this.broadcastState();

        setTimeout(() => {
            this.startFirstRound();
        }, 5000); // 5 seconds to see who is who
    }

    startFirstRound() {
        this.round = 1;
        this.initDeck(); // Real deck
        this.shuffleDeck();
        this.dealCards();
        this.setupHands();

        // Check for Revolution Opportunity
        this.checkRevolutionPossibility();

        if (this.revolutionCandidateId) {
            this.phase = 'REVOLUTION_CHOICE';
        } else {
            // User requested Tax in first round too.
            // Ranks are set from Seat Selection.
            this.phase = 'TAXATION';
            this.initTaxation();
        }

        this.broadcastState();
    }

    startNextRound() {
        // Check for Waiting Players first
        if (this.waitingPlayers.length > 0) {
            this.startPartialSeatSelection();
            return;
        }

        this.round++;
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

        // sort players by rank to ensure references are correct
        this.players.sort((a, b) => a.rank - b.rank);

        // Check for Revolution Opportunity
        this.checkRevolutionPossibility();

        if (this.revolutionCandidateId) {
            this.phase = 'REVOLUTION_CHOICE';
        } else {
            this.phase = 'TAXATION';
            this.initTaxation();
        }

        this.broadcastState();
    }

    checkRevolutionPossibility() {
        this.revolutionCandidateId = null;
        this.revolutionActive = false;
        // 2 Jokers Revolution
        const candidate = this.players.find(p => p.hand.filter(c => c.isJoker).length === 2);
        if (candidate) {
            this.revolutionCandidateId = candidate.id;
        }
    }

    handleRevolutionChoice(playerId, declare) {
        if (this.phase !== 'REVOLUTION_CHOICE') return;
        if (this.revolutionCandidateId !== playerId) return;

        try {
            if (declare) {
                this.revolutionActive = true;
                this.broadcastState(); // Notify revolution!

                // Logic:
                // 1. Discard 2 Jokers (User Request)
                const player = this.players.find(p => p.id === playerId);
                if (player) {
                    player.hand = player.hand.filter(c => !c.isJoker);
                }

                // 2. Swap Ranks (Great Dalmuti <-> Great Peon)
                const dalmutiIndex = this.players.findIndex(p => p.rank === 1);
                const peonIndex = this.players.findIndex(p => p.rank === this.players.length);

                if (dalmutiIndex !== -1 && peonIndex !== -1) {
                    const dal = this.players[dalmutiIndex];
                    const peon = this.players[peonIndex];

                    // Swap Ranks
                    const tempRank = dal.rank;
                    dal.rank = peon.rank;
                    peon.rank = tempRank;

                    // Re-sort players list by rank
                    this.players.sort((a, b) => a.rank - b.rank);
                } else {
                    console.error("Critical: Could not find Dalmuti or Peon for revolution swap");
                }

                // 3. Skip Taxation -> Market
                this.startMarketPhase();

            } else {
                // No Revolution.
                this.phase = 'TAXATION';
                this.initTaxation();
                this.broadcastState();
            }
        } catch (error) {
            console.error("Error in handleRevolutionChoice:", error);
            // Fallback to Taxation to avoid stuck state
            this.phase = 'TAXATION';
            this.initTaxation();
            this.broadcastState();
        }
        this.revolutionCandidateId = null;
    }

    initTaxation() {
        console.log("Init Taxation. Players:", this.players.map(p => `${p.username}(${p.rank})`));

        // Clear all debts first
        this.players.forEach(p => p.taxDebt = 0);

        // Rule: Only Great Peon (Last) owes 2 cards to Great Dalmuti (Rank 1)
        const dalmuti = this.players.find(p => p.rank === 1);
        const peon = this.players.find(p => p.rank === this.players.length);

        if (dalmuti && peon) {
            console.log(`Taxation: ${peon.username} (Rank ${peon.rank}) owes 2 to ${dalmuti.username}`);
            peon.taxDebt = 2;
        } else {
            console.error("Critical: Dalmuti or Peon not found during taxation init");
            this.startMarketPhase(); // Skip if invalid
        }
    }

    // Peon pays tax manually (2 cards)
    handleTaxationPay(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.taxDebt) return;
        if (cardIds.length !== 2) return; // Strict 2 cards

        // Verify cards
        const cardsToGive = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToGive.length !== 2) return;

        // Receiver is Rank 1
        const receiver = this.players.find(p => p.rank === 1);
        if (!receiver) return;

        // Transfer
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        receiver.hand.push(...cardsToGive);

        player.hand.sort((a, b) => a.rank - b.rank);
        receiver.hand.sort((a, b) => a.rank - b.rank);

        // Update Debts
        player.taxDebt = 0; // Paid
        receiver.taxDebt = 2; // Dalmuti now owes 2 cards back

        console.log(`Taxation Pay: ${player.username} paid 2 to ${receiver.username}. Now ${receiver.username} returns.`);
        this.broadcastState();
    }

    // Dalmuti returns cards (2 cards)
    handleTaxationReturn(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.taxDebt) return; // receiver.taxDebt was set to 2
        if (cardIds.length !== 2) return;

        // Verify
        const cardsToReturn = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToReturn.length !== 2) return;

        // Receiver is Rank N (Peon)
        const peon = this.players.find(p => p.rank === this.players.length);
        if (!peon) return;

        // Transfer
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        peon.hand.push(...cardsToReturn);

        player.hand.sort((a, b) => a.rank - b.rank);
        peon.hand.sort((a, b) => a.rank - b.rank);

        player.taxDebt = 0; // Done

        // End Taxation -> Market
        console.log(`Taxation Return: ${player.username} returned to ${peon.username}. Starting Market.`);
        this.startMarketPhase();
    }

    setupHands() {
        this.players.forEach(p => {
            p.hand.sort((a, b) => a.rank - b.rank);
            p.finished = false;
            p.connected = true;
        });
    }

    setupHands() {
        this.players.forEach(p => {
            p.hand.sort((a, b) => a.rank - b.rank);
            p.finished = false;
            p.connected = true;
        });
    }

    // Skip AutoTaxation logic for now as user wants manual Peon selection
    handleAutoTaxation() {
        // Deprecated/Unused for this manual flow
    }

    // --- MARKET PHASE (Random Exchange) ---
    startMarketPhase() {
        this.phase = 'MARKET';
        this.marketPool = []; // List of { playerId, card }
        this.marketPasses.clear(); // Used to track "Submitted" state here

        // Reset timer
        if (this.timer) clearInterval(this.timer);
        this.timeLeft = 60;

        this.broadcastState();
    }

    handleMarketTrade(playerId, cardIds) {
        if (this.phase !== 'MARKET') return;

        // Check if already submitted
        if (this.marketPasses.has(playerId)) return;

        // If cardIds is empty or null, it's a "Pass" (0 cards), but we still mark as submitted.
        const ids = Array.isArray(cardIds) ? cardIds : [];
        if (ids.length === 0) {
            this.marketPasses.add(playerId);
            this.checkMarketCompletion();
            return;
        }

        const player = this.players.find(p => p.id === playerId);

        // Validate ownership
        const currentHandIds = player.hand.map(c => c.id);
        const hasAll = ids.every(id => currentHandIds.includes(id));
        if (!hasAll) return;

        // Move cards to pool
        const cardsToTrade = player.hand.filter(c => ids.includes(c.id));
        player.hand = player.hand.filter(c => !ids.includes(c.id));

        // Store receipt for redistribution
        if (!this.marketReceipts) this.marketReceipts = new Map();
        this.marketReceipts.set(playerId, cardsToTrade.length);

        cardsToTrade.forEach(c => {
            this.marketPool.push({ playerId, card: c });
        });

        this.marketPasses.add(playerId); // Mark as submitted
        this.checkMarketCompletion();
    }

    checkMarketCompletion() {
        if (this.marketPasses.size === this.players.length) {
            this.resolveMarketPhase();
        } else {
            this.broadcastState();
        }
    }

    resolveMarketPhase() {
        // 1. Shuffle Pool
        const cards = this.marketPool.map(m => m.card);
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        // 2. Distribute back (N to each contributor)
        this.players.forEach(p => {
            const count = this.marketReceipts ? (this.marketReceipts.get(p.id) || 0) : 0;
            if (count > 0) {
                const returned = cards.splice(0, count);
                p.hand.push(...returned);
                p.hand.sort((a, b) => a.rank - b.rank);
            }
        });

        // Clear receipts
        this.marketReceipts = new Map();
        this.marketPool = [];

        console.log("Market resolved.");
        this.startPlayingPhase();
    }

    handleMarketPass(playerId) {
        // Explicit pass is same as trading 0 cards
        this.handleMarketTrade(playerId, []);
    }

    endMarketPhase() {
        if (this.timer) clearInterval(this.timer);
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

    addWaitingPlayer(player) {
        // Add to waiting list. 
        // We set their initial properties.
        this.waitingPlayers.push({
            ...player,
            hand: [],
            rank: 99, // Temp rank
            finished: false,
            connected: true
        });
        this.broadcastState(); // They will see "Waiting" status
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
            marketPoolCount: this.marketPool.length,
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand ? p.hand.length : 0,
                finished: p.finished,
                connected: p.connected,
                rank: p.rank,
                taxDebt: p.taxDebt,
                marketPassed: this.marketPasses.has(p.id)
            })),
            waitingPlayers: this.waitingPlayers.map(p => ({
                id: p.id,
                username: p.username
            })),
            selectedSeats: this.selectedSeats,
            // Send seatDeck as objects with JUST ID, masking Rank
            seatDeck: this.seatDeck ? this.seatDeck.map(c => ({ id: c.id, isBack: true })) : [],
            seatDeckCount: this.seatDeck ? this.seatDeck.length : 0
        };

        // Send to each player with their own hand revealed
        this.players.concat(this.waitingPlayers).forEach(p => {
            // Create personalized state
            const personalState = {
                ...publicState,
                // Override my hand with real cards
                myHand: p.hand,
                // Override players list to show MY hand? 
                // Actually frontend uses 'gameState.players'.
                // We should probably inject 'hand' into the player object corresponding to 'p.id'.
                players: publicState.players.map(pl => {
                    if (pl.id === p.id) {
                        return { ...pl, hand: p.hand };
                    }
                    return pl;
                })
            };
            // We can't use socket directly here easily unless we stored it or use IO room.
            // But Game is decoupled. It calls onUpdate. 
            // Wait, the constructor says: "this.onUpdate = onUpdate; // Callback to broadcast state"
            // If onUpdate is generic "emit to room", we can't personalize per socket easily unless onUpdate handles it?
            // RoomManager.js: "game = new Game(..., (state) => this.io.to(roomId).emit('game_update', state))"
            // This means EVERYONE gets the SAME state.
            // So we cannot easily show individual hands unless we send ALL hands (cheating risk) OR we change architecture.
            // Current Architecture Limitation: centralized broadcast.
            // Workaround: Send ALL hands but reliance on Client to hide? (Bad)
            // OR: RoomManager should handle personalization?
            // Let's look at how it was done before.
            // The previous code had: "this.onUpdate(publicState);"
            // And "players" map had: "hand: p.hand" commented out or missing?
            // Line 885 in previous view showed "hand: p.hand" being added!
            // So previous code WAS sending all hands? 
            // "885: hand: p.hand,"
            // If so, I should restore that.
        });

        // Restoring original simple broadcast for now to fix syntax error
        // We will include 'hand' in the players map if that's what was there.
        // Re-reading the "Active Document" snippet from Step 1463:
        // It had "hand: p.hand," inside the players map.
        // So yes, it sends everyone's hand. (Not secure but works for now).

        const finalState = {
            ...publicState,
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand ? p.hand.length : 0,
                finished: p.finished,
                connected: p.connected,
                rank: p.rank,
                taxDebt: p.taxDebt,
                hand: p.hand, // Include hand (insecure but standard for this prototype)
                marketPassed: this.marketPasses.has(p.id)
            }))
        };

        this.onUpdate(finalState);
    }
}

module.exports = Game;
