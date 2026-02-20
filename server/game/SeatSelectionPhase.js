module.exports = {
    startSeatSelection() {
        this.phase = 'SEAT_SELECTION';
        this.seatDeck = [];
        this.selectedSeats = []; // { playerId, rank, card }

        // Generate distinct ranks for seat selection
        this.initDeck();
        this.shuffleDeck(); // Full deck shuffled

        this.seatDeck = [];
        for (let i = 1; i <= this.players.length; i++) {
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${Math.random().toString(36).substring(2, 9)}` });
        }
        // Shuffle this small deck
        for (let i = this.seatDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.seatDeck[i], this.seatDeck[j]] = [this.seatDeck[j], this.seatDeck[i]];
        }

        this.broadcastState();
    },

    startPartialSeatSelection() {
        this.phase = 'SEAT_SELECTION'; // Reuse UI but logic differs
        this.seatDeck = [];
        this.selectedSeats = [];

        // Participants: Current Last Place (Great Peon) + New Players
        const sortedPlayers = [...this.players].sort((a, b) => a.rank - b.rank);
        const greatPeon = sortedPlayers[sortedPlayers.length - 1]; // Only the absolute last place is contested

        this.contestants = [greatPeon, ...this.waitingPlayers];

        for (let i = 1; i <= this.contestants.length; i++) {
            this.seatDeck.push({ rank: i, isJoker: false, id: `seat-${Math.random().toString(36).substring(2, 9)}` });
        }
        // Shuffle
        for (let i = this.seatDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.seatDeck[i], this.seatDeck[j]] = [this.seatDeck[j], this.seatDeck[i]];
        }

        this.broadcastState();
    },

    handleSeatCardSelection(playerId, cardId) {
        if (this.phase !== 'SEAT_SELECTION') return;

        const isContestant = !this.contestants || this.contestants.find(p => p.id === playerId);
        if (!isContestant) return;

        if (this.selectedSeats.find(s => s.playerId === playerId)) return;

        if (this.seatDeck.length === 0) return;

        let cardIndex = -1;
        if (cardId) {
            cardIndex = this.seatDeck.findIndex(c => c.id === cardId);
        }

        let card;
        if (cardIndex !== -1) {
            card = this.seatDeck[cardIndex];
            this.seatDeck.splice(cardIndex, 1);
        } else {
            card = this.seatDeck.pop();
        }

        this.selectedSeats.push({ playerId, card });

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
    },

    finalizePartialSeatSelection() {
        this.selectedSeats.sort((a, b) => a.card.rank - b.card.rank);

        const oldPeon = this.contestants.find(c => this.players.find(p => p.id === c.id));
        const upperClass = this.players.filter(p => p.id !== oldPeon.id);

        const startRank = upperClass.length + 1;

        this.selectedSeats.forEach((seat, index) => {
            const contestPlayer = this.contestants.find(p => p.id === seat.playerId);
            if (contestPlayer) {
                contestPlayer.rank = startRank + index;
            }
        });

        this.waitingPlayers.forEach(wp => {
            this.players.push(wp);
        });
        this.waitingPlayers = [];
        this.contestants = null; // Clear

        this.players.sort((a, b) => a.rank - b.rank);

        this.activePlayersCount = this.players.length;

        this.broadcastState();

        setTimeout(() => {
            this.startNextRound();
        }, 5000);
    },

    finalizeSeatSelection() {
        this.selectedSeats.sort((a, b) => a.card.rank - b.card.rank);

        this.selectedSeats.forEach((seat, index) => {
            const player = this.players.find(p => p.id === seat.playerId);
            if (player) {
                player.rank = index + 1; // 1 = Dalmuti
            }
        });

        this.broadcastState();

        setTimeout(() => {
            this.startFirstRound();
        }, 5000);
    }
};
