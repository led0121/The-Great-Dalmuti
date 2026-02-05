import { useState, useEffect } from 'react'
import Card from './Card'
import Chat from './Chat'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import RulesModal from './RulesModal'
import { useLanguage } from '../App'

export default function GameRoom({ socket, room, gameState, username, onStartGame, onPlay, onPass }) {
    const [selectedCards, setSelectedCards] = useState([])
    const [isRulesOpen, setIsRulesOpen] = useState(false)
    const { t } = useLanguage()

    // Reset selection on phase change
    useEffect(() => {
        setSelectedCards([])
    }, [gameState?.phase])

    const isOwner = room.ownerId === socket.id
    const myPlayer = gameState?.players.find(p => p.id === socket.id)
    const isSpectator = !myPlayer;
    // Fix: isWaiting was missing in context of previous edits or I need to re-add?
    // Checking previous file content...
    const isWaiting = gameState?.waitingPlayers?.find(p => p.id === socket.id);
    const isMyTurn = gameState?.currentTurn === socket.id

    // Helper: Rank Name
    const getRankName = (rank) => {
        if (rank === 1) return t('roleDalmuti')
        if (rank === 2) return t('roleLesserDalmuti')
        if (rank === gameState?.players.length) return t('rolePeon')
        if (rank === gameState?.players.length - 1) return t('roleLesserPeon')
        return t('roleMerchant')
    }

    // --- Strict Play Validation ---
    const isCardPlayable = (card) => {
        // Allow interaction during Taxation and Market
        if (gameState.phase === 'TAXATION') return myPlayer?.taxDebt > 0;
        if (gameState.phase === 'MARKET') return !myPlayer?.marketPassed;

        if (!isMyTurn) return false;
        if (gameState.phase !== 'PLAYING') return false;

        // If table is empty, everything is playable (except if we want to enforce valid sets, but user picks set)
        if (!gameState.lastMove) return true;

        // Last Move Analysis
        const lastCards = gameState.lastMove.cards;
        const lastCount = lastCards.length;

        // Determine Last Rank (Joker aware logic, backend uses similar)
        // Simple heuristic: Lowest non-joker rank. If all jokers, 13? (Usually best possible)
        const nonJokers = lastCards.filter(c => !c.isJoker);
        const lastRank = nonJokers.length > 0 ? nonJokers[0].rank : 13;

        // Current Hand Selection Logic?
        // Wait, 'isCardPlayable' usually checks if a SINGLE card CAN be part of a valid move.
        // It's hard to gray out single cards because (Joker + Card) might be valid even if Card is bad?
        // User Request: "Active only if rank < tableRank AND count >= tableCount"
        // Since we select multiple, `isCardPlayable` should probably just check RANK condition individualy?
        // Actually, if lastRank is 10. I have rank 11. 11 is WORSE (Number Higher).
        // So 11 is unplayable unless I have Joker? Even with Joker, 11+Joker = Rank 11. Still worse.
        // So strict Rank check is possible per card!

        // Logic: Card Rank must be < Last Rank (Numerically Lower).
        // Jokers (13) are always playable (can become better rank).
        if (card.isJoker) return true;

        // If Rank >= Last Rank, it's impossible to beat it (Dalmuti rules: Lower number is better).
        // Exception: Revolution? (If ranks inverted? User didn't ask for inv logic here yet).
        // Assuming Standard:
        if (card.rank >= lastRank) return false;

        return true;
    }

    // Validation for "Play Button" (Can I submit?)
    const canSubmitPlay = () => {
        if (selectedCards.length === 0) return false;

        // 1. Check Quantity
        if (gameState.lastMove) {
            if (selectedCards.length < gameState.lastMove.cards.length) return false;
        }

        // 2. Check Rank Validity of Selection
        // All selected non-jokers must be same rank
        const selectedObjs = myPlayer.hand.filter(c => selectedCards.includes(c.id));
        const nonJokers = selectedObjs.filter(c => !c.isJoker);

        if (nonJokers.length > 0) {
            const firstRank = nonJokers[0].rank;
            if (!nonJokers.every(c => c.rank === firstRank)) return false; // Mixed ranks

            // Check against Table
            if (gameState.lastMove) {
                const lastNonJokers = gameState.lastMove.cards.filter(c => !c.isJoker);
                const lastRank = lastNonJokers.length > 0 ? lastNonJokers[0].rank : 13;
                if (firstRank >= lastRank) return false; // Not better
            }
        }

        return true;
    }

    const toggleCardSelection = (cardId) => {
        if (!isMyTurn && gameState.phase === 'PLAYING') return; // Only prevent in playing?

        const clickedCard = myPlayer.hand.find(c => c.id === cardId)
        if (!clickedCard) return

        // Strict blocked selection if card is definitely unplayable
        if (gameState.phase === 'PLAYING' && gameState.lastMove && !isCardPlayable(clickedCard)) return;

        setSelectedCards(prev => {
            if (prev.includes(cardId)) {
                return prev.filter(id => id !== cardId)
            } else {
                if (gameState.phase === 'TAXATION') {
                    const limit = myPlayer?.taxDebt || 2;
                    if (prev.length >= limit) return prev;
                    return [...prev, cardId];
                }
                if (gameState.phase === 'MARKET') {
                    return [cardId];
                }

                // PLAYING: Auto-grouping
                if (prev.length > 0) {
                    const currentSelectionCards = myPlayer.hand.filter(c => prev.includes(c.id));
                    const nonJokers = currentSelectionCards.filter(c => !c.isJoker);

                    if (!clickedCard.isJoker) {
                        // If existing has distinct rank, reset
                        if (nonJokers.length > 0 && nonJokers[0].rank !== clickedCard.rank) {
                            return [cardId];
                        }
                    }
                }
                return [...prev, cardId]
            }
        })
    }

    // Actions
    const handleRestart = () => socket.emit('restart_game');
    const handleTaxationSubmit = () => selectedCards.length === 2 && socket.emit('taxation_return', selectedCards);
    const handleMarketTrade = () => {
        if (selectedCards.length === 1) {
            socket.emit('market_trade', selectedCards[0]);
            setSelectedCards([]);
        }
    }
    const handleMarketPass = () => socket.emit('market_pass');

    const handleSeatSelect = () => {
        // Backend handles "next available" or we pick specific?
        // Let's emitted 'select_seat_card'
        socket.emit('select_seat_card');
    }

    const handlePlayClick = () => {
        if (canSubmitPlay()) {
            onPlay(selectedCards);
            setSelectedCards([]);
        }
    }

    // --- VIEWS ---

    // LOBBY
    if (room.status === 'LOBBY') {
        return (
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 text-center relative">
                <Chat socket={socket} username={username} room={room} />
                <h2 className="text-3xl font-bold mb-4 text-amber-400">{room.name}</h2>
                <div className="text-gray-300 mb-6 font-mono bg-gray-900 p-2 rounded inline-block">ID: <span className="text-white select-all">{room.id}</span></div>
                <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3 text-white">{t('players', { count: room.players.length })}</h3>
                    <div className="flex flex-wrap gap-4 justify-center">
                        {room.players.map(p => (
                            <div key={p.id} className="bg-gray-700 px-4 py-2 rounded flex items-center gap-2">
                                <span className="text-2xl font-bold text-blue-400">{p.username[0].toUpperCase()}</span>
                                <span>{p.username}</span>
                                {room.ownerId === p.id && <span className="text-xs text-yellow-400 border border-yellow-400 px-1 rounded">{t('hostLabel')}</span>}
                            </div>
                        ))}
                    </div>
                </div>
                {isOwner ? (
                    <button onClick={onStartGame} disabled={room.players.length < 2} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg">{t('startGameBtn')}</button>
                ) : <div className="text-gray-400 animate-pulse">{t('waitingHost')}</div>}

                <button onClick={() => setIsRulesOpen(true)} className="absolute top-4 left-4 text-gray-400 hover:text-white underline text-sm">{t('howToPlayBtn')}</button>
                <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} currentPhase="LOBBY" />
            </div>
        )
    }

    if (!gameState) return <div className="text-white">{t('loading')}</div>

    // SEAT SELECTION VIEW
    if (gameState.phase === 'SEAT_SELECTION') {
        const mySeat = gameState.selectedSeats?.find(s => s.playerId === socket.id);
        const allSelected = gameState.selectedSeats?.length === (gameState.selectedSeats.length > 0 ? gameState.selectedSeats.length + (gameState.seatDeckCount || 0) - gameState.selectedSeats.length : room.players.length);
        // Logic for "All Selected" based on deck count? No, logic is simpler:
        // If seatDeck is empty? Or selectedSeats count == intended count.
        // Simplified:
        const isReviewing = !!gameState.selectedSeats?.length && gameState.seatDeckCount === 0;

        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white relative">
                <Chat socket={socket} username={username} room={room} />
                <h2 className="text-4xl font-bold text-yellow-500 mb-8">
                    {gameState.waitingPlayers?.length > 0 ? t('challengerSelection') : t('chooseDestiny')}
                </h2>
                {gameState.waitingPlayers?.length > 0 && (
                    <p className="mb-8 text-xl text-gray-300">
                        {t('challengerMessage')}
                    </p>
                )}

                <div className="flex gap-4 mb-12">
                    {/* Render "Deck" of face down cards */}
                    {Array.from({ length: gameState.seatDeckCount || 0 }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ y: -100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="relative cursor-pointer hover:-translate-y-4 transition-transform"
                            onClick={handleSeatSelect}
                        >
                            <div className="w-32 h-48 bg-blue-900 rounded-xl border-4 border-white/20 shadow-xl flex items-center justify-center bg-card-pattern">
                                <span className="text-4xl opacity-50">?</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Results Area */}
                <div className="flex gap-8">
                    {gameState.selectedSeats?.map((seat, i) => {
                        const p = gameState.players.find(pl => pl.id === seat.playerId) || gameState.waitingPlayers?.find(pl => pl.id === seat.playerId);
                        return (
                            <motion.div key={seat.playerId} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                                <Card card={seat.card} isPlayable={false} size="normal" />
                                <div className="mt-2 font-bold">{p?.username}</div>
                                <div className="text-yellow-400 text-sm">{getRankName(i + 1)}</div>
                            </motion.div>
                        )
                    })}
                </div>

                {gameState.selectedSeats?.length > 0 && gameState.seatDeckCount === 0 && <div className="mt-8 text-2xl animate-pulse text-green-400">{t('determiningRanks')}</div>}
            </div>
        )
    }

    // GAME OVER (FINISHED)
    if (gameState.phase === 'FINISHED') {
        const winner = gameState.players.find(p => p.rank === 1);
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <Chat socket={socket} username={username} room={room} />
                <h1 className="text-6xl font-black text-yellow-500 mb-4 animate-bounce">{t('gameOver')}</h1>
                <div className="text-3xl mb-8">{t('winner', { name: winner?.username })}</div>
                <div className="grid gap-4 mb-8">
                    {gameState.players.sort((a, b) => a.rank - b.rank).map(p => (
                        <div key={p.id} className="bg-gray-800 p-4 rounded flex justify-between w-64 border border-gray-700">
                            <span className="text-yellow-400">#{p.rank} {getRankName(p.rank)}</span>
                            <span>{p.username}</span>
                        </div>
                    ))}
                </div>
                {isOwner && <button onClick={handleRestart} className="bg-green-600 px-8 py-3 rounded text-xl font-bold hover:scale-105 transition-transform">{t('nextRoundBtn')}</button>}
            </div>
        )
    }

    // TAXATION / MARKET / PLAYING -> Shared "Table" Layout
    const opponents = gameState.players.filter(p => p.id !== socket.id);

    return (
        <LayoutGroup>
            <div className="w-full h-screen flex flex-col overflow-hidden relative bg-[#1a1a1a]">
                {/* Table Texture */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#2a2a2a] rounded-t-[50%] scale-x-150 opacity-50 pointer-events-none" />

                <div className="absolute top-4 left-4 z-50 text-white/50 text-xs shadow-black drop-shadow-md">
                    {t('roomInfo', { roomId: room.id, username: username })} {isSpectator ? t('spectatorLabel') : ''}
                </div>

                {/* SPECTATOR WARNING OVERLAY */}
                {(isWaiting || (isSpectator && !myPlayer)) && (gameState.phase !== 'FINISHED') && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 px-6 py-2 rounded-full backdrop-blur text-white z-40 border border-white/10">
                        {t('waitingMessage')}
                    </div>
                )}

                <Chat socket={socket} username={username} room={room} />
                <div className="absolute top-4 left-4 z-50 mt-6"><button onClick={() => setIsRulesOpen(true)} className="w-10 h-10 rounded-full bg-gray-700 text-white font-bold border border-gray-500">?</button></div>
                <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} currentPhase={gameState.phase} />

                {/* REVOLUTION CHOICE OVERLAY */}
                {gameState.phase === 'REVOLUTION_CHOICE' && (
                    <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center pointer-events-auto">
                        <h2 className="text-5xl text-red-500 font-black mb-8 animate-pulse shadow-red-500 drop-shadow-lg">{t('revolutionTitle')}</h2>
                        <div className="bg-gray-800 p-8 rounded-2xl border-2 border-red-500 text-center max-w-lg shadow-2xl">
                            <p className="text-2xl text-white mb-6 font-bold">{t('revolutionPrompt')}</p>

                            {gameState.players.find(p => p.id === socket.id)?.id === gameState.currentTurn /* Wait, REVOLUTION_CHOICE uses revolutionCandidateId, not currentTurn. But logic in Game.js sets currentTurn? No, let's use candidate check */
                                || (myPlayer && myPlayer.hand.filter(c => c.isJoker).length === 2) ? (
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={() => socket.emit('revolution_choice', true)}
                                        className="bg-red-600 hover:bg-red-700 text-white font-black text-xl py-4 px-8 rounded-xl shadow-lg hover:scale-105 transition-transform"
                                    >
                                        {t('revolutionYes')}
                                    </button>
                                    <button
                                        onClick={() => socket.emit('revolution_choice', false)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold text-xl py-4 px-8 rounded-xl shadow-lg hover:scale-105 transition-transform"
                                    >
                                        {t('revolutionNo')}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-xl animate-pulse">
                                    {t('revolutionWaiting')}
                                </div>
                            )}
                            <p className="mt-6 text-sm text-gray-400">{t('revolutionDesc')}</p>
                        </div>
                    </div>
                )}

                {/* PHASE OVERLAYS */}
                {gameState.phase === 'TAXATION' && (
                    <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center pointer-events-auto">
                        <h2 className="text-4xl text-yellow-500 font-bold mb-4">{t('taxationPhase')}</h2>
                        <div className="bg-gray-800 p-6 rounded-xl text-center">
                            {myPlayer && myPlayer.taxDebt > 0 ? (
                                <>
                                    <p className="mb-4 text-green-400 text-xl">{t('rank1TaxMsg')}</p>
                                    {/* Note: Reuse rank1TaxMsg for both Rank 1 and Rank 2 for now, or add generic message */}
                                    <div className="text-sm text-gray-300 mb-2">Select {myPlayer.taxDebt} cards to return</div>
                                    <button onClick={handleTaxationSubmit} disabled={selectedCards.length !== myPlayer.taxDebt} className="bg-green-600 px-6 py-2 rounded font-bold disabled:opacity-50">{t('returnCardsBtn')}</button>
                                </>
                            ) : (
                                <p className="text-gray-400 text-xl animate-pulse">
                                    {t('taxWatching')}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {gameState.phase === 'MARKET' && (
                    <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center pointer-events-auto">
                        <h2 className="text-4xl text-blue-400 font-bold mb-2">{t('marketPhase', { time: gameState.timeLeft })}</h2>
                        <div className="text-xl mb-8">{t('marketActive', { count: gameState.marketPoolCount })}</div>
                        {myPlayer && !myPlayer.marketPassed ? (
                            <div className="flex gap-4">
                                <button onClick={handleMarketTrade} disabled={selectedCards.length !== 1} className="bg-blue-600 px-8 py-3 rounded-xl font-bold text-xl disabled:opacity-50">{t('tradeBtn')}</button>
                                <button onClick={handleMarketPass} className="bg-gray-600 px-8 py-3 rounded-xl font-bold text-xl">{t('donePassBtn')}</button>
                            </div>
                        ) : <div className="text-green-500 text-2xl font-bold">{t('donePassBtn')}</div>}
                    </div>
                )}

                {/* ROUND TABLE OPPONENTS */}
                <div className="absolute inset-0 pointer-events-none">
                    {opponents.map((p, i) => {
                        // Position calculations
                        const angleStep = 180 / (opponents.length + 1);
                        const angle = -90 + (angleStep * (i + 1));
                        const radius = 350;
                        const x = Math.sin(angle * (Math.PI / 180)) * radius;
                        const y = -Math.cos(angle * (Math.PI / 180)) * radius * 0.6;

                        return (
                            <div key={p.id} className="absolute top-[40%] left-1/2 flex flex-col items-center justify-center w-24"
                                style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>

                                {/* Player Avatar */}
                                <div className={`relative transition-all duration-300 ${gameState.currentTurn === p.id ? 'scale-125 z-10' : 'opacity-80'}`}>
                                    <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center bg-gray-700 font-bold text-xl
                                    ${gameState.currentTurn === p.id ? 'border-yellow-400 shadow-[0_0_20px_gold]' : 'border-gray-500'}
                                    ${!p.connected ? 'grayscale' : ''}
                                `}>
                                        {p.username[0]}
                                    </div>
                                    {p.rank === 1 && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl">👑</div>}
                                    {p.rank === gameState.players.length && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">🧹</div>}
                                    {p.finished && <div className="absolute inset-0 bg-green-500/80 rounded-full flex items-center justify-center font-bold text-[10px]">DONE</div>}
                                </div>

                                <span className="mt-2 text-xs font-bold bg-black/50 px-2 rounded backdrop-blur-sm">{p.username} ({p.cardCount})</span>

                                {/* Opponent Cards Mini */}
                                {isSpectator ? (
                                    <div className="flex -space-x-8 mt-1 justify-center">
                                        {p.hand && p.hand.map((card) => (
                                            <div key={card.id} className="relative transform hover:-translate-y-2 transition-transform">
                                                <Card card={card} isPlayable={false} size="small" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex -space-x-2 mt-1">
                                        {Array.from({ length: Math.min(p.cardCount, 3) }).map((_, idx) => (
                                            <div key={idx} className="w-4 h-6 bg-blue-900 border border-blue-400 rounded-sm" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* CENTER: PLAYED CARDS */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-40 flex items-center justify-center z-0">
                    {gameState.lastMove ? (
                        <div className="relative">
                            {gameState.lastMove.cards.map((c, i) => (
                                <motion.div
                                    layoutId={`card-${c.id}`}
                                    key={c.id}
                                    className="absolute top-0 left-0 shadow-xl"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1, x: i * 20 - (gameState.lastMove.cards.length * 10) }}
                                    style={{ zIndex: i }}
                                >
                                    <Card card={c} isPlayable={false} size="normal" />
                                </motion.div>
                            ))}
                            <div className="absolute top-full text-center w-full mt-4 font-bold text-sm text-yellow-500 bg-black/50 rounded px-2">
                                Last: {gameState.players.find(p => p.id === gameState.lastMove.playerId)?.username}
                            </div>
                        </div>
                    ) : <div className="text-white/20 font-bold text-2xl">{t('tableEmpty')}</div>}

                    {/* Current Turn Indicator (Big) */}
                    <div className="absolute -top-32 w-full text-center">
                        {gameState.revolutionActive && <div className="text-red-500 font-bold animate-pulse text-2xl mb-2">⚔️ REVOLUTION ⚔️</div>}
                        <div className="text-gray-400 text-xs tracking-widest uppercase mb-1">
                            {gameState.players.find(p => p.id === gameState.currentTurn)?.id === socket.id ? t('yourTurn') : t('opponentsTurn', { name: gameState.players.find(p => p.id === gameState.currentTurn)?.username || 'Unknown' })}
                        </div>
                        <div className="text-3xl font-black text-white drop-shadow-md">
                            {gameState.players.find(p => p.id === gameState.currentTurn)?.username}
                        </div>
                        {gameState.timeLeft !== undefined && <div className="text-blue-300 font-mono text-xl">{gameState.timeLeft}s</div>}
                    </div>
                </div>

                {/* PLAYER HAND AREA */}
                <div className="absolute bottom-0 w-full flex flex-col items-center pb-4 z-50 pointer-events-auto">
                    {/* Controls */}
                    <div className="mb-4 h-12 flex gap-4">
                        {isMyTurn && myPlayer && !myPlayer.finished && gameState.phase === 'PLAYING' && (
                            <>
                                <button
                                    onClick={handlePlayClick}
                                    disabled={!canSubmitPlay()}
                                    className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:opacity-50 text-white font-bold py-2 px-10 rounded-full shadow-lg transition-transform active:scale-95 flex items-center gap-2 border-2 border-green-400/50"
                                >
                                    <span>🔥</span> {t('playBtn', { count: selectedCards.length })}
                                </button>
                                <button
                                    onClick={onPass}
                                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-8 rounded-full shadow-lg transition-transform active:scale-95 border-2 border-slate-500"
                                >
                                    {t('passBtn')}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Hand */}
                    <div className="flex items-end justify-center -space-x-12 hover:-space-x-8 transition-all p-4">
                        <AnimatePresence>
                            {myPlayer?.hand.map(card => {
                                const playable = isCardPlayable(card);
                                const selected = selectedCards.includes(card.id);
                                return (
                                    <motion.div
                                        layoutId={`card-${card.id}`}
                                        key={card.id}
                                        className={`relative transition-all duration-200 
                                    ${!playable && !card.isJoker ? 'brightness-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:-translate-y-6 hover:z-50'} 
                                    ${selected ? '-translate-y-10 z-40 ring-4 ring-green-500 rounded-lg' : ''}
                                `}
                                        onClick={() => toggleCardSelection(card.id)}
                                    >
                                        <Card card={card} isPlayable={true} />
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </LayoutGroup>
    )
}
