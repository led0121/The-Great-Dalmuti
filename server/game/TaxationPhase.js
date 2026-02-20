module.exports = {
    initTaxation() {
        console.log("Init Taxation. Players:", this.players.map(p => `${p.username}(${p.rank})`));

        if (this.activeMode === 'anarchy') {
            console.log("Anarchy Mode: Taxation Skipped!");
            this.startMarketPhase();
            return;
        }

        // Clear all debts
        this.players.forEach(p => p.taxDebt = 0);
        this.taxationMatches = []; // { debtorId, creditorId, amount, type: 'GIVE'|'RETURN' }

        const rankedPlayers = this.players.filter(p => p.rank > 0 && p.connected).sort((a, b) => a.rank - b.rank);

        if (rankedPlayers.length < 2) {
            this.startMarketPhase();
            return;
        }

        // 1. Great Dalmuti (1st) <-> Great Peon (Last)
        const dalmuti = rankedPlayers[0];
        const peon = rankedPlayers[rankedPlayers.length - 1];

        if (dalmuti && peon && dalmuti.id !== peon.id) {
            console.log(`Taxation Match: ${peon.username} (Peon) -> ${dalmuti.username} (Dalmuti) [2 cards]`);
            peon.taxDebt = 2;
            this.taxationMatches.push({
                debtorId: peon.id,
                creditorId: dalmuti.id,
                amount: 2,
                type: 'GIVE'
            });
        }

        if (this.taxationMatches.length === 0) {
            this.startMarketPhase();
        } else {
            this.broadcastState();
        }
    },

    handleTaxationPay(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;

        const matchIndex = this.taxationMatches.findIndex(m => m.debtorId === playerId && m.type === 'GIVE');
        if (matchIndex === -1) return;
        const match = this.taxationMatches[matchIndex];

        const player = this.players.find(p => p.id === playerId);
        const receiver = this.players.find(p => p.id === match.creditorId);

        if (!player || !receiver) return;
        if (cardIds.length !== match.amount) return;

        const cardsToGive = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToGive.length !== match.amount) return;

        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        receiver.hand.push(...cardsToGive);

        player.hand.sort((a, b) => a.rank - b.rank);
        receiver.hand.sort((a, b) => a.rank - b.rank);

        player.taxDebt = 0;
        receiver.taxDebt = match.amount;

        console.log(`Taxation Pay: ${player.username} paid ${match.amount} to ${receiver.username}.`);

        match.debtorId = receiver.id;
        match.creditorId = player.id;
        match.type = 'RETURN';

        this.broadcastState();
    },

    handleTaxationReturn(playerId, cardIds) {
        if (this.phase !== 'TAXATION') return;

        const matchIndex = this.taxationMatches.findIndex(m => m.debtorId === playerId && m.type === 'RETURN');
        if (matchIndex === -1) return;
        const match = this.taxationMatches[matchIndex];

        const player = this.players.find(p => p.id === playerId); // Dalmuti
        const receiver = this.players.find(p => p.id === match.creditorId); // Peon

        if (!player || !receiver) return;
        if (cardIds.length !== match.amount) return;

        const cardsToReturn = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToReturn.length !== match.amount) return;

        player.hand = player.hand.filter(c => !cardIds.includes(c.id));
        receiver.hand.push(...cardsToReturn);

        player.hand.sort((a, b) => a.rank - b.rank);
        receiver.hand.sort((a, b) => a.rank - b.rank);

        player.taxDebt = 0;
        console.log(`Taxation Return: ${player.username} returned to ${receiver.username}.`);

        this.taxationMatches.splice(matchIndex, 1);

        if (this.taxationMatches.length === 0) {
            this.startMarketPhase();
        } else {
            this.broadcastState();
        }
    },

    handleAutoTaxation() {
        // Deprecated/Unused for this manual flow
    }
};
