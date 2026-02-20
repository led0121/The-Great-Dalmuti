module.exports = {
    start() {
        this.phase = 'SEAT_SELECTION';
        this.startSeatSelection();
    },

    startFirstRound() {
        this.round = 1;
        this.selectMode();
        this.initDeck();
        this.shuffleDeck();
        this.dealCards();
        this.setupHands();

        this.checkRevolutionPossibility();

        if (this.revolutionCandidateId) {
            this.phase = 'REVOLUTION_CHOICE';
        } else {
            this.phase = 'TAXATION';
            this.initTaxation();
        }

        this.broadcastState();
    },

    startNextRound() {
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

        this.activeMode = null;
        this.rankInverted = false;
        this.turnsPlayed = 0;
        this.shuffleTriggerTurn = -1;
        this.selectMode();

        this.players.sort((a, b) => a.rank - b.rank);

        this.checkRevolutionPossibility();

        if (this.revolutionCandidateId) {
            this.phase = 'REVOLUTION_CHOICE';
        } else {
            this.phase = 'TAXATION';
            this.initTaxation();
        }

        this.broadcastState();
    },

    setupHands() {
        this.players.forEach(p => {
            p.hand.sort((a, b) => a.rank - b.rank);
            p.finished = false;
        });
    },

    initDeck() {
        this.deck = [];
        for (let r = 1; r <= 12; r++) {
            for (let i = 0; i < r; i++) {
                this.deck.push({ rank: r, isJoker: false, id: `${r}-${i}` });
            }
        }
        this.deck.push({ rank: 13, isJoker: true, id: 'joker-1' });
        this.deck.push({ rank: 13, isJoker: true, id: 'joker-2' });
    },

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    },

    dealCards() {
        let pIndex = 0;
        this.players.forEach(p => p.hand = []);

        while (this.deck.length > 0) {
            this.players[pIndex].hand.push(this.deck.pop());
            pIndex = (pIndex + 1) % this.players.length;
        }
    },

    endRound() {
        this.stopTurnTimer();
        this.phase = 'FINISHED';

        const unranked = this.players.filter(p => !p.finished);

        let currentRank = this.finishedPlayers.length + 1;
        unranked.forEach(p => {
            p.finished = true;
            p.rank = currentRank++;
        });

        this.finishedPlayers.forEach((p, index) => {
            p.rank = index + 1;
        });

        this.broadcastState();

        console.log("Round Ended. Starting next round in 10s...");
        setTimeout(() => {
            this.startNextRound();
        }, 10000);
    },

    debugEndRound() {
        console.log("DEBUG: Forcing End of Round.");
        const shuffled = [...this.players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        this.finishedPlayers = shuffled;
        this.finishedPlayers.forEach(p => p.finished = true);

        this.endRound();
    },

    addWaitingPlayer(player) {
        this.waitingPlayers.push({
            ...player,
            hand: [],
            rank: 99,
            finished: false,
            connected: true
        });
        this.broadcastState();
    }
};
