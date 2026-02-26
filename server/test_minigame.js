const io = require('socket.io-client');
const socket = io('http://localhost:3000');
socket.on('connect', () => {
    console.log('Connected');
    socket.emit('register', { username: 'mini2', password: '1234', displayName: 'Mini2' }, (res) => {
        console.log('Register auth:', res);
        if (!res.success) {
            socket.emit('auth_login', { username: 'mini2', password: '1234' }, (res2) => {
                console.log('Login auth:', res2);
                runTests();
            });
        } else {
            runTests();
        }
    });
});

function runTests() {
    console.log('Logged in with full auth');
    socket.emit('play_minigame', { gameType: 'slot', betAmount: 100 }, (res) => {
        console.log('Slot result:', res);

        socket.emit('play_minigame', { gameType: 'roulette', betAmount: 500, extraData: { color: 'green' } }, (res2) => {
            console.log('Roulette result:', res2);

            socket.emit('get_profile', null, (profile) => {
                console.log('Profile netProfit:', profile.stats.netProfit);
                console.log('Profile byGame:', JSON.stringify(profile.stats.byGame, null, 2));
                process.exit(0);
            });
        });
    });
}
setTimeout(() => { console.log('Timeout'); process.exit(1); }, 3000);
