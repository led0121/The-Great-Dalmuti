/**
 * UserDB - JSON file-based user database
 * Stores: users with username, password hash, display name, balance, last daily refill
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'users.json');
const DAILY_AMOUNT = 10000;
const INITIAL_BALANCE = 10000;

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
     * Register a new user
     * @returns {{ success: boolean, error?: string, user?: object }}
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
        const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        this.users[id] = {
            id,
            username: id,
            displayName: displayName.trim(),
            passwordHash: hash,
            balance: INITIAL_BALANCE,
            lastDailyRefill: now,
            createdAt: Date.now()
        };

        this.save();
        return { success: true, user: this.getPublicUser(id) };
    }

    /**
     * Login
     * @returns {{ success: boolean, error?: string, user?: object }}
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

        // Check daily refill
        this.checkDailyRefill(id);

        return { success: true, user: this.getPublicUser(id) };
    }

    /**
     * Check and apply daily refill (midnight reset)
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

    /**
     * Get user balance
     */
    getBalance(userId) {
        const user = this.users[userId];
        if (!user) return 0;
        this.checkDailyRefill(userId);
        return user.balance;
    }

    /**
     * Deduct balance (for betting)
     * @returns {boolean} success
     */
    deductBalance(userId, amount) {
        const user = this.users[userId];
        if (!user) return false;
        if (amount <= 0) return false;
        if (user.balance < amount) return false;

        user.balance -= amount;
        this.save();
        return true;
    }

    /**
     * Add balance (for winning)
     */
    addBalance(userId, amount) {
        const user = this.users[userId];
        if (!user) return false;
        if (amount <= 0) return false;

        user.balance += amount;
        this.save();
        return true;
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
     * Run daily refill for ALL users (called by scheduler)
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
