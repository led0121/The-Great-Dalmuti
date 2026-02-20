module.exports = {
    startMarketPhase() {
        this.phase = 'MARKET';
        this.marketPool = []; // List of { playerId, card }
        this.marketPasses.clear();

        if (this.timer) clearInterval(this.timer);
        this.timeLeft = 60;

        this.broadcastState();
    },

    handleMarketTrade(playerId, cardIds) {
        if (this.phase !== 'MARKET') return;

        if (this.marketPasses.has(playerId)) return;

        const ids = Array.isArray(cardIds) ? cardIds : [];
        if (ids.length === 0) {
            this.marketPasses.add(playerId);
            this.checkMarketCompletion();
            return;
        }

        const player = this.players.find(p => p.id === playerId);

        const currentHandIds = player.hand.map(c => c.id);
        const hasAll = ids.every(id => currentHandIds.includes(id));
        if (!hasAll) return;

        const cardsToTrade = player.hand.filter(c => ids.includes(c.id));
        player.hand = player.hand.filter(c => !ids.includes(c.id));

        if (!this.marketReceipts) this.marketReceipts = new Map();
        this.marketReceipts.set(playerId, cardsToTrade.length);

        cardsToTrade.forEach(c => {
            this.marketPool.push({ playerId, card: c });
        });

        this.marketPasses.add(playerId);
        this.checkMarketCompletion();
    },

    checkMarketCompletion() {
        if (this.marketPasses.size === this.players.length) {
            this.resolveMarketPhase();
        } else {
            this.broadcastState();
        }
    },

    resolveMarketPhase() {
        const cards = this.marketPool.map(m => m.card);
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        this.players.forEach(p => {
            const count = this.marketReceipts ? (this.marketReceipts.get(p.id) || 0) : 0;
            if (count > 0) {
                const returned = cards.splice(0, count);
                p.hand.push(...returned);
                p.hand.sort((a, b) => a.rank - b.rank);
            }
        });

        this.marketReceipts = new Map();
        this.marketPool = [];

        console.log("Market resolved.");
        this.startModeRevealPhase();
    },

    handleMarketPass(playerId) {
        this.handleMarketTrade(playerId, []);
    },

    endMarketPhase() {
        if (this.timer) clearInterval(this.timer);
        this.marketPool = [];
        this.startModeRevealPhase();
    }
};
