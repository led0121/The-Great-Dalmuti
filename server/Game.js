const SeatSelectionPhase = require('./game/SeatSelectionPhase');
const TaxationPhase = require('./game/TaxationPhase');
const MarketPhase = require('./game/MarketPhase');
const RoundManager = require('./game/RoundManager');
const PlayingPhase = require('./game/PlayingPhase');
const GameModes = require('./game/GameModes');

class Game {
    constructor(players, onUpdate, options = {}) {
        this.players = players;
        this.onUpdate = onUpdate;
        this.options = Object.assign({
            timerDuration: 30,
            marketDuration: 60
        }, options);

        this.players.forEach(p => {
            if (!p.hand) p.hand = [];
            if (p.rank === undefined) p.rank = 0;
            p.finished = false;
            p.connected = true;
        });

        this.deck = [];
        this.currentTurnIndex = 0;
        this.lastMove = null;
        this.passes = 0;
        this.finishedPlayers = [];
        this.activePlayersCount = players.length;
        this.round = 1;
        this.timer = null;
        this.timeLeft = 0;
        this.revolutionActive = false;

        this.phase = 'PLAYING';

        this.waitingPlayers = [];

        this.marketPool = [];
        this.marketPasses = new Set();

        this.gameModeSetting = this.options.gameMode || 'random';
        this.activeMode = null;
        this.rankInverted = false;
        this.turnsPlayed = 0;
        this.shuffleTriggerTurn = -1;
    }

    broadcastState() {
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
            seatDeck: this.seatDeck ? this.seatDeck.map(c => ({ id: c.id, isBack: true })) : [],
            seatDeckCount: this.seatDeck ? this.seatDeck.length : 0
        };

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
                hand: p.hand,
                marketPassed: this.marketPasses.has(p.id)
            })),
            activeMode: this.activeMode,
            rankInverted: this.rankInverted,
            gameModeSetting: this.gameModeSetting,
            extraJokerRank: this.extraJokerRank
        };

        this.onUpdate(finalState);
    }
}

Object.assign(Game.prototype, SeatSelectionPhase);
Object.assign(Game.prototype, TaxationPhase);
Object.assign(Game.prototype, MarketPhase);
Object.assign(Game.prototype, RoundManager);
Object.assign(Game.prototype, PlayingPhase);
Object.assign(Game.prototype, GameModes);

module.exports = Game;
