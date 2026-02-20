module.exports = {
    startPlayingPhase() {
        this.phase = 'PLAYING';
        this.currentTurnIndex = this.players.findIndex(p => p.rank === 1);
        if (this.currentTurnIndex === -1) this.currentTurnIndex = 0;
        this.turnsPlayed = 0;

        this.startTurnTimer();
        this.broadcastState();
    },

    setPlayerConnectionStatus(playerId, isConnected) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.connected = isConnected;
            if (!isConnected && this.phase === 'PLAYING' && this.players[this.currentTurnIndex].id === playerId) {
                this.handleAutoPass();
            }
            else if (!isConnected && this.phase === 'SEAT_SELECTION') {
                const isContestant = !this.contestants || this.contestants.find(p => p.id === playerId);
                const alreadySelected = this.selectedSeats.find(s => s.playerId === playerId);

                if (isContestant && !alreadySelected && this.seatDeck.length > 0) {
                    console.log(`Auto-selecting seat for disconnected player: ${player.username}`);
                    const randomCardIndex = Math.floor(Math.random() * this.seatDeck.length);
                    const card = this.seatDeck[randomCardIndex];
                    if (card) {
                        this.handleSeatCardSelection(playerId, card.id);
                    }
                } else {
                    this.broadcastState();
                }
            }
            else if (!isConnected && this.phase === 'TAXATION') {
                const matches = this.taxationMatches || [];
                const involved = matches.find(m => m.debtorId === playerId);

                if (involved) {
                    console.log(`Taxation participant ${player.username} disconnected. Aborting Taxation.`);
                    this.startMarketPhase();
                } else {
                    this.broadcastState();
                }
            } else {
                this.broadcastState();
            }
        }
    },

    startTurnTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timeLeft = this.options.timerDuration;

        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.broadcastState();
            } else {
                this.handleAutoPass();
            }
        }, 1000);
    },

    stopTurnTimer() {
        if (this.timer) clearInterval(this.timer);
    },

    handleAutoPass() {
        this.passTurn(this.players[this.currentTurnIndex].id);
    },

    playCards(playerId, cardIds) {
        if (this.phase !== 'PLAYING') return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentTurnIndex) return false;

        const player = this.players[playerIndex];
        const cardsToPlay = player.hand.filter(c => cardIds.includes(c.id));
        if (cardsToPlay.length !== cardIds.length) return false;

        const isWild = (c) => c.isJoker || (this.activeMode === 'joker' && c.rank === this.extraJokerRank);

        const nonJokers = cardsToPlay.filter(c => !isWild(c));
        let currentRank = 13;
        if (nonJokers.length > 0) {
            currentRank = nonJokers[0].rank;
            const allSame = nonJokers.every(c => c.rank === currentRank);
            if (!allSame) return false;
        }

        if (this.lastMove) {
            if (cardsToPlay.length !== this.lastMove.cards.length) return false;

            const lastWild = (c) => c.isJoker || (this.activeMode === 'joker' && c.rank === this.extraJokerRank);
            const lastNonJokers = this.lastMove.cards.filter(c => !lastWild(c));
            const lastRank = lastNonJokers.length > 0 ? lastNonJokers[0].rank : 13;

            if (this.rankInverted) {
                if (currentRank <= lastRank && currentRank !== 13) return false;
            } else {
                if (currentRank >= lastRank) return false;
            }
        }

        player.hand = player.hand.filter(c => !cardIds.includes(c.id));

        this.lastMove = { playerId, cards: cardsToPlay };
        this.passes = 0;

        this.turnsPlayed++;
        if (this.activeMode === 'shuffle' && this.turnsPlayed === this.shuffleTriggerTurn) {
            this.triggerShuffleEvent();
        }
        if (player.hand.length === 0) {
            player.finished = true;
            this.activePlayersCount--;
            this.finishedPlayers.push(player);
        }

        this.nextTurn();
        this.broadcastState();
        return true;
    },

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
    },

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
            if (attempts > this.players.length * 2) break;
        } while (
            this.players[this.currentTurnIndex].finished ||
            !this.players[this.currentTurnIndex].connected
        );

        this.startTurnTimer();
    },

    isRoundOverForFinishedLeader() {
        return this.passes >= this.activePlayersCount;
    },

    getPrimaryRank(cards) {
        const nonJokers = cards.filter(c => !c.isJoker);
        if (nonJokers.length === 0) {
            return 13;
        }
        const firstRank = nonJokers[0].rank;
        const allSame = nonJokers.every(c => c.rank === firstRank);
        if (allSame) return firstRank;
        return -1;
    }
};
