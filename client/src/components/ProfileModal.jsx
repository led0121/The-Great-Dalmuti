import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

const GAME_ICONS = {
    dalmuti: '👑',
    onecard: '🃏',
    blackjack: '🂡',
    poker: '♠️',
    slot: '🍒',
    roulette: '🎡'
}

const GAME_LABELS = {
    dalmuti: { ko: '달무티', en: 'Dalmuti' },
    onecard: { ko: '원카드', en: 'OneCard' },
    blackjack: { ko: '블랙잭', en: 'Blackjack' },
    poker: { ko: '포커', en: 'Poker' },
    slot: { ko: '슬롯머신', en: 'Slot' },
    roulette: { ko: '룰렛', en: 'Roulette' }
}

const RESULT_COLORS = {
    win: 'text-green-400',
    blackjack: 'text-yellow-400',
    lose: 'text-red-400',
    bust: 'text-red-500',
    push: 'text-gray-400',
    draw: 'text-gray-400'
}

const RESULT_LABELS = {
    win: { ko: '승리', en: 'Win' },
    blackjack: { ko: '블랙잭!', en: 'Blackjack!' },
    lose: { ko: '패배', en: 'Lose' },
    bust: { ko: '버스트', en: 'Bust' },
    push: { ko: '푸시', en: 'Push' },
    draw: { ko: '무승부', en: 'Draw' }
}

export default function ProfileModal({ socket, isOpen, onClose }) {
    const { language } = useLanguage()
    const ko = language === 'ko'
    const [tab, setTab] = useState('stats') // stats, history, leaderboard
    const [profile, setProfile] = useState(null)
    const [history, setHistory] = useState([])
    const [leaderboard, setLeaderboard] = useState([])
    const [leaderboardSort, setLeaderboardSort] = useState('winRate')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isOpen) return
        setLoading(true)

        socket.emit('get_profile', null, (data) => {
            setProfile(data)
            setLoading(false)
        })

        socket.emit('get_game_history', { limit: 30 }, (data) => {
            setHistory(data || [])
        })

        socket.emit('get_leaderboard', { sortBy: leaderboardSort, limit: 15 }, (data) => {
            setLeaderboard(data || [])
        })
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return
        socket.emit('get_leaderboard', { sortBy: leaderboardSort, limit: 15 }, (data) => {
            setLeaderboard(data || [])
        })
    }, [leaderboardSort])

    // Listen for stats updates
    useEffect(() => {
        const handleStatsUpdate = (stats) => {
            if (profile) {
                setProfile(prev => prev ? { ...prev, stats } : prev)
            }
        }
        socket.on('stats_update', handleStatsUpdate)
        return () => socket.off('stats_update', handleStatsUpdate)
    }, [profile])

    if (!isOpen) return null

    const stats = profile?.stats

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-gray-600/50 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/70 hover:text-white text-xl"
                        >
                            ✕
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-black text-white border-2 border-white/30">
                                {profile?.displayName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">{profile?.displayName || '...'}</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-white/80 text-sm">@{profile?.username}</span>
                                    <span className="text-amber-300 text-sm font-bold">🪙 {(profile?.balance || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-700">
                        {[
                            { key: 'stats', label: ko ? '📊 전적' : '📊 Stats' },
                            { key: 'history', label: ko ? '📜 기록' : '📜 History' },
                            { key: 'leaderboard', label: ko ? '🏆 랭킹' : '🏆 Ranking' },
                            { key: 'settings', label: ko ? '⚙️ 설정' : '⚙️ Setting' }
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex-1 py-3 text-sm font-bold transition-all ${tab === t.key
                                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 200px)' }}>
                        {loading ? (
                            <div className="text-center py-12 text-gray-400 animate-pulse text-lg">
                                {ko ? '불러오는 중...' : 'Loading...'}
                            </div>
                        ) : tab === 'stats' ? (
                            <StatsTab stats={stats} ko={ko} profile={profile} />
                        ) : tab === 'history' ? (
                            <HistoryTab history={history} ko={ko} />
                        ) : tab === 'settings' ? (
                            <SettingsTab socket={socket} ko={ko} profile={profile} onClose={onClose} />
                        ) : (
                            <LeaderboardTab
                                leaderboard={leaderboard}
                                sortBy={leaderboardSort}
                                onSortChange={setLeaderboardSort}
                                ko={ko}
                                myId={profile?.id}
                            />
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

function StatsTab({ stats, ko, profile }) {
    if (!stats) return <div className="text-gray-500 text-center py-8">{ko ? '데이터가 없습니다' : 'No data'}</div>

    const winRate = stats.winRate || '0.0'
    const winRateNum = parseFloat(winRate)

    return (
        <div className="space-y-5">
            {/* Overview Cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/30">
                    <div className="text-3xl font-black text-white">{stats.totalGames}</div>
                    <div className="text-xs text-gray-400 mt-1">{ko ? '총 경기' : 'Games'}</div>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/30">
                    <div className={`text-3xl font-black ${winRateNum >= 50 ? 'text-green-400' : winRateNum >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {winRate}%
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{ko ? '승률' : 'Win Rate'}</div>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-4 text-center border border-gray-600/30">
                    <div className={`text-3xl font-black ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{ko ? '순이익' : 'Net Profit'}</div>
                </div>
            </div>

            {/* Win/Loss Bar */}
            <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/20">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-400 font-bold">{stats.totalWins}{ko ? '승' : 'W'}</span>
                    <span className="text-gray-400 font-bold">{stats.totalDraws}{ko ? '무' : 'D'}</span>
                    <span className="text-red-400 font-bold">{stats.totalLosses}{ko ? '패' : 'L'}</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                    {stats.totalGames > 0 && (
                        <>
                            <div className="bg-green-500 h-full" style={{ width: `${(stats.totalWins / stats.totalGames) * 100}%` }} />
                            <div className="bg-gray-400 h-full" style={{ width: `${(stats.totalDraws / stats.totalGames) * 100}%` }} />
                            <div className="bg-red-500 h-full" style={{ width: `${(stats.totalLosses / stats.totalGames) * 100}%` }} />
                        </>
                    )}
                </div>
            </div>

            {/* Streak */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/30 rounded-xl p-3 border border-gray-600/20">
                    <div className="text-xs text-gray-500 mb-1">{ko ? '현재 스트릭' : 'Current Streak'}</div>
                    <div className={`text-xl font-black ${stats.currentStreak > 0 ? 'text-green-400' : stats.currentStreak < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}${ko ? '연승' : 'W'}` :
                            stats.currentStreak < 0 ? `💀 ${Math.abs(stats.currentStreak)}${ko ? '연패' : 'L'}` :
                                '-'}
                    </div>
                </div>
                <div className="bg-gray-700/30 rounded-xl p-3 border border-gray-600/20">
                    <div className="text-xs text-gray-500 mb-1">{ko ? '최대 연승' : 'Best Streak'}</div>
                    <div className="text-xl font-black text-amber-400">
                        🏆 {stats.bestStreak}{ko ? '연승' : 'W'}
                    </div>
                </div>
            </div>

            {/* Per-Game Stats */}
            <div>
                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">
                    {ko ? '게임별 전적' : 'Stats by Game'}
                </h3>
                <div className="space-y-2">
                    {Object.entries(stats.byGame || {}).map(([gameType, gs]) => {
                        if (gs.games === 0) return null
                        return (
                            <div key={gameType} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/20 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{GAME_ICONS[gameType] || '🎮'}</span>
                                    <div>
                                        <div className="text-white font-bold text-sm">{GAME_LABELS[gameType]?.[ko ? 'ko' : 'en'] || gameType}</div>
                                        <div className="text-xs text-gray-500">{gs.games}{ko ? '경기' : ' games'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-green-400 font-bold">{gs.wins}W</span>
                                    <span className="text-red-400 font-bold">{gs.losses}L</span>
                                    <span className={`font-black ${parseFloat(gs.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                        {gs.winRate}%
                                    </span>
                                    {/* Blackjack specific */}
                                    {gameType === 'blackjack' && gs.blackjacks > 0 && (
                                        <span className="text-yellow-400 text-xs">BJ:{gs.blackjacks}</span>
                                    )}
                                    {/* Dalmuti/OneCard specific */}
                                    {(gameType === 'dalmuti' || gameType === 'onecard') && gs.first > 0 && (
                                        <span className="text-amber-400 text-xs">🥇{gs.first}</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Earnings Summary */}
            <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/20">
                <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">{ko ? '코인 관련' : 'Coins'}</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                        <div className="text-green-400 font-bold">{stats.totalEarnings.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500">{ko ? '총 수익' : 'Earned'}</div>
                    </div>
                    <div>
                        <div className="text-red-400 font-bold">{stats.totalSpent.toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500">{ko ? '총 지출' : 'Spent'}</div>
                    </div>
                    <div>
                        <div className={`font-bold ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-500">{ko ? '순이익' : 'Net'}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function HistoryTab({ history, ko }) {
    if (!history || history.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                {ko ? '게임 기록이 없습니다' : 'No game history'}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {history.map((game, i) => {
                const isWin = ['win', 'blackjack'].includes(game.result)
                const isDraw = ['draw', 'push'].includes(game.result)
                const date = new Date(game.timestamp)
                const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

                return (
                    <motion.div
                        key={game.id || i}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-3 border-l-4 ${isWin ? 'border-green-500' : isDraw ? 'border-gray-500' : 'border-red-500'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{GAME_ICONS[game.gameType] || '🎮'}</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm ${RESULT_COLORS[game.result] || 'text-gray-400'}`}>
                                        {RESULT_LABELS[game.result]?.[ko ? 'ko' : 'en'] || game.result}
                                    </span>
                                    {game.rank && (
                                        <span className="text-xs text-gray-500">
                                            #{game.rank}/{game.totalPlayers}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-500">{dateStr}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`font-bold text-sm ${game.netGain > 0 ? 'text-green-400' : game.netGain < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {game.netGain > 0 ? '+' : ''}{game.netGain.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-500">{GAME_LABELS[game.gameType]?.[ko ? 'ko' : 'en'] || game.gameType}</div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}

function LeaderboardTab({ leaderboard, sortBy, onSortChange, ko, myId }) {
    const sortOptions = [
        { key: 'winRate', label: ko ? '승률' : 'Win Rate' },
        { key: 'totalWins', label: ko ? '총 승리' : 'Wins' },
        { key: 'totalGames', label: ko ? '경기 수' : 'Games' },
        { key: 'netProfit', label: ko ? '순이익' : 'Profit' },
        { key: 'balance', label: ko ? '잔고' : 'Balance' },
    ]

    return (
        <div>
            {/* Sort Options */}
            <div className="flex gap-1 mb-4 flex-wrap">
                {sortOptions.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => onSortChange(opt.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === opt.key
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="space-y-1.5">
                {leaderboard.map((user, i) => {
                    const isMe = user.id === myId
                    const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${user.rank}`

                    return (
                        <motion.div
                            key={user.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                            className={`flex items-center justify-between px-4 py-3 rounded-lg ${isMe ? 'bg-purple-500/20 border border-purple-500/40' : 'bg-gray-700/30 border border-gray-700/20'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-lg font-black min-w-[32px] text-center ${i < 3 ? 'text-xl' : 'text-gray-500 text-sm'}`}>
                                    {medalEmoji}
                                </span>
                                <div>
                                    <div className={`font-bold text-sm ${isMe ? 'text-purple-300' : 'text-white'}`}>
                                        {user.displayName}
                                        {isMe && <span className="text-xs text-purple-400 ml-1">(나)</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {user.totalGames}{ko ? '경기' : ' games'} · {user.totalWins}W
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {sortBy === 'winRate' && (
                                    <div className={`font-black text-lg ${parseFloat(user.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                        {user.winRate}%
                                    </div>
                                )}
                                {sortBy === 'totalWins' && (
                                    <div className="font-black text-lg text-green-400">{user.totalWins}</div>
                                )}
                                {sortBy === 'totalGames' && (
                                    <div className="font-black text-lg text-blue-400">{user.totalGames}</div>
                                )}
                                {sortBy === 'netProfit' && (
                                    <div className={`font-black text-lg ${user.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {user.netProfit >= 0 ? '+' : ''}{user.netProfit.toLocaleString()}
                                    </div>
                                )}
                                {sortBy === 'balance' && (
                                    <div className="font-black text-lg text-amber-400">🪙 {user.balance.toLocaleString()}</div>
                                )}
                            </div>
                        </motion.div>
                    )
                })}

                {leaderboard.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        {ko ? '아직 데이터가 없습니다' : 'No data yet'}
                    </div>
                )}
            </div>
        </div>
    )
}

function SettingsTab({ socket, ko, profile, onClose }) {
    const [newDisplayName, setNewDisplayName] = useState(profile?.displayName || '')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        setErrorMsg('')
        setSuccessMsg('')

        if (!currentPassword) {
            return setErrorMsg(ko ? '현재 비밀번호를 입력해주세요' : 'Enter current password')
        }

        socket.emit('auth_update_account', {
            newDisplayName: newDisplayName !== profile?.displayName ? newDisplayName : null,
            currentPassword,
            newPassword: newPassword || null
        }, (res) => {
            if (res.success) {
                setSuccessMsg(ko ? '계정 정보가 변경되었습니다' : 'Account updated')
                setCurrentPassword('')
                setNewPassword('')
                // Wait briefly, then close or refresh
                setTimeout(onClose, 1500)
            } else {
                setErrorMsg(res.error)
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto p-4 bg-gray-900 border border-gray-700/50 rounded-xl">
            <h3 className="font-black text-xl mb-4 text-purple-400">⚙️ {ko ? '설정' : 'Settings'}</h3>

            <div>
                <label className="block text-xs text-gray-400 mb-1">{ko ? '새로운 닉네임 (원치 않으면 공란)' : 'New Display Name'}</label>
                <input
                    type="text"
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white outline-none focus:border-purple-500"
                    placeholder={profile?.displayName}
                />
            </div>

            <div>
                <label className="block text-xs text-gray-400 mb-1">{ko ? '새로운 비밀번호 (원치 않으면 공란)' : 'New Password'}</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white outline-none focus:border-purple-500"
                />
            </div>

            <div className="pt-2">
                <label className="block text-xs text-red-300 mb-1 font-bold">{ko ? '현재 비밀번호 (필수)' : 'Current Password (Required)'}</label>
                <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-red-900/50 rounded-lg text-white outline-none focus:border-red-500"
                />
            </div>

            <button type="submit" className="w-full mt-4 bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold transition-all text-white">
                {ko ? '변경 사항 저장' : 'Save Changes'}
            </button>

            {errorMsg && <div className="text-sm text-red-400 mt-2 bg-red-900/20 p-2 rounded">{errorMsg}</div>}
            {successMsg && <div className="text-sm text-green-400 mt-2 bg-green-900/20 p-2 rounded">{successMsg}</div>}
        </form>
    )
}
