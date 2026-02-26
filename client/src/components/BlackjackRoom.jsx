import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS = { hearts: '#ef4444', diamonds: '#ef4444', clubs: '#1f2937', spades: '#1f2937' }

function PlayingCard({ card, hidden = false, small = false }) {
    if (hidden || card?.hidden) {
        return (
            <div className={`${small ? 'w-14 h-20' : 'w-20 h-28'} rounded-xl bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-500/50 shadow-lg flex items-center justify-center`}>
                <span className="text-2xl">🂠</span>
            </div>
        )
    }
    if (!card) return null

    const color = ['hearts', 'diamonds'].includes(card.suit) ? 'text-red-500' : 'text-gray-900'

    return (
        <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`${small ? 'w-14 h-20' : 'w-20 h-28'} rounded-xl bg-white border-2 border-gray-200 shadow-lg flex flex-col items-start justify-between p-1.5 relative`}
        >
            <div className={`font-black ${small ? 'text-xs' : 'text-sm'} leading-none ${color}`}>
                {card.rank}
                <div className={small ? 'text-sm' : 'text-lg'}>{SUIT_SYMBOLS[card.suit]}</div>
            </div>
            <div className={`absolute bottom-1 right-1.5 ${small ? 'text-lg' : 'text-2xl'} ${color}`}>
                {SUIT_SYMBOLS[card.suit]}
            </div>
        </motion.div>
    )
}

export default function BlackjackRoom({ socket, room, gameState, username, onStartGame, onLeave, onUpdateSettings }) {
    const [betInput, setBetInput] = useState(100)
    const { language } = useLanguage()
    const ko = language === 'ko'

    const isOwner = room?.ownerId === socket.id
    const settings = room?.settings || {}
    const phase = gameState?.phase || 'BETTING'
    const myPlayer = gameState?.players?.find(p => p.id === socket.id)
    const isMyTurn = gameState?.currentPlayer === socket.id
    const dealer = gameState?.dealer

    // Lobby View
    if (room?.status === 'LOBBY') {
        return (
            <div className="w-full max-w-4xl mx-auto p-4">
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-purple-400">🂡 {ko ? '블랙잭' : 'Blackjack'}</h2>
                            <p className="text-gray-400 text-sm">Room: {room.name} (ID: {room.id})</p>
                        </div>
                        <button onClick={onLeave} className="text-gray-400 hover:text-red-400 transition-colors text-sm">
                            {ko ? '나가기' : 'Leave'}
                        </button>
                    </div>

                    {/* Players */}
                    <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
                        <h3 className="text-sm text-gray-400 mb-3 font-bold">{ko ? '플레이어' : 'Players'} ({room.players.length})</h3>
                        <div className="flex flex-wrap gap-3">
                            {room.players.map(p => (
                                <div key={p.id} className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-600 flex items-center gap-2">
                                    <span className="text-white font-bold">{p.username}</span>
                                    {p.id === room.ownerId && <span className="text-xs text-amber-400">👑</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Game Type Selector */}
                    {isOwner && (
                        <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                            <h3 className="text-sm text-gray-400 mb-3 font-bold">{ko ? '게임 선택' : 'Select Game'}</h3>
                            <div className="flex gap-2">
                                {['dalmuti', 'onecard', 'blackjack', 'poker'].map(gt => (
                                    <button
                                        key={gt}
                                        onClick={() => onUpdateSettings({ gameType: gt })}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${settings.gameType === gt
                                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {gt === 'dalmuti' ? '👑' : gt === 'onecard' ? '🃏' : gt === 'blackjack' ? '🂡' : '♠️'} {gt.charAt(0).toUpperCase() + gt.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Start Button */}
                    {isOwner && (
                        <button
                            onClick={onStartGame}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-95 text-lg"
                        >
                            🎲 {ko ? '게임 시작' : 'Start Game'}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Game View
    return (
        <div className="w-full h-screen bg-gradient-to-b from-[#0a3d0a] to-[#0d2d0d] flex flex-col relative overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-4 py-2 bg-black/40 backdrop-blur z-50">
                <div className="flex items-center gap-4">
                    <span className="text-purple-400 font-black text-lg">🂡 {ko ? '블랙잭' : 'Blackjack'}</span>
                    <span className="text-gray-400 text-xs">Round #{gameState?.roundNumber || 1}</span>
                </div>
                <div className="flex items-center gap-4">
                    {myPlayer && (
                        <div className="flex items-center gap-1 bg-yellow-900/50 px-3 py-1 rounded-full border border-yellow-500/30">
                            <span>🪙</span>
                            <span className="text-amber-300 font-bold">{(myPlayer.balance || 0).toLocaleString()}</span>
                        </div>
                    )}
                    <button onClick={onLeave} className="text-gray-400 hover:text-red-400 text-sm">
                        {ko ? '나가기' : 'Leave'}
                    </button>
                </div>
            </div>

            {/* Dealer Area */}
            <div className="flex flex-col items-center mt-6">
                <div className="text-gray-300 font-bold mb-2 text-sm">
                    🎩 {ko ? '딜러' : 'Dealer'}
                    {dealer && (phase === 'DEALER_TURN' || phase === 'SETTLED') && (
                        <span className={`ml-2 ${dealer.busted ? 'text-red-400' : 'text-yellow-300'}`}>
                            ({dealer.busted ? 'BUST!' : dealer.value})
                        </span>
                    )}
                    {dealer && (phase === 'PLAYING' || phase === 'BETTING') && dealer.hand?.[0] && (
                        <span className="ml-2 text-yellow-300/50">
                            ({dealer.value || '?'})
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {dealer?.hand?.map((card, i) => (
                        <PlayingCard key={i} card={card} hidden={card?.hidden} />
                    ))}
                </div>
            </div>

            {/* Phase Indicator */}
            <div className="text-center mt-4 mb-2">
                <motion.div
                    key={phase}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`inline-block px-6 py-2 rounded-full font-bold text-sm border ${phase === 'BETTING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            phase === 'PLAYING' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                phase === 'DEALER_TURN' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                    'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}
                >
                    {phase === 'BETTING' ? (ko ? '💰 베팅 중...' : '💰 Betting...') :
                        phase === 'PLAYING' ? (ko ? '🃏 플레이 중' : '🃏 Playing') :
                            phase === 'DEALER_TURN' ? (ko ? '🎩 딜러 턴' : '🎩 Dealer Turn') :
                                (ko ? '🏆 결과' : '🏆 Results')}
                    {gameState?.timeLeft > 0 && ` (${gameState.timeLeft}s)`}
                </motion.div>
            </div>

            {/* Other Players */}
            <div className="flex justify-center gap-6 mt-2 px-4 flex-wrap">
                {gameState?.players?.filter(p => p.id !== socket.id).map(p => (
                    <div key={p.id} className={`bg-gray-900/60 rounded-xl p-3 border ${gameState.currentPlayer === p.id ? 'border-green-400 shadow-lg shadow-green-500/20' : 'border-gray-700/30'
                        }`}>
                        <div className="text-xs text-gray-400 mb-1">{p.username}</div>
                        <div className="flex gap-1">
                            {p.hand?.map((card, i) => (
                                <PlayingCard key={i} card={card} small={true} hidden={phase !== 'SHOWDOWN' && phase !== 'SETTLED'} />
                            ))}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-amber-300">🪙 {p.bet || 0}</span>
                            {p.result && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.result === 'win' || p.result === 'blackjack' ? 'text-green-400 bg-green-500/20' :
                                        p.result === 'push' ? 'text-yellow-400 bg-yellow-500/20' :
                                            'text-red-400 bg-red-500/20'
                                    }`}>
                                    {p.result === 'blackjack' ? 'BJ!' : p.result === 'win' ? 'WIN' : p.result === 'push' ? 'PUSH' : 'LOSE'}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* My Player Area */}
            <div className="bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
                {/* My Hand */}
                {myPlayer && (
                    <div className="flex flex-col items-center mb-4">
                        <div className="flex gap-2 mb-2">
                            {myPlayer.hand?.map((card, i) => (
                                <PlayingCard key={i} card={card} />
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`font-black text-lg ${myPlayer.busted ? 'text-red-400' : 'text-white'}`}>
                                {myPlayer.handValue} {myPlayer.busted ? '💥 BUST!' : ''}
                            </span>
                            {myPlayer.result && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={`text-lg font-black px-4 py-1 rounded-full ${myPlayer.result === 'blackjack' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                                            myPlayer.result === 'win' ? 'bg-green-500 text-white' :
                                                myPlayer.result === 'push' ? 'bg-yellow-600 text-white' :
                                                    'bg-red-600 text-white'
                                        }`}
                                >
                                    {myPlayer.result === 'blackjack' ? '🂡 BLACKJACK!' :
                                        myPlayer.result === 'win' ? '🎉 WIN!' :
                                            myPlayer.result === 'push' ? '🤝 PUSH' :
                                                '😢 LOSE'}
                                </motion.span>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-center items-center flex-wrap">
                    {/* Betting Phase */}
                    {phase === 'BETTING' && myPlayer && !myPlayer.bet && (
                        <>
                            <div className="flex items-center gap-2 bg-gray-900/80 rounded-xl px-3 py-2 border border-gray-600">
                                {[100, 500, 1000, 5000].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setBetInput(amt)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${betInput === amt
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                            }`}
                                    >
                                        {amt.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => socket.emit('blackjack_bet', betInput)}
                                className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-black py-2 px-8 rounded-xl shadow-lg"
                            >
                                🪙 {ko ? '베팅' : 'BET'} {betInput.toLocaleString()}
                            </motion.button>
                        </>
                    )}

                    {/* Playing Phase - My Turn */}
                    {phase === 'PLAYING' && isMyTurn && myPlayer && !myPlayer.stood && !myPlayer.busted && (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => socket.emit('blackjack_hit')}
                                className="bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black py-3 px-8 rounded-xl shadow-lg text-lg"
                            >
                                🃏 {ko ? '히트' : 'HIT'}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => socket.emit('blackjack_stand')}
                                className="bg-gradient-to-r from-red-600 to-rose-500 text-white font-black py-3 px-8 rounded-xl shadow-lg text-lg"
                            >
                                ✋ {ko ? '스탠드' : 'STAND'}
                            </motion.button>
                            {myPlayer.hand?.length === 2 && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => socket.emit('blackjack_double')}
                                    className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black py-3 px-8 rounded-xl shadow-lg text-lg"
                                >
                                    ⚡ {ko ? '더블다운' : 'DOUBLE'}
                                </motion.button>
                            )}
                        </>
                    )}

                    {/* Waiting for turn */}
                    {phase === 'PLAYING' && !isMyTurn && myPlayer && !myPlayer.stood && !myPlayer.busted && (
                        <div className="text-gray-400 text-sm animate-pulse">
                            {ko ? '다른 플레이어 턴을 기다리는 중...' : 'Waiting for other player...'}
                        </div>
                    )}

                    {/* Settled - Restart */}
                    {phase === 'SETTLED' && isOwner && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => socket.emit('restart_game')}
                            className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black py-3 px-10 rounded-xl shadow-lg text-lg"
                        >
                            🔄 {ko ? '다시 하기' : 'Play Again'}
                        </motion.button>
                    )}
                </div>

                {/* Bet Display */}
                {myPlayer?.bet > 0 && (
                    <div className="text-center mt-2">
                        <span className="text-amber-300 text-sm font-bold">
                            🪙 {ko ? '베팅' : 'Bet'}: {myPlayer.bet.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Round Results Overlay */}
            <AnimatePresence>
                {phase === 'SETTLED' && gameState?.roundResults?.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-600 shadow-2xl z-40 min-w-[300px]"
                    >
                        <h3 className="text-xl font-black text-center text-white mb-4">
                            🏆 {ko ? '라운드 결과' : 'Round Results'}
                        </h3>
                        <div className="space-y-2">
                            {gameState.roundResults.map((r, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-800/50 px-4 py-2 rounded-lg">
                                    <span className="text-white font-bold">{r.username}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-black ${r.result === 'win' || r.result === 'blackjack' ? 'text-green-400' :
                                                r.result === 'push' ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {r.result === 'blackjack' ? 'BLACKJACK!' :
                                                r.result === 'win' ? 'WIN' :
                                                    r.result === 'push' ? 'PUSH' : 'LOSE'}
                                        </span>
                                        <span className={`font-bold ${r.payout > r.bet ? 'text-green-400' : r.payout === r.bet ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {r.payout > 0 ? `+${r.payout.toLocaleString()}` : `-${r.bet.toLocaleString()}`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
