module.exports = {
    selectMode() {
        this.activeMode = null;
        this.rankInverted = false;
        this.turnsPlayed = 0;
        this.shuffleTriggerTurn = -1;
        this.extraJokerRank = -1;

        if (this.gameModeSetting === 'none') {
            console.log("Mode Selected: Standard (Forced None)");
            return;
        }

        let selectedMode = null;
        if (this.gameModeSetting !== 'random') {
            selectedMode = this.gameModeSetting;
        } else {
            const roll = Math.random();
            if (roll >= 0.70) {
                const modes = ['revolution', 'shuffle', 'inverted', 'anarchy', 'joker', 'blind'];
                const modeIndex = Math.floor(Math.random() * modes.length);
                selectedMode = modes[modeIndex];
            }
        }

        if (selectedMode) {
            this.activeMode = selectedMode;
            if (this.activeMode === 'inverted') this.rankInverted = true;
            if (this.activeMode === 'shuffle') this.shuffleTriggerTurn = Math.floor(Math.random() * 15) + 3;
        }

        console.log(`Mode Selected for Round ${this.round}: ${this.activeMode || 'Standard'}`);
    },

    updateSettings(settings) {
        if (settings.timerDuration !== undefined) {
            this.options.timerDuration = settings.timerDuration;
        }
        if (settings.gameMode !== undefined) {
            this.gameModeSetting = settings.gameMode;
        }
        this.broadcastState();
    },

    startModeRevealPhase() {
        this.phase = 'MODE_REVEAL';
        this.broadcastState();

        setTimeout(() => {
            this.applyModeEffect();
            this.startPlayingPhase();
        }, 5000);
    },

    applyModeEffect() {
        if (!this.activeMode) return;

        console.log(`Applying Mode Effect: ${this.activeMode}`);

        if (this.activeMode === 'revolution') {
            const ranked = this.players.filter(p => p.rank > 0).sort((a, b) => a.rank - b.rank);
            if (ranked.length >= 2) {
                const dalmuti = ranked[0];
                const peon = ranked[ranked.length - 1];

                const tempHand = dalmuti.hand;
                dalmuti.hand = peon.hand;
                peon.hand = tempHand;

                dalmuti.hand.sort((a, b) => a.rank - b.rank);
                peon.hand.sort((a, b) => a.rank - b.rank);

                console.log(`Revolution Mode: Swapped hands between ${dalmuti.username} and ${peon.username}`);
            }
        } else if (this.activeMode === 'joker') {
            this.extraJokerRank = Math.floor(Math.random() * 12) + 1;
            console.log(`Joker Mode: Rank ${this.extraJokerRank} is now Wild!`);
        }
    },

    triggerShuffleEvent() {
        console.log("Shuffle Mode Triggered! Rotating hands...");
        const activePlayers = this.players.filter(p => !p.finished);
        if (activePlayers.length < 2) return;

        const hands = activePlayers.map(p => p.hand);
        const lastHand = hands.pop();
        hands.unshift(lastHand);

        for (let i = 0; i < activePlayers.length; i++) {
            activePlayers[i].hand = hands[i];
            activePlayers[i].hand.sort((a, b) => a.rank - b.rank);
        }
        console.log("Hands Rotated!");
        this.broadcastState();
    },

    checkRevolutionPossibility() {
        this.revolutionCandidateId = null;
        this.revolutionActive = false;
        const candidate = this.players.find(p => p.hand.filter(c => c.isJoker).length === 2);
        if (candidate) {
            this.revolutionCandidateId = candidate.id;
        }
    },

    handleRevolutionChoice(playerId, declare) {
        if (this.phase !== 'REVOLUTION_CHOICE') return;
        if (this.revolutionCandidateId !== playerId) return;

        try {
            if (declare) {
                this.revolutionActive = true;
                this.broadcastState();

                const player = this.players.find(p => p.id === playerId);
                if (player) {
                    player.hand = player.hand.filter(c => !c.isJoker);
                }

                const dalmutiIndex = this.players.findIndex(p => p.rank === 1);
                const peonIndex = this.players.findIndex(p => p.rank === this.players.length);

                if (dalmutiIndex !== -1 && peonIndex !== -1) {
                    const dal = this.players[dalmutiIndex];
                    const peon = this.players[peonIndex];

                    const tempRank = dal.rank;
                    dal.rank = peon.rank;
                    peon.rank = tempRank;

                    this.players.sort((a, b) => a.rank - b.rank);
                } else {
                    console.error("Critical: Could not find Dalmuti or Peon for revolution swap");
                }

                this.startMarketPhase();

            } else {
                this.phase = 'TAXATION';
                this.initTaxation();
                this.broadcastState();
            }
        } catch (error) {
            console.error("Error in handleRevolutionChoice:", error);
            this.phase = 'TAXATION';
            this.initTaxation();
            this.broadcastState();
        }
        this.revolutionCandidateId = null;
    },

    checkAndHandleRevolution() {
        this.revolutionActive = false;
        const revolutionaryIndex = this.players.findIndex(p => p.hand.filter(c => c.isJoker).length === 2);

        if (revolutionaryIndex !== -1) {
            const dalmutiIndex = this.players.findIndex(p => p.rank === 1);

            if (dalmutiIndex !== -1 && dalmutiIndex !== revolutionaryIndex) {
                this.revolutionActive = true;
                const rev = this.players[revolutionaryIndex];
                const dal = this.players[dalmutiIndex];

                const tempHand = [...rev.hand];
                rev.hand = [...dal.hand];
                dal.hand = tempHand;

                const tempRank = rev.rank;
                rev.rank = dal.rank;
                dal.rank = tempRank;

                rev.hand.sort((a, b) => a.rank - b.rank);
                dal.hand.sort((a, b) => a.rank - b.rank);
            }
        }
    }
};
