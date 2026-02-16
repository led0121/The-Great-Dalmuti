import { useState, useEffect } from 'react'
import Card from './Card'
import Chat from './Chat'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import RulesModal from './RulesModal'
import { useLanguage } from '../LanguageContext'

export default function GameRoom({ socket, room, gameState, username, onStartGame, onPlay, onPass, onLeave, onUpdateSettings }) {
    const [selectedCards, setSelectedCards] = useState([])
    const [isRulesOpen, setIsRulesOpen] = useState(false)
    const { t } = useLanguage()

    // --- DEBUGGING ---
    useEffect(() => {
        console.log('GameRoom Debug:', {
            status: room?.status,
            phase: gameState?.phase,
            isLobby: room?.status === 'LOBBY',
            isSeat: gameState?.phase === 'SEAT_SELECTION',
            isFinished: gameState?.phase === 'FINISHED',
            isPlaying: gameState && (gameState.phase === 'PLAYING' || gameState.phase === 'TAXATION' || gameState.phase === 'MARKET')
        });
    }, [room, gameState]);

    // Reset selection on phase change
    useEffect(() => {
        setSelectedCards([])
    }, [gameState?.phase])

    const isOwner = room.ownerId === socket.id
    // Safety check for gameState.players
    const myPlayer = gameState?.players ? gameState.players.find(p => p.id === socket.id) : null;
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
        if (gameState.phase === 'TAXATION') {
            return myPlayer?.taxDebt > 0;
        }

        if (gameState.phase === 'MARKET') {
            return !myPlayer?.marketPassed;
        }

        if (!isMyTurn) return false;
        if (gameState.phase !== 'PLAYING') return false;

        // If table is empty, everything is playable (except if we want to enforce valid sets, but user picks set)
        if (!gameState.lastMove) return true;

        // Last Move Analysis
        const lastCards = gameState.lastMove.cards;
        // const lastCount = lastCards.length; // Unused

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

    // Checking if we can submit play
    const canSubmitPlay = () => {
        if (!isMyTurn || selectedCards.length === 0) return false;
        // Validation logic could go here or server-side
        return true;
    }

    const handleCardClick = (cardId) => {
        if (isSpectator) return;

        // Taxation Phase Handling
        if (gameState?.phase === 'TAXATION') {
            if (myPlayer?.taxDebt > 0) {
                setSelectedCards(prev => {
                    if (prev.includes(cardId)) return prev.filter(id => id !== cardId)
                    if (prev.length < myPlayer.taxDebt) return [...prev, cardId]
                    return prev
                })
            }
            return;
        }

        // Market Phase Handling
        if (gameState?.phase === 'MARKET') {
            setSelectedCards(prev => {
                if (prev.includes(cardId)) return prev.filter(id => id !== cardId)
                return [...prev, cardId]
            })
            return;
        }

        // Normal Play
        if (!isMyTurn) return;
        setSelectedCards(prev => {
            if (prev.includes(cardId)) {
                return prev.filter(id => id !== cardId)
            } else {
                return [...prev, cardId]
            }
        })
    }

    // ACTIONS
    const handleRestart = () => socket.emit('restart_game');
    const handleTaxationSubmit = () => {
        if (!myPlayer || selectedCards.length !== myPlayer.taxDebt) return;

        if (myPlayer.rank <= 2) {
            socket.emit('taxation_return', selectedCards);
        } else {
            socket.emit('taxation_pay', selectedCards);
        }
        setSelectedCards([]);
    }
    const handleMarketTrade = (cardsToSubmit = []) => {
        const cards = Array.isArray(cardsToSubmit) ? cardsToSubmit : selectedCards;
        socket.emit('market_trade', cards);
        setSelectedCards([]);
    }
    const handleMarketPass = () => {
        socket.emit('market_trade', []);
    }

    const handleSeatSelect = (cardId) => {
        socket.emit('select_seat_card', cardId);
    }

    const handlePlayClick = () => {
        if (canSubmitPlay()) {
            onPlay(selectedCards);
            setSelectedCards([]);
        }
    }

    // --- VIEW: LOBBY ---
    if (room.status === 'LOBBY') {
        const settings = room.settings || { timerDuration: 30 };

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 text-center relative">
                    {/* <Chat socket={socket} username={username} room={room} /> */}

                    {/* Leave Button */}
                    <button onClick={onLeave} className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded z-10 transition-colors">
                        {t('leaveRoomBtn')}
                    </button>

                    <h2 className="text-3xl font-bold mb-4 text-amber-400">{room.name}</h2>
                    <div className="text-gray-300 mb-6 font-mono bg-gray-900 p-2 rounded inline-block">ID: <span className="text-white select-all">{room.id}</span></div>

                    {/* Settings Section */}
                    <div className="mb-6 bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">{t('gameSettings')}</h3>
                        {isOwner ? (
                            <div className="flex items-center justify-center gap-4">
                                <label className="text-sm text-gray-300">{t('turnTimerLabel')}</label>
                                <input
                                    type="number"
                                    min="10" max="180" step="5"
                                    value={settings.timerDuration}
                                    onChange={(e) => onUpdateSettings && onUpdateSettings({ timerDuration: Number(e.target.value) })}
                                    className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center text-white focus:border-amber-500 outline-none transition-colors"
                                />
                                <span className="text-sm text-gray-400">sec</span>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-sm">
                                {t('turnTimerLabel')}: <span className="text-white font-bold">{settings.timerDuration}s</span>
                            </div>
                        )}
                    </div>

                    <div className="mb-8">
                        <h3 className="text-xl font-semibold mb-3 text-white">{t('players', { count: (room.players || []).length })}</h3>
                        <div className="flex flex-wrap gap-4 justify-center">
                            {(room.players || []).map(p => (
                                <div key={p.id} className="bg-gray-700 px-4 py-2 rounded flex items-center gap-2 border border-gray-600">
                                    <span className="text-2xl font-bold text-blue-400">{p.username ? p.username[0].toUpperCase() : '?'}</span>
                                    <span>{p.username}</span>
                                    {room.ownerId === p.id && <span className="text-xs text-yellow-400 border border-yellow-400 px-1 rounded ml-1">{t('hostLabel')}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {isOwner ? (
                        <button
                            onClick={onStartGame}
                            disabled={(room.players || []).length < 2}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold py-3 px-8 rounded-lg shadow-lg transition-all active:scale-95"
                        >
                            {t('startGameBtn')}
                        </button>
                    ) : (
                        <div className="text-gray-400 animate-pulse">{t('waitingHost')}</div>
                    )}

                    <button onClick={() => setIsRulesOpen(true)} className="absolute top-4 left-4 text-gray-400 hover:text-white underline text-sm z-10">{t('howToPlayBtn')}</button>
                    {/* <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} currentPhase="LOBBY" /> */}
                </div>
            </div>
        )
    }

    if (!gameState) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-2xl animate-pulse">{t('loading')}</div>

    // --- VIEW: SEAT SELECTION ---
    if (gameState.phase === 'SEAT_SELECTION') {
        const isReviewing = !!gameState.selectedSeats?.length && gameState.seatDeckCount === 0;

        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white relative">
                <Chat socket={socket} username={username} room={room} />
                <h2 className="text-4xl font-bold text-yellow-500 mb-4 drop-shadow-lg">
                    {gameState.waitingPlayers?.length > 0 ? t('challengerSelection') : t('chooseDestiny')}
                </h2>
                {gameState.waitingPlayers?.length > 0 && (
                    <p className="mb-8 text-xl text-gray-300">{t('challengerMessage')}</p>
                )}

                <div className="flex gap-4 mb-12 flex-wrap justify-center">
                    {(gameState.seatDeck || Array.from({ length: gameState.seatDeckCount || 0 })).map((cardOrIndex, i) => {
                        // Support both new object based and old count based (safeguard)
                        const cardId = cardOrIndex.id ? cardOrIndex.id : `seat-${i}`;
                        return (
                            <motion.div
                                key={cardId}
                                initial={{ y: -100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative cursor-pointer hover:-translate-y-4 transition-transform"
                                onClick={() => handleSeatSelect(cardId)}
                            >
                                <div className="w-32 h-48 bg-blue-900 rounded-xl border-4 border-white/20 shadow-xl flex items-center justify-center bg-card-pattern">
                                    <span className="text-4xl opacity-50">?</span>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Results Area */}
                <div className="flex gap-8">
                    {gameState.selectedSeats?.map((seat, i) => {
                        const p = gameState.players.find(pl => pl.id === seat.playerId) || gameState.waitingPlayers?.find(pl => pl.id === seat.playerId);
                        return (
                            <motion.div key={seat.playerId} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl">
                                <Card card={seat.card} isPlayable={false} size="normal" />
                                <div className="mt-2 font-bold text-lg">{p?.username}</div>
                                <div className="text-yellow-400 font-bold">{getRankName(i + 1)}</div>
                            </motion.div>
                        )
                    })}
                </div>

                {isReviewing && <div className="mt-8 text-2xl animate-pulse text-green-400">{t('determiningRanks')}</div>}
            </div>
        )
    }

    // --- VIEW: GAME OVER ---
    if (gameState.phase === 'FINISHED') {
        const winner = gameState.players.find(p => p.rank === 1);
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <Chat socket={socket} username={username} room={room} />
                <h1 className="text-6xl font-black text-yellow-500 mb-4 animate-bounce drop-shadow-glow">{t('gameOver')}</h1>
                <div className="text-3xl mb-8 font-bold">{t('winner', { name: winner?.username })} 👑</div>
                <div className="grid gap-4 mb-8">
                    {gameState.players.sort((a, b) => a.rank - b.rank).map(p => (
                        <div key={p.id} className="bg-gray-800 p-4 rounded-lg flex justify-between w-80 border border-gray-700 shadow-lg">
                            <span className="text-yellow-400 font-bold">#{p.rank} {getRankName(p.rank)}</span>
                            <span className="font-medium">{p.username}</span>
                        </div>
                    ))}
                </div>
                {isOwner && <button onClick={handleRestart} className="bg-green-600 px-8 py-3 rounded-lg text-xl font-bold hover:scale-105 transition-transform shadow-green-500/50 shadow-lg">{t('nextRoundBtn')}</button>}
            </div>
        )
    }

    // --- VIEW: PLAYING BOARD ---
    return (
        <div className="w-full h-screen bg-[#1a1a1a] relative overflow-hidden flex flex-col">
            <Chat socket={socket} username={username} room={room} />

            {/* Room Info */}
            <div className="absolute top-4 left-4 z-50 text-white/50 text-xs shadow-black drop-shadow-md flex items-center gap-2">
                <span>{t('roomInfo', { roomId: room.id, username: username })} {isSpectator ? t('spectatorLabel') : ''}</span>
                <button onClick={onLeave} className="bg-red-900/50 hover:bg-red-700 text-white px-2 py-0.5 rounded ml-2 border border-red-800/50 transition-colors">
                    {t('leaveRoomBtn')}
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 relative flex items-center justify-center perspective-1000">
                {/* Table Texture */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#2a2a2a] rounded-t-[50%] scale-x-150 opacity-50 pointer-events-none" />

                {/* OPPONENTS (CIRCULAR LAYOUT) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {gameState.players.filter(p => p.id !== socket.id).map((p, i, arr) => {
                        // Calculate Position
                        // We want players distributed in a semi-circle or full circle around the top/center.
                        // Since "My" player is at bottom, opponents should be from Left -> Top -> Right.
                        // Total opponents = arr.length.
                        // Angle range: 180 degrees (from 9:00 to 3:00) or 220 degrees for better spacing?
                        // Let's use 200 degrees centered at top (-100 to +100 from top-center?). 
                        // Actually standard math: 0 is Right. -90 is Top. 180 is Left.
                        // We want them from Left (180) to Right (0) -> roughly 180 to 360(0).

                        const total = arr.length;
                        // Distribute evenly between 160 deg (Left-ish) and 380 deg (Right-ish) (covering top)
                        // If 1 player: Top (-90).
                        // If 2: -45, -135?

                        // Let's assume a "Seating Index" relative to me.
                        const angleStep = 180 / (total + 1); // Simple distribution over 180 deg arch
                        const angle = 180 + (angleStep * (i + 1)); // 180 is Left.

                        // Convert to Radians (subtract 90 to orient correctly if using sin/cos standard)
                        // Standard: 0 = Right, 270 = Top, 180 = Left.
                        // We want 180 -> 270 -> 360.
                        // Let's try: Start at 190 (Left-bottomish) end at 350 (Right-bottomish).

                        // Radius: 40% of screen width/height check?
                        // Using Viewport units (vmin) or percentage.
                        const radiusX = 40; // % width
                        const radiusY = 35; // % height

                        // Math.cos takes radians.
                        const rad = (angle * Math.PI) / 180;

                        // x = 50 + r * cos(a)
                        // y = 50 + r * sin(a)
                        const left = 50 + (radiusX * Math.cos(rad));
                        const top = 50 + (radiusY * Math.sin(rad));

                        return (
                            <div
                                key={p.id}
                                className="absolute flex flex-col items-center bg-black/40 p-2 rounded-lg backdrop-blur-sm pointer-events-auto min-w-[100px] transition-all duration-500"
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    transform: `translate(-50%, -50%)`, // Center the element
                                }}
                            >
                                <div className="relative mb-1">
                                    <span className={`text-4xl font-bold ${gameState.currentTurn === p.id ? 'text-yellow-400 animate-pulse' : 'text-gray-400'}`}>
                                        {p.username[0].toUpperCase()}
                                    </span>
                                    {p.rank > 0 && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/90 text-[10px] px-1.5 rounded text-yellow-500 whitespace-nowrap border border-yellow-500/30">
                                            {getRankName(p.rank)}
                                        </div>
                                    )}
                                    {/* Card Count Badge */}
                                    <div className="absolute -bottom-1 -right-4 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md border border-blue-400 flex items-center gap-1">
                                        <span>🃏</span>{p.cardCount || p.hand?.length || 0}
                                    </div>
                                    {p.taxDebt > 0 && <div className="absolute -bottom-2 -left-4 text-[10px] bg-red-600 px-1 rounded animate-bounce">TAX: {p.taxDebt}</div>}
                                </div>
                                <div className="text-xs text-gray-300 max-w-[80px] truncate">{p.username}</div>

                                {/* Cards (Backs) - Stacked Effect */}
                                <div className="relative h-6 w-12 mt-1">
                                    {(isSpectator && !p.finished) ? (
                                        (p.hand || []).map((card, idx) => (
                                            <div key={idx} className="absolute left-1/2 -translate-x-1/2 origin-bottom scale-50" style={{ left: `${idx * 2}px` }}> {/* Simple overlap */}
                                                <Card card={card} size="small" />
                                            </div>
                                        ))
                                    ) : (
                                        // Card Backs Fanned
                                        Array.from({ length: Math.min(p.cardCount || (p.hand?.length) || 0, 5) }).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className="absolute w-4 h-6 bg-blue-900 rounded border border-white/20 shadow-sm"
                                                style={{ left: `${(idx * 4)}px`, transform: `rotate(${(idx - 2) * 5}deg)` }}
                                            />
                                        ))
                                    )}
                                </div>
                                {p.finished && <span className="text-green-400 font-bold mt-1 text-[10px]">FINISHED #{p.finishedRank}</span>}
                                {!p.connected && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/90 text-white text-[10px] font-bold px-1 rounded border border-red-400 animate-pulse whitespace-nowrap z-50">
                                        OFFLINE
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* CENTER PILE (Active Cards) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 flex items-center justify-center z-10 pointer-events-none">
                    <AnimatePresence>
                        {gameState.lastMove && (
                            <motion.div
                                key={gameState.lastMove.playerId + gameState.lastMove.cards.length}
                                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: -20 }}
                                className="flex -space-x-12 pointer-events-auto"
                            >
                                {gameState.lastMove.cards.map((c, i) => (
                                    <div key={i} className="transform hover:-translate-y-2 transition-transform shadow-2xl">
                                        <Card card={c} size="normal" />
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {/* Last Player Name */}
                    {gameState.lastMove && (
                        <div className="absolute -bottom-16 text-gray-400 text-sm bg-black/50 px-3 py-1 rounded-full whitespace-nowrap w-max">
                            Last: {gameState.players.find(p => p.id === gameState.lastMove.playerId)?.username}
                        </div>
                    )}

                    {!gameState.lastMove && gameState.phase === 'PLAYING' && (
                        <div className="text-gray-600 font-bold text-xl opacity-50">{t('tableEmpty')}</div>
                    )}
                </div>

                {/* Phase Overlay (Taxation/Market) */}
                {(gameState.phase === 'TAXATION' || gameState.phase === 'MARKET') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-xl p-4 text-center pointer-events-auto">
                        <h2 className={`text-3xl font-black mb-2 ${gameState.phase === 'TAXATION' ? 'text-green-500' : 'text-blue-500'}`}>
                            {gameState.phase === 'TAXATION' ? t('taxationPhase') : t('marketPhase', { time: gameState.timeLeft })}
                        </h2>
                        {/* Logic Content would go here, currently empty in this block? Restore from previous if needed or relying on existing logic? */}
                        {/* Wait, I need to make sure the BUTTONS for Tax/Market are here too? */}
                        {/* In the big rewrite (Step 1141), there was logic here. */}
                        {/* The view_file output in Step 1167 shows the logic was MISSING in lines 390-406! */}
                        {/* I must restore the Logic UI here. */}

                        {/* Taxation Logic UI */}
                        {gameState.phase === 'TAXATION' && (
                            <div className="mt-4">
                                {myPlayer && myPlayer.taxDebt > 0 ? (
                                    <>
                                        <p className="mb-4 text-green-400 text-xl">{myPlayer.rank <= 2 ? t('rank1TaxMsg') : t('peonTaxMsg')}</p>
                                        <div className="text-sm text-gray-300 mb-2">Select {myPlayer.taxDebt} cards to {myPlayer.rank <= 2 ? 'return' : 'give'}</div>
                                        <button onClick={handleTaxationSubmit} disabled={selectedCards.length !== myPlayer.taxDebt} className="bg-green-600 px-6 py-2 rounded font-bold disabled:opacity-50 hover:bg-green-500 transition-colors">
                                            {myPlayer.rank <= 2 ? t('returnCardsBtn') : t('payTaxBtn')}
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-gray-400 text-xl animate-pulse">{t('taxWatching')}</p>
                                )}
                            </div>
                        )}

                        {/* Market Logic UI */}
                        {gameState.phase === 'MARKET' && (
                            <div className="mt-4">
                                <p className="mb-4 text-blue-300">
                                    {t('marketPhase', { time: gameState.timeLeft })}<br />
                                    {gameState.marketPoolCount !== undefined && `Submitted: ${gameState.marketPoolCount}/${gameState.players.length}`}
                                </p>

                                {myPlayer?.marketPassed ? (
                                    <div className="text-green-400 font-bold animate-pulse text-xl">
                                        {t('waitingForOthers')}
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-sm text-gray-300 mb-2">
                                            {selectedCards.length > 0 ? `Selected ${selectedCards.length} cards` : t('selectMarketCard')}
                                        </div>
                                        <div className="flex gap-2 justify-center">
                                            <button onClick={() => handleMarketTrade(selectedCards)} className="bg-blue-600 px-6 py-2 rounded font-bold hover:bg-blue-500 transition-colors">
                                                {selectedCards.length > 0 ? t('submitToMarket') : t('passBtn')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Current Turn Indicator (Big) */}
                <div className="absolute top-24 w-full text-center pointer-events-none">
                    {gameState.revolutionActive && <div className="text-red-500 font-bold animate-pulse text-2xl mb-2">⚔️ REVOLUTION ⚔️</div>}
                    <div className="text-gray-400 text-xs tracking-widest uppercase mb-1">
                        {gameState.players.find(p => p.id === gameState.currentTurn)?.id === socket.id ? t('yourTurn') : t('opponentsTurn', { name: gameState.players.find(p => p.id === gameState.currentTurn)?.username || 'Unknown' })}
                    </div>
                    <div className="text-3xl font-black text-white drop-shadow-md">
                        {gameState.players.find(p => p.id === gameState.currentTurn)?.username}
                    </div>
                    {gameState.timeLeft !== undefined && <div className="text-blue-300 font-mono text-xl">{gameState.timeLeft}s</div>}
                </div>

                {/* PLAYER HAND AREA */}
                <div className="absolute bottom-4 left-4 z-50 pointer-events-auto">
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
                    {/* Card Count Label - Top Left of First Card? Or separate? */}
                    <div className="relative">
                        <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md border border-blue-400 z-50">
                            You have {myPlayer?.hand.length} cards
                        </div>
                        <div className="flex items-end justify-start -space-x-12 p-4 overflow-x-auto max-w-[80vw] scrollbar-hide"
                            style={{ paddingBottom: '20px' }}> {/* Removed hover:-space-x-8 */}
                            <AnimatePresence>
                                {myPlayer?.hand.map((card, index) => {
                                    const playable = isCardPlayable(card);
                                    const selected = selectedCards.includes(card.id);
                                    return (
                                        <motion.div
                                            layoutId={`card-${card.id}`}
                                            key={card.id}
                                            className={`relative transition-all duration-200 flex-shrink-0
                                        ${!playable && !card.isJoker ? 'brightness-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:-translate-y-6 hover:z-50'} 
                                            ${selected ? '-translate-y-10 z-40 ring-4 ring-green-500 rounded-lg' : ''}
                                        `}
                                            onClick={() => handleCardClick(card.id)}
                                            style={{ zIndex: index }}
                                        >
                                            <Card card={card} isPlayable={true} />
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
