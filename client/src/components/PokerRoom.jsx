import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }

function PlayingCard({ card, hidden = false, small = false }) {
    if (hidden || !card) {
        return (
            <div className={`${small ? 'w-12 h-18' : 'w-16 h-24'} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-500/50 shadow-lg flex items-center justify-center`}>
                <span className={small ? 'text-lg' : 'text-xl'}>🂠</span>
            </div>
        )
    }

    const isRed = ['hearts', 'diamonds'].includes(card.suit)
    const color = isRed ? 'text-red-500' : 'text-gray-900'

    return (
        <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`${small ? 'w-12 h-18' : 'w-16 h-24'} rounded-lg bg-white border-2 border-gray-200 shadow-lg flex flex-col items-start justify-between p-1 relative`}
        >
            <div className={`font-black ${small ? 'text-[10px]' : 'text-xs'} leading-none ${color}`}>
                {card.rank}
                <div className={small ? 'text-sm' : 'text-base'}>{SUIT_SYMBOLS[card.suit]}</div>
            </div>
            <div className={`absolute bottom-0.5 right-1 ${small ? 'text-base' : 'text-xl'} ${color}`}>
                {SUIT_SYMBOLS[card.suit]}
            </div>
        </motion.div>
    )
}

export default function PokerRoom({ socket, room, gameState, username, onStartGame, onLeave, onUpdateSettings }) {
    const [raiseAmount, setRaiseAmount] = useState(200)
    const { language } = useLanguage()
    const ko = language === 'ko'

    const isOwner = room?.ownerId === socket.id
    const settings = room?.settings || {}
    const phase = gameState?.phase || 'WAITING'
    const myPlayer = gameState?.players?.find(p => p.id === socket.id)
    const isMyTurn = gameState?.currentPlayer === socket.id
    const pot = gameState?.pot || 0
    const currentBet = gameState?.currentBet || 0
    const communityCards = gameState?.communityCards || []
    const canCheck = myPlayer?.bet >= currentBet
    const callAmount = currentBet - (myPlayer?.bet || 0)

    // Lobby View
    if (room?.status === 'LOBBY') {
        return (
            <div className="w-full max-w-4xl mx-auto p-4">
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-blue-400">♠️ {ko ? '텍사스 홀덤' : 'Texas Hold\'em'}</h2>
                            <p className="text-gray-400 text-sm">Room: {room.name} (ID: {room.id})</p>
                        </div>
                        <button onClick={onLeave} className="text-gray-400 hover:text-red-400 text-sm">
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

                    {/* Settings */}
                    {isOwner && (
                        <>
                            <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                <h3 className="text-sm text-gray-400 mb-3 font-bold">{ko ? '게임 선택' : 'Select Game'}</h3>
                                <div className="flex gap-2">
                                    {['dalmuti', 'onecard', 'blackjack', 'poker'].map(gt => (
                                        <button
                                            key={gt}
                                            onClick={() => onUpdateSettings({ gameType: gt })}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${settings.gameType === gt
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                }`}
                                        >
                                            {gt === 'dalmuti' ? '👑' : gt === 'onecard' ? '🃏' : gt === 'blackjack' ? '🂡' : '♠️'} {gt.charAt(0).toUpperCase() + gt.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Blind Settings */}
                            <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                                <h3 className="text-sm text-gray-400 mb-3 font-bold">
                                    {ko ? '블라인드 설정' : 'Blind Settings'}
                                </h3>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500">{ko ? '스몰 블라인드' : 'Small Blind'}</label>
                                        <div className="flex gap-1 mt-1">
                                            {[25, 50, 100, 500].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => onUpdateSettings({ smallBlind: v, bigBlind: v * 2 })}
                                                    className={`flex-1 py-1 rounded text-xs font-bold ${(settings.smallBlind || 50) === v
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                        }`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onStartGame}
                                disabled={room.players.length < 2}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 disabled:from-gray-700 disabled:to-gray-600 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-lg text-lg"
                            >
                                ♠️ {ko ? '게임 시작' : 'Start Game'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Game View
    return (
        <div className="w-full h-screen bg-gradient-to-b from-[#0a1628] to-[#0d1117] flex flex-col relative overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-4 py-2 bg-black/40 backdrop-blur z-50">
                <div className="flex items-center gap-4">
                    <span className="text-blue-400 font-black text-lg">♠️ {ko ? '텍사스 홀덤' : 'Hold\'em'}</span>
                    <span className="text-gray-400 text-xs">
                        {phase === 'PREFLOP' ? 'Pre-Flop' : phase === 'FLOP' ? 'Flop' : phase === 'TURN' ? 'Turn' : phase === 'RIVER' ? 'River' : phase === 'SHOWDOWN' ? 'Showdown' : phase}
                    </span>
                    {gameState?.timeLeft > 0 && (
                        <span className={`text-sm font-mono ${gameState.timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
                            ⏱ {gameState.timeLeft}s
                        </span>
                    )}
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

            {/* Poker Table */}
            <div className="flex-1 relative flex items-center justify-center">
                {/* Table */}
                <div className="w-[700px] h-[350px] bg-gradient-to-br from-[#1a5c2e] to-[#0e3a1c] rounded-[50%] border-[8px] border-[#3a2a1a] shadow-2xl relative">

                    {/* Pot */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2">
                        <motion.div
                            key={pot}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className="bg-black/60 px-6 py-2 rounded-full border border-yellow-500/30"
                        >
                            <span className="text-yellow-300 font-black text-xl">🪙 {pot.toLocaleString()}</span>
                        </motion.div>
                    </div>

                    {/* Community Cards */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
                        {communityCards.map((card, i) => (
                            <motion.div
                                key={i}
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <PlayingCard card={card} />
                            </motion.div>
                        ))}
                        {/* Empty card slots */}
                        {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-16 h-24 rounded-lg border-2 border-dashed border-green-800/30" />
                        ))}
                    </div>

                    {/* Other Players around the table */}
                    {gameState?.players?.filter(p => p.id !== socket.id).map((p, i, arr) => {
                        const total = arr.length;
                        // Position players around the top half of the table
                        const angle = Math.PI + (Math.PI * (i + 1)) / (total + 1);
                        const rx = 380, ry = 200;
                        const left = 50 + (Math.cos(angle) * rx) / 7;
                        const top = 50 + (Math.sin(angle) * ry) / 3.5;

                        return (
                            <motion.div
                                key={p.id}
                                className={`absolute flex flex-col items-center`}
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                <div className={`bg-gray-900/80 rounded-xl px-3 py-2 border ${gameState.currentPlayer === p.id ? 'border-green-400 shadow-lg shadow-green-500/30' :
                                    p.folded ? 'border-gray-700/30 opacity-40' :
                                        'border-gray-700/50'
                                    }`}>
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="text-xs text-gray-300 font-bold">{p.username}</span>
                                        {p.isDealer && <span className="text-[10px] bg-amber-500 text-white px-1 rounded font-bold">D</span>}
                                        {p.folded && <span className="text-[10px] text-red-400">FOLD</span>}
                                        {p.allIn && <span className="text-[10px] text-yellow-400 animate-pulse font-bold">ALL IN</span>}
                                    </div>
                                    <div className="flex gap-0.5">
                                        {phase === 'SHOWDOWN' && !p.folded ? (
                                            p.hand?.map((card, ci) => <PlayingCard key={ci} card={card} small={true} />)
                                        ) : (
                                            Array.from({ length: 2 }).map((_, ci) => <PlayingCard key={ci} hidden={true} small={true} />)
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] text-amber-300">🪙{(p.balance || 0).toLocaleString()}</span>
                                        {p.bet > 0 && <span className="text-[10px] text-green-300 font-bold">+{p.bet}</span>}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            {/* My Player Area */}
            <div className="bg-gradient-to-t from-black/90 to-transparent p-4 pb-6">
                {/* My Hand */}
                {myPlayer && (
                    <div className="flex items-center justify-center gap-6 mb-4">
                        <div className="flex gap-2">
                            {myPlayer.hand?.map((card, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.15 }}
                                >
                                    <PlayingCard card={card} />
                                </motion.div>
                            ))}
                        </div>

                        <div className="flex flex-col items-center">
                            {myPlayer.isDealer && (
                                <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold mb-1">DEALER</span>
                            )}
                            {myPlayer.folded && <span className="text-red-400 font-bold text-sm">FOLDED</span>}
                            {myPlayer.allIn && <span className="text-yellow-400 font-bold text-sm animate-pulse">ALL IN!</span>}
                            {myPlayer.result && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className={`font-black text-lg px-4 py-1 rounded-full ${myPlayer.result === 'win' ? 'bg-green-500 text-white' : 'bg-red-600/50 text-red-300'
                                        }`}
                                >
                                    {myPlayer.result === 'win' ? '🎉 WIN!' : '😢 LOSE'}
                                </motion.span>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-center items-center flex-wrap">
                    {isMyTurn && myPlayer && !myPlayer.folded && !myPlayer.allIn && phase !== 'SHOWDOWN' && (
                        <>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => socket.emit('poker_fold')}
                                className="bg-gradient-to-r from-red-700 to-red-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg"
                            >
                                ❌ {ko ? '폴드' : 'Fold'}
                            </motion.button>

                            {canCheck ? (
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => socket.emit('poker_check')}
                                    className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg"
                                >
                                    ✅ {ko ? '체크' : 'Check'}
                                </motion.button>
                            ) : (
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => socket.emit('poker_call')}
                                    className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg"
                                >
                                    📞 {ko ? '콜' : 'Call'} ({callAmount.toLocaleString()})
                                </motion.button>
                            )}

                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min={currentBet + (gameState?.options?.bigBlind || 100)}
                                    max={myPlayer.balance + (myPlayer.bet || 0)}
                                    step={gameState?.options?.bigBlind || 100}
                                    value={raiseAmount}
                                    onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                                    className="w-24 accent-green-500"
                                />
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => socket.emit('poker_raise', raiseAmount)}
                                    className="bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg"
                                >
                                    ⬆️ {ko ? '레이즈' : 'Raise'} {raiseAmount.toLocaleString()}
                                </motion.button>
                            </div>

                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => socket.emit('poker_allin')}
                                className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-black py-2.5 px-6 rounded-xl shadow-lg animate-pulse"
                            >
                                💥 ALL IN
                            </motion.button>
                        </>
                    )}

                    {phase === 'SHOWDOWN' && isOwner && (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => socket.emit('restart_game')}
                            className="bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-black py-3 px-10 rounded-xl shadow-lg text-lg"
                        >
                            🔄 {ko ? '다음 라운드' : 'Next Round'}
                        </motion.button>
                    )}
                </div>

                {/* My Bet */}
                {myPlayer?.bet > 0 && (
                    <div className="text-center mt-2">
                        <span className="text-amber-300 text-sm font-bold">
                            🪙 {ko ? '사용 포인트' : 'Used Points'}: {myPlayer.bet.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Round Results */}
            <AnimatePresence>
                {phase === 'SHOWDOWN' && gameState?.roundResults?.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-lg rounded-2xl p-5 border border-gray-600 shadow-2xl z-40 min-w-[320px]"
                    >
                        <h3 className="text-lg font-black text-center text-white mb-3">
                            🏆 {ko ? '결과' : 'Results'}
                        </h3>
                        {gameState.roundResults.map((r, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-800/50 px-4 py-2 rounded-lg mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold">{r.username}</span>
                                    <span className="text-xs text-gray-400">{r.handRank}</span>
                                </div>
                                <span className={`font-black ${r.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                                    {r.payout > 0 ? `+${r.payout.toLocaleString()}` : '0'}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
