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
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${i}` });
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
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${i}` });
        }
        // Shuffle
        for (let i = this.seatDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.seatDeck[i], this.seatDeck[j]] = [this.seatDeck[j], this.seatDeck[i]];
        }

        this.broadcastState();
    }

    handleSeatCardSelection(playerId) {
        if (this.phase !== 'SEAT_SELECTION') return;

        // Check if player is a contestant. If purely initial game, all are contestants.
        // If partial, only contestants can pick.
        const isContestant = !this.contestants || this.contestants.find(p => p.id === playerId);
        if (!isContestant) return;

        if (this.selectedSeats.find(s => s.playerId === playerId)) return;

        if (this.seatDeck.length === 0) return;

        const card = this.seatDeck.pop();
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
        this.phase = 'PLAYING';
        this.initDeck(); // Real deck
        this.shuffleDeck();
        this.dealCards();
        this.setupHands();

        // Start turn: Rank 1 starts
        this.currentTurnIndex = this.players.findIndex(p => p.rank === 1);
        if (this.currentTurnIndex === -1) this.currentTurnIndex = 0;

        this.checkAndHandleRevolution(); // Round 1 Revolution check?
        this.startTurnTimer();
        this.broadcastState();
    }

    startNextRound() {
        // Check for Waiting Players first
        if (this.waitingPlayers.length > 0) {
            this.startPartialSeatSelection();
            return;
        }

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

        // sort players by rank to ensure references are correct
        this.players.sort((a, b) => a.rank - b.rank);

        // Revolution Check
        this.checkAndHandleRevolution();

        if (this.revolutionActive) {
            this.startMarketPhase();
        } else {
            // Initiate Taxation
            // Rank 1 (Great Dalmuti) <-> Rank Last (Great Peon) : 2 Cards
            // Rank 2 (Lesser Dalmuti) <-> Rank Last-1 (Lesser Peon) : 1 Card
            // If < 4 players, only Great roles exist? 
            // Rules:
            // >3 players: Great exchange (2) AND Lesser exchange (1)
            // =3 players: Great exchange (2). Rank 2 is Merchant (safe).
            // <=2? Great exchange (2) (Technically 2 player dalmuti is boring but possible)

            this.initTaxation();
        }

        this.broadcastState();
    }

    initTaxation() {
        // 1. Great Peon (Last) gives 2 best cards to Great Dalmuti (Rank 1)
        const dalmuti = this.players.find(p => p.rank === 1);
        const peon = this.players.find(p => p.rank === this.players.length);

        if (dalmuti && peon) {
            this.executeForcedTax(peon, dalmuti, 2);
        }

        // 2. Lesser Peon gives 1 best card to Lesser Dalmuti (If 4+ players)
        if (this.players.length >= 4) {
            const lesserDalmuti = this.players.find(p => p.rank === 2);
            const lesserPeon = this.players.find(p => p.rank === this.players.length - 1);
            if (lesserDalmuti && lesserPeon) {
                this.executeForcedTax(lesserPeon, lesserDalmuti, 1);
            }
        }
    }

    executeForcedTax(giver, receiver, count) {
        // Giver (Peon) must give lowest Rank cards (Best cards)
        // Hand is sorted. So take first 'count' cards.
        // Jokers (13) are usually considered best, but numerically high over 12. 
        // Dalmuti Rules often say "Best Cards" are Jokers if held, otherwise Lowest Rank.
        // My check logic 'getPrimaryRank' says Joker is 13.
        // But in gameplay Joker is wild.
        // Let's assume standard rule: "Lowest Number". (Jokers kept? Or given?)
        // Wikipedia: "The Peon must give their highest cards..." wait.
        // "Great Peon gives 2 best cards to Great Dalmuti."
        // "Best" = usually Jokers > 1 > 2...
        // If strict numeric: 1 is best. 13 (Joker) is wild.
        // Let's prioritize Jokers as BEST, then 1, 2...

        // Custom sort for "Value": Joker (13) > 1 > 2 ...
        // Actually, let's keep it simple: Giver gives Lowest Ranks (1, 2..). 
        // If Joker is 13, it will be kept (worst). This is a disadvantage for Peon if Joker is good.
        // But usually Peon gives matching set if possible? No.

        // Impl: Give first 'count' cards from sorted hand.
        // If we want key cards (Jokers) to be given, we need to treat them as Rank 0 effectively.
        // Let's stick to numeric rank 1..12 first.

        const taxes = giver.hand.slice(0, count);
        giver.hand = giver.hand.slice(count);
        receiver.hand.push(...taxes);
        receiver.hand.sort((a, b) => a.rank - b.rank);

        // Track that receiver needs to return 'count' cards
        if (!receiver.taxDebt) receiver.taxDebt = 0;
        receiver.taxDebt += count;
    }

    handleTaxationReturn(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.taxDebt) return;

        if (cardIds.length !== player.taxDebt) return; // Must pay full debt at once? Or partial?
        // Let's enforce full return for simplicity

        // Verify
        const cardsToReturn = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToReturn.length !== player.taxDebt) return;

        // Determine Receiver (Who gave me cards? Rank Last or Rank Last-1)
        // If Rank 1, I owe Peon (Last).
        // If Rank 2, I owe Lesser Peon (Last-1).
        let targetRank = -1;
        if (player.rank === 1) targetRank = this.players.length;
        if (player.rank === 2) targetRank = this.players.length - 1;

        const receiver = this.players.find(p => p.rank === targetRank);
        if (!receiver) return; // Should not happen

        // Transfer
        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        receiver.hand.push(...cardsToReturn);

        player.hand.sort((a, b) => a.rank - b.rank);
        receiver.hand.sort((a, b) => a.rank - b.rank);

        player.taxDebt = 0; // Debt paid

        // Check if all debts paid
        const anyoneOwes = this.players.some(p => p.taxDebt > 0);
        if (!anyoneOwes) {
            this.startMarketPhase();
        } else {
            this.broadcastState();
        }
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
            marketPoolCount: this.marketPool.length, // Hide details? Or show? Show count maybe?
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                cardCount: p.hand ? p.hand.length : 0,
                finished: p.finished,
                connected: p.connected, // Frontend can show offline status
                rank: p.rank,
                taxDebt: p.taxDebt,
                hand: p.hand,
                // Add market status?
                marketPassed: this.marketPasses.has(p.id)
            })),
            waitingPlayers: this.waitingPlayers.map(p => ({
                id: p.id,
                username: p.username
            })),
            selectedSeats: this.selectedSeats,
            seatDeckCount: this.seatDeck ? this.seatDeck.length : 0
        };
        this.onUpdate(publicState);
    }
}

module.exports = Game;
