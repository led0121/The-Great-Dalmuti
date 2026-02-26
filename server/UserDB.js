/**
 * UserDB - JSON file-based user database
 * Stores: users with username, password hash, display name, balance, stats, game history
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'users.json');
const DAILY_AMOUNT = 10000;
const INITIAL_BALANCE = 10000;
const MAX_HISTORY = 50; // 최근 50건까지 보관

class UserDB {
    constructor() {
        this.users = {};
        this.load();
    }

    load() {
        try {
            const dir = path.dirname(DB_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fs.existsSync(DB_PATH)) {
                const data = fs.readFileSync(DB_PATH, 'utf8');
                this.users = JSON.parse(data);
                // Migrate: add stats/history fields to existing users
                for (const id of Object.keys(this.users)) {
                    if (!this.users[id].stats) {
                        this.users[id].stats = this._createEmptyStats();
                    }
                    if (!this.users[id].gameHistory) {
                        this.users[id].gameHistory = [];
                    }
                }
            }
        } catch (e) {
            console.error('UserDB load error:', e);
            this.users = {};
        }
    }

    save() {
        try {
            const dir = path.dirname(DB_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(DB_PATH, JSON.stringify(this.users, null, 2));
        } catch (e) {
            console.error('UserDB save error:', e);
        }
    }

    /**
     * Create empty stats object
     */
    _createEmptyStats() {
        return {
            // 전체 통계
            totalGames: 0,
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            totalEarnings: 0,    // 총 수익 (벌어들인 코인)
            totalSpent: 0,       // 총 지출 (잃은 코인)
            netProfit: 0,        // 순이익
            currentStreak: 0,    // 현재 연승/연패 (양수=연승, 음수=연패)
            bestStreak: 0,       // 최대 연승
            worstStreak: 0,      // 최대 연패

            // 게임별 통계
            byGame: {
                dalmuti: { games: 0, wins: 0, losses: 0, first: 0, last: 0 },
                onecard: { games: 0, wins: 0, losses: 0, first: 0, last: 0 },
                blackjack: { games: 0, wins: 0, losses: 0, draws: 0, blackjacks: 0, busts: 0, earnings: 0, spent: 0 },
                poker: { games: 0, wins: 0, losses: 0, earnings: 0, spent: 0, allIns: 0, folds: 0 }
            }
        };
    }

    /**
     * Register a new user
     */
    register(username, password, displayName) {
        const id = username.toLowerCase().trim();
        if (!id || id.length < 2 || id.length > 16) {
            return { success: false, error: 'ID는 2~16자여야 합니다' };
        }
        if (!password || password.length < 4) {
            return { success: false, error: '비밀번호는 4자 이상이어야 합니다' };
        }
        if (!displayName || displayName.trim().length < 1 || displayName.trim().length > 16) {
            return { success: false, error: '이름은 1~16자여야 합니다' };
        }
        if (this.users[id]) {
            return { success: false, error: '이미 존재하는 아이디입니다' };
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const now = new Date().toISOString().split('T')[0];

        this.users[id] = {
            id,
            username: id,
            displayName: displayName.trim(),
            passwordHash: hash,
            balance: INITIAL_BALANCE,
            lastDailyRefill: now,
            createdAt: Date.now(),
            stats: this._createEmptyStats(),
            gameHistory: []
        };

        this.save();
        return { success: true, user: this.getPublicUser(id) };
    }

    /**
     * Login
     */
    login(username, password) {
        const id = username.toLowerCase().trim();
        const user = this.users[id];
        if (!user) {
            return { success: false, error: '존재하지 않는 아이디입니다' };
        }
        if (!bcrypt.compareSync(password, user.passwordHash)) {
            return { success: false, error: '비밀번호가 틀렸습니다' };
        }

        this.checkDailyRefill(id);
        return { success: true, user: this.getPublicUser(id) };
    }

    /**
     * Check and apply daily refill
     */
    checkDailyRefill(userId) {
        const user = this.users[userId];
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        if (user.lastDailyRefill !== today) {
            user.balance += DAILY_AMOUNT;
            user.lastDailyRefill = today;
            this.save();
        }
    }

    findAccount(displayName) {
        if (!displayName || displayName.trim().length === 0) return { success: false, error: '이름을 입력해주세요' };

        const matches = [];
        for (const [id, user] of Object.entries(this.users)) {
            if (user.displayName.trim() === displayName.trim()) {
                let un = user.username;
                let masked = un.length > 2 ? un.substring(0, 2) + '*'.repeat(un.length - 2) : un[0] + '*';
                matches.push({ maskedUsername: masked });
            }
        }

        if (matches.length === 0) return { success: false, error: '일치하는 계정 정보가 없습니다' };
        return { success: true, accounts: matches };
    }

    resetPassword(username, displayName, newPassword) {
        if (!username || !displayName) return { success: false, error: '모든 필드를 입력하세요' };
        const id = username.toLowerCase().trim();
        const user = this.users[id];

        if (!user || user.displayName !== displayName.trim()) {
            return { success: false, error: '등록된 정보가 일치하지 않습니다' };
        }
        if (newPassword.length < 4) {
            return { success: false, error: '새 비밀번호는 4자 이상이어야 합니다' };
        }

        const salt = bcrypt.genSaltSync(10);
        user.passwordHash = bcrypt.hashSync(newPassword, salt);
        this.save();
        return { success: true };
    }

    updateAccount(userId, newDisplayName, currentPassword, newPassword) {
        const user = this.users[userId];
        if (!user) return { success: false, error: '유저정보를 찾을 수 없습니다' };

        if (!currentPassword || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
            return { success: false, error: '현재 비밀번호가 일치하지 않습니다' };
        }

        if (newDisplayName && newDisplayName.trim().length >= 2) {
            user.displayName = newDisplayName.trim().substring(0, 16);
        }

        if (newPassword) {
            if (newPassword.length < 4) return { success: false, error: '새 비밀번호는 4자 이상이어야 합니다' };
            const salt = bcrypt.genSaltSync(10);
            user.passwordHash = bcrypt.hashSync(newPassword, salt);
        }

        this.save();
        return { success: true, user: this.getPublicUser(userId) };
    }

    getBalance(userId) {
        const user = this.users[userId];
        if (!user) return 0;
        this.checkDailyRefill(userId);
        return user.balance;
    }

    deductBalance(userId, amount) {
        const user = this.users[userId];
        if (!user) return false;
        if (amount <= 0) return false;
        if (user.balance < amount) return false;

        user.balance -= amount;
        this.save();
        return true;
    }

    addBalance(userId, amount) {
        const user = this.users[userId];
        if (!user) return false;
        if (amount <= 0) return false;

        user.balance += amount;
        this.save();
        return true;
    }

    /**
     * Record a game result
     * @param {string} userId
     * @param {object} result - { gameType, result ('win'|'lose'|'draw'|'blackjack'|'push'|'bust'), 
     *                            rank?, totalPlayers?, earnings, spent, details? }
     */
    recordGameResult(userId, result) {
        const user = this.users[userId];
        if (!user) return;

        if (!user.stats) user.stats = this._createEmptyStats();
        if (!user.gameHistory) user.gameHistory = [];

        const stats = user.stats;
        const gameType = result.gameType || 'unknown';
        const isWin = ['win', 'blackjack'].includes(result.result);
        const isLoss = ['lose', 'bust'].includes(result.result);
        const isDraw = ['draw', 'push'].includes(result.result);
        const earnings = result.earnings || 0;
        const spent = result.spent || 0;

        // === 전체 통계 업데이트 ===
        stats.totalGames++;
        if (isWin) stats.totalWins++;
        else if (isLoss) stats.totalLosses++;
        else if (isDraw) stats.totalDraws++;

        stats.totalEarnings += earnings;
        stats.totalSpent += spent;
        stats.netProfit = stats.totalEarnings - stats.totalSpent;

        // 연승/연패 계산
        if (isWin) {
            if (stats.currentStreak >= 0) {
                stats.currentStreak++;
            } else {
                stats.currentStreak = 1;
            }
            stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
        } else if (isLoss) {
            if (stats.currentStreak <= 0) {
                stats.currentStreak--;
            } else {
                stats.currentStreak = -1;
            }
            stats.worstStreak = Math.min(stats.worstStreak, stats.currentStreak);
        }
        // draw는 스트릭을 리셋하지 않음

        // === 게임별 통계 업데이트 ===
        if (!stats.byGame[gameType]) {
            stats.byGame[gameType] = { games: 0, wins: 0, losses: 0 };
        }
        const gameStat = stats.byGame[gameType];
        gameStat.games++;

        if (isWin) gameStat.wins++;
        else if (isLoss) gameStat.losses++;

        // 게임 타입별 특수 통계
        if (gameType === 'dalmuti') {
            if (result.rank === 1) gameStat.first = (gameStat.first || 0) + 1;
            if (result.rank === result.totalPlayers) gameStat.last = (gameStat.last || 0) + 1;
        } else if (gameType === 'onecard') {
            if (result.rank === 1) gameStat.first = (gameStat.first || 0) + 1;
            if (result.rank === result.totalPlayers) gameStat.last = (gameStat.last || 0) + 1;
        } else if (gameType === 'blackjack') {
            if (result.result === 'blackjack') gameStat.blackjacks = (gameStat.blackjacks || 0) + 1;
            if (result.result === 'bust') gameStat.busts = (gameStat.busts || 0) + 1;
            if (isDraw) gameStat.draws = (gameStat.draws || 0) + 1;
            gameStat.earnings = (gameStat.earnings || 0) + earnings;
            gameStat.spent = (gameStat.spent || 0) + spent;
        } else if (gameType === 'poker') {
            gameStat.earnings = (gameStat.earnings || 0) + earnings;
            gameStat.spent = (gameStat.spent || 0) + spent;
        }

        // === 게임 히스토리 기록 ===
        const historyEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            gameType,
            result: result.result,
            rank: result.rank || null,
            totalPlayers: result.totalPlayers || null,
            earnings,
            spent,
            netGain: earnings - spent,
            details: result.details || null,
            timestamp: Date.now(),
            date: new Date().toISOString()
        };

        user.gameHistory.unshift(historyEntry); // 최신순

        // 최대 보관 수 제한
        if (user.gameHistory.length > MAX_HISTORY) {
            user.gameHistory = user.gameHistory.slice(0, MAX_HISTORY);
        }

        this.save();
    }

    /**
     * Get user stats
     */
    getStats(userId) {
        const user = this.users[userId];
        if (!user) return null;

        const stats = user.stats || this._createEmptyStats();
        const winRate = stats.totalGames > 0 ? ((stats.totalWins / stats.totalGames) * 100).toFixed(1) : '0.0';

        // 게임별 승률 계산
        const byGameWithRates = {};
        for (const [gt, gs] of Object.entries(stats.byGame)) {
            byGameWithRates[gt] = {
                ...gs,
                winRate: gs.games > 0 ? ((gs.wins / gs.games) * 100).toFixed(1) : '0.0'
            };
        }

        return {
            ...stats,
            winRate,
            byGame: byGameWithRates
        };
    }

    /**
     * Get game history
     */
    getGameHistory(userId, limit = 20) {
        const user = this.users[userId];
        if (!user) return [];

        return (user.gameHistory || []).slice(0, limit);
    }

    /**
     * Get public user info (safe to send to client)
     */
    getPublicUser(userId) {
        const user = this.users[userId];
        if (!user) return null;
        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            balance: user.balance
        };
    }

    /**
     * Get full profile (stats + balance, no password)
     */
    getProfile(userId) {
        const user = this.users[userId];
        if (!user) return null;

        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            balance: user.balance,
            createdAt: user.createdAt,
            stats: this.getStats(userId),
            recentGames: this.getGameHistory(userId, 10)
        };
    }

    /**
     * Get leaderboard (top N users by various criteria)
     */
    getLeaderboard(sortBy = 'winRate', limit = 10) {
        const users = Object.values(this.users)
            .filter(u => (u.stats?.totalGames || 0) > 0) // 최소 1게임 이상
            .map(u => ({
                id: u.id,
                displayName: u.displayName,
                balance: u.balance,
                totalGames: u.stats?.totalGames || 0,
                totalWins: u.stats?.totalWins || 0,
                winRate: u.stats?.totalGames > 0 ? ((u.stats.totalWins / u.stats.totalGames) * 100) : 0,
                netProfit: u.stats?.netProfit || 0,
                bestStreak: u.stats?.bestStreak || 0
            }));

        // 정렬
        switch (sortBy) {
            case 'winRate':
                users.sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames);
                break;
            case 'totalWins':
                users.sort((a, b) => b.totalWins - a.totalWins);
                break;
            case 'netProfit':
                users.sort((a, b) => b.netProfit - a.netProfit);
                break;
            case 'totalGames':
                users.sort((a, b) => b.totalGames - a.totalGames);
                break;
            case 'balance':
                users.sort((a, b) => b.balance - a.balance);
                break;
            default:
                users.sort((a, b) => b.winRate - a.winRate);
        }

        return users.slice(0, limit).map((u, i) => ({
            ...u,
            rank: i + 1,
            winRate: u.winRate.toFixed(1)
        }));
    }

    /**
     * Run daily refill for ALL users
     */
    runDailyRefillAll() {
        const today = new Date().toISOString().split('T')[0];
        let count = 0;
        for (const id of Object.keys(this.users)) {
            if (this.users[id].lastDailyRefill !== today) {
                this.users[id].balance += DAILY_AMOUNT;
                this.users[id].lastDailyRefill = today;
                count++;
            }
        }
        if (count > 0) {
            this.save();
            console.log(`Daily refill: ${count} users received ${DAILY_AMOUNT} coins`);
        }
    }
}

module.exports = UserDB;
