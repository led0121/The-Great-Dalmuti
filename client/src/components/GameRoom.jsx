import { useState, useEffect } from 'react'
import Card from './Card'
import Chat from './Chat'
import { motion, AnimatePresence } from 'framer-motion'

export default function GameRoom({ socket, room, gameState, username, onStartGame, onPlay, onPass }) {
    const [selectedCards, setSelectedCards] = useState([])

    // Reset selection on phase change
    useEffect(() => {
        setSelectedCards([])
    }, [gameState?.phase])

    const isOwner = room.ownerId === socket.id
    const myPlayer = gameState?.players.find(p => p.id === socket.id)
    const isMyTurn = gameState?.currentTurn === socket.id

    // Helper: Rank Name
    const getRankName = (rank) => {
        if (rank === 1) return 'Great Dalmuti'
        if (rank === 2) return 'Lesser Dalmuti'
        if (rank === gameState?.players.length) return 'Great Peon'
        if (rank === gameState?.players.length - 1) return 'Lesser Peon'
        return 'Merchant'
    }

    // HELPER: Get rank of card
    const getCardRank = (card) => card.rank

    const toggleCardSelection = (cardId) => {
        const clickedCard = myPlayer.hand.find(c => c.id === cardId)
        if (!clickedCard) return

        setSelectedCards(prev => {
            if (prev.includes(cardId)) {
                return prev.filter(id => id !== cardId)
            } else {
                // PHASE SPECIFIC SELECTION LOGIC
                if (gameState.phase === 'TAXATION') {
                    // Dalmuti selects exactly 2 cards
                    if (prev.length >= 2) return prev; // Max 2
                    return [...prev, cardId];
                }

                if (gameState.phase === 'MARKET') {
                    // Market: Select only 1 card to trade
                    return [cardId]; // Replace selection
                }

                // PLAYING: logic
                // AUTO-DESELECT LOGIC: If picking a different rank, clear previous selection
                // Exception: Jokers (Rank 13) can go with anything? 
                // Simplified: Enforce strict rank grouping selection helper for user convenience.
                // If existing selection exist:
                if (prev.length > 0) {
                    const firstSelected = myPlayer.hand.find(c => c.id === prev[0])
                    // If newly clicked card is Joker (13), allows adding? Or if already selected Joker?
                    // Let's implement strict "Same Rank" grouping assist.
                    // If playing 2 Jokers, they are rank 13.
                    // If playing Rank X + Joker: The Joker acts as Rank X.

                    // Logic: If I click a card, and it doesn't match the 'implied rank' of current selection, reset.
                    // Implied rank = Rank of non-jokers in selection.

                    const currentSelectionCards = myPlayer.hand.filter(c => prev.includes(c.id));
                    const nonJokers = currentSelectionCards.filter(c => !c.isJoker);

                    if (!clickedCard.isJoker) {
                        if (nonJokers.length > 0 && nonJokers[0].rank !== clickedCard.rank) {
                            // Selected different rank -> Reset and select new
                            return [cardId];
                        }
                    }
                    // If I select non-joker while having ONLY jokers selected? Allow.
                }
                return [...prev, cardId]
            }
        })
    }

    // Actions
    const handleRestart = () => {
        socket.emit('restart_game');
    }

    const handleTaxationSubmit = () => {
        if (selectedCards.length === 2) {
            socket.emit('taxation_return', selectedCards);
        }
    }

    const handleMarketTrade = () => {
        if (selectedCards.length === 1) {
            socket.emit('market_trade', selectedCards[0]);
            setSelectedCards([]); // Clear after trade offer
        }
    }

    const handleMarketPass = () => {
        socket.emit('market_pass');
    }

    const handlePlayClick = () => {
        if (selectedCards.length > 0) {
            onPlay(selectedCards);
            setSelectedCards([]);
        }
    }

    // --- RENDER HELPERS ---

    const renderCard = (card, isPlayable = true, onClickOverride = null) => (
        <div key={card.id} className={`relative transition-transform hover:z-20 ${!isPlayable ? 'opacity-50 grayscale' : ''}`}>
            <Card
                card={card}
                isSelected={selectedCards.includes(card.id)}
                onClick={() => {
                    if (onClickOverride) onClickOverride();
                    else toggleCardSelection(card.id);
                }}
            />
        </div>
    )

    // LOBBY
    if (room.status === 'LOBBY') {
        // ... (existing lobby code, using previous implementation logic basically)
        return (
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 text-center relative">
                <Chat socket={socket} username={username} room={room} />
                <h2 className="text-3xl font-bold mb-4 text-amber-400">{room.name}</h2>
                <div className="text-gray-300 mb-6 font-mono bg-gray-900 p-2 rounded inline-block">
                    Room ID: <span className="text-white select-all">{room.id}</span>
                </div>
                <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-3 text-white">Players ({room.players.length})</h3>
                    <div className="flex flex-wrap gap-4 justify-center">
                        {room.players.map(p => (
                            <div key={p.id} className="bg-gray-700 px-4 py-2 rounded flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center font-bold">
                                    {p.username[0].toUpperCase()}
                                </div>
                                <span>{p.username}</span>
                                {room.ownerId === p.id && <span className="text-xs text-yellow-400 border border-yellow-400 px-1 rounded">HOST</span>}
                            </div>
                        ))}
                    </div>
                </div>
                {isOwner ? (
                    <button onClick={onStartGame} disabled={room.players.length < 3} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold py-3 px-8 rounded-lg transition-all transform active:scale-95 shadow-lg shadow-green-900/50">Start Game</button>
                ) : (
                    <div className="text-gray-400 animate-pulse">Waiting for host to start...</div>
                )}
            </div>
        )
    }

    if (!gameState) return <div className="text-white">Loading game state...</div>

    // FINISHED VIEW
    if (gameState.phase === 'FINISHED') {
        const winner = gameState.players.find(p => p.rank === 1);
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 relative overflow-hidden">
                <Chat socket={socket} username={username} room={room} />
                <div className="absolute inset-0 bg-[url('/confetti.gif')] opacity-20 pointer-events-none"></div>
                <h1 className="text-6xl font-black text-yellow-500 mb-4 animate-bounce">GAME OVER</h1>
                <div className="text-3xl mb-8">Winner is <span className="font-bold text-white">{winner?.username}</span>! 👑</div>

                <div className="grid grid-cols-1 gap-4 mb-8 w-full max-w-md">
                    {gameState.players.sort((a, b) => a.rank - b.rank).map(p => (
                        <div key={p.id} className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700">
                            <span className="font-bold text-yellow-400">#{p.rank} {getRankName(p.rank)}</span>
                            <span className="text-xl">{p.username}</span>
                        </div>
                    ))}
                </div>

                {isOwner && (
                    <div className="flex gap-4 z-50">
                        <button onClick={handleRestart} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded shadow-lg text-xl transition-transform active:scale-95">
                            Start Next Round (Preserve Ranks)
                        </button>
                    </div>
                )}
                {!isOwner && <div className="text-gray-400 animate-pulse">Waiting for host...</div>}
            </div>
        )
    }

    // TAXATION VIEW
    if (gameState.phase === 'TAXATION') {
        const iAmDalmuti = myPlayer.rank === 1;
        const iAmPeon = myPlayer.rank === gameState.players.length;

        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white relative">
                <Chat socket={socket} username={username} room={room} />
                <h2 className="text-4xl font-bold text-yellow-500 mb-2">Taxation Phase</h2>
                <p className="mb-8 text-gray-300">The weak pay tribute to the strong.</p>

                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 flex flex-col items-center max-w-4xl w-full">
                    {iAmDalmuti ? (
                        <>
                            <div className="text-2xl font-bold text-green-400 mb-4">You are the Great Dalmuti! 👑</div>
                            <p className="mb-4">Select 2 cards to return to the Great Peon.</p>
                            {/* Hand */}
                            <div className="flex -space-x-8 hover:-space-x-4 transition-all p-4 overflow-x-auto mb-6 w-full justify-center">
                                {myPlayer.hand.map(card => (
                                    <div key={card.id} onClick={() => toggleCardSelection(card.id)}
                                        className={`relative transition-transform cursor-pointer hover:-translate-y-4 ${selectedCards.includes(card.id) ? 'ring-4 ring-green-500 z-50 -translate-y-6' : ''}`}>
                                        <Card card={card} isPlayable={true} size="normal" />
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleTaxationSubmit} disabled={selectedCards.length !== 2}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 px-8 rounded text-xl">
                                Return Cards
                            </button>
                        </>
                    ) : iAmPeon ? (
                        <>
                            <div className="text-2xl font-bold text-red-400 mb-4">You are the Great Peon... 🧹</div>
                            <p className="text-gray-400 animate-pulse">Your 2 best cards are being automatically taxed...</p>
                            <p className="mt-4">Waiting for Dalmuti to return cards.</p>
                        </>
                    ) : (
                        <div className="text-2xl text-gray-400">Watching the transaction...</div>
                    )}
                </div>
            </div>
        )
    }

    // MARKET VIEW
    if (gameState.phase === 'MARKET') {
        return (
            <div className="w-full h-screen flex flex-col items-center pt-20 bg-gray-900 text-white relative">
                <Chat socket={socket} username={username} room={room} />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
                    <h2 className="text-3xl font-bold text-blue-400">Market Phase</h2>
                    <div className="text-5xl font-mono font-bold mt-2">{gameState.timeLeft}s</div>
                </div>

                <div className="flex-1 w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                    {/* Market Info */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col items-center justify-center">
                        <div className="text-xl mb-4">Active Traders: {gameState.marketPoolCount}</div>
                        <p className="text-gray-400 text-center mb-6">
                            Select 1 card from your hand to trade. <br />
                            You will receive a random card from another trader.
                        </p>
                        {myPlayer.marketPassed ? (
                            <div className="text-green-500 font-bold text-2xl">Ready / Passed</div>
                        ) : (
                            <button onClick={handleMarketTrade} disabled={selectedCards.length !== 1}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 px-12 rounded-xl text-2xl">
                                TRADE (1 Card)
                            </button>
                        )}
                        {!myPlayer.marketPassed && (
                            <button onClick={handleMarketPass} className="mt-4 text-gray-400 hover:text-white underline">
                                Done Trading (Pass)
                            </button>
                        )}
                    </div>

                    {/* Hand */}
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 overflow-hidden flex flex-col">
                        <h3 className="text-lg font-bold mb-4">Your Hand</h3>
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {myPlayer.hand.map(card => (
                                    <div key={card.id} onClick={() => toggleCardSelection(card.id)}
                                        className={`cursor-pointer transform hover:scale-105 transition-transform ${selectedCards.includes(card.id) ? 'ring-2 ring-blue-500' : ''}`}>
                                        <Card card={card} isPlayable={true} size="small" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // PLAYING VIEW (Existing Logic + Layout Fixes)
    const opponents = gameState.players.filter(p => p.id !== socket.id)

    // Check playable for Playing Phase
    const isCardPlayable = (card) => {
        if (!isMyTurn) return false; // Not my turn -> technically unplayable now
        if (!gameState.lastMove) return true; // Empty table -> everything playable (conceptually)
        // Note: Individual card might be part of a valid set. 
        // We can only gray out ranks that are DEFINITELY strictly worse than lastMove.
        // Last Move Rank:
        // We removed getPrimaryRank helper from here? Let's reimplement simple one or assume backend validates.
        // Better: Re-add helper or use backend rejection visual only?
        // Let's rely on basic check:
        // Proper Check:
        const getRank = (c) => c.isJoker ? 13 : c.rank;
        const lastMoveRank = gameState.lastMove.cards.find(c => !c.isJoker)?.rank || 13;

        if (card.isJoker) return true;
        if (card.rank >= lastMoveRank) return false;
        return true;
    }

    const getPrimaryRank = (cards) => {
        const nonJokers = cards.filter(c => !c.isJoker);
        if (nonJokers.length === 0) return 13;
        return nonJokers[0].rank;
    }

    return (
        <div className="w-full h-screen flex flex-col justify-between p-4 overflow-hidden relative bg-[#1a1a1a]">
            {/* Background Texture or Gradient */}
            <Chat socket={socket} username={username} room={room} />

            {/* Opponents Area (Top) */}
            <div className="flex justify-center gap-8 pt-4 z-10">
                {opponents.map((p, i) => (
                    <div key={p.id} className={`flex flex-col items-center transition-opacity ${gameState.currentTurn === p.id ? 'opacity-100 scale-110' : 'opacity-70'} ${!p.connected ? 'grayscale opacity-50' : ''}`}>
                        <div className="relative">
                            {p.rank === 1 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl drop-shadow-md">👑</div>}
                            {p.rank === gameState.players.length && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl drop-shadow-md">🧹</div>}

                            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center bg-gray-700 text-xl font-bold mb-2 relative overflow-hidden
                            ${gameState.currentTurn === p.id ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-gray-600'}
                        `}>
                                {p.username[0]}
                            </div>
                            {!p.connected && <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full text-xs font-bold text-red-500">OFF</div>}
                            {p.finished && <div className="absolute -top-2 -right-2 bg-green-500 text-xs px-2 py-0.5 rounded-full font-bold">DONE</div>}
                        </div>
                        <span className="font-medium text-sm text-gray-200">{p.username}</span>
                        <div className="flex -space-x-3 mt-1">
                            {Array.from({ length: Math.min(p.cardCount, 5) }).map((_, idx) => (
                                <div key={idx} className="w-6 h-9 bg-blue-900 border border-blue-400 rounded shadow-sm" />
                            ))}
                            {p.cardCount > 5 && <span className="text-xs bg-gray-800 rounded px-1 ml-1 self-center text-white">+{p.cardCount - 5}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Center Table Area */}
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl flex flex-col justify-center items-center gap-8 pointer-events-none z-0">
                {/* Current Turn Indicator - Moved Up */}
                <div className="text-center">
                    {/* Revolution Banner */}
                    {gameState.revolutionActive && (
                        <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-8 py-2 rounded-full font-bold shadow-2xl animate-pulse whitespace-nowrap z-50 border-2 border-yellow-400">
                            ⚔️ REVOLUTION! ⚔️
                        </div>
                    )}

                    <div className="text-sm text-gray-400 mb-1 font-mono uppercase tracking-widest">Current Turn</div>
                    <div className="text-4xl font-black text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {gameState.players.find(p => p.id === gameState.currentTurn)?.username}
                    </div>
                    {/* Timer Display */}
                    {gameState.timeLeft != null && (
                        <div className={`text-3xl font-mono font-bold mt-2 transition-colors ${gameState.timeLeft <= 10 ? 'text-red-500 animate-[pulse_0.2s_infinite]' : 'text-blue-300'}`}>
                            {gameState.timeLeft}s
                        </div>
                    )}
                    {gameState.players.find(p => p.id === gameState.currentTurn)?.id === socket.id &&
                        <div className="text-green-400 font-bold mt-2 text-xl animate-bounce">YOUR TURN!</div>
                    }
                </div>

                {/* Discard Pile / Last Move - Better Containment */}
                <div className="relative w-96 h-56 flex justify-center items-center bg-white/5 rounded-2xl border-4 border-dashed border-white/10 backdrop-blur-sm shadow-2xl">
                    {gameState.lastMove ? (
                        <>
                            <div className="flex justify-center items-center -space-x-12 px-4 w-full overflow-hidden">
                                {/* Sort and Display Last Move Cards */}
                                {[...gameState.lastMove.cards].sort((a, b) => a.rank - b.rank).map((c, i) => (
                                    <div key={c.id} style={{ zIndex: i }} className="transform shadow-xl">
                                        <Card card={c} isPlayable={false} size="normal" />
                                    </div>
                                ))}
                            </div>
                            <div className="absolute -top-4 bg-gray-900 text-yellow-400 text-sm font-bold px-3 py-1 rounded-full border border-yellow-600 shadow-lg">
                                {gameState.lastMove.cards.length} Cards
                            </div>
                        </>
                    ) : (
                        <div className="text-gray-500 font-bold text-xl">Empty Table</div>
                    )}
                    {gameState.lastMove && (
                        <div className="absolute -bottom-10 text-base font-bold text-white bg-gray-800/80 px-4 py-1 rounded-full">
                            Last: {gameState.players.find(p => p.id === gameState.lastMove.playerId)?.username}
                        </div>
                    )}
                </div>
            </div>

            {/* Player Hand Area (Bottom) */}
            <div className="pb-4 flex flex-col items-center w-full z-10">
                {/* Player Controls */}
                <div className="mb-6 flex gap-4 h-12 pointer-events-auto">
                    {isMyTurn && !myPlayer.finished && (
                        <>
                            <button
                                onClick={handlePlayClick}
                                disabled={selectedCards.length === 0}
                                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all active:scale-95"
                            >
                                Play Selected ({selectedCards.length})
                            </button>
                            <button
                                onClick={onPass}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all active:scale-95"
                            >
                                Pass
                            </button>
                        </>
                    )}
                </div>

                {/* Cards */}
                <div className="flex -space-x-12 hover:-space-x-8 transition-all duration-300 p-4 overflow-x-auto max-w-full pointer-events-auto">
                    <AnimatePresence>
                        {myPlayer?.hand.map((card) => {
                            const playable = isCardPlayable(card);
                            return (
                                <div key={card.id} className={`relative transition-transform hover:z-20 ${!playable && !card.isJoker ? 'opacity-50 grayscale' : ''}`}>
                                    <Card
                                        card={card}
                                        isSelected={selectedCards.includes(card.id)}
                                        onClick={() => {
                                            if (gameState.lastMove && !isMyTurn) return;
                                            // Optional: Enforce validation here to prevent selecting
                                            // if (!playable) return; 
                                            toggleCardSelection(card.id)
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </AnimatePresence>
                </div>
                {myPlayer?.finished && (
                    <div className="text-3xl font-bold text-green-400 mt-4">You Finished! 🎉</div>
                )}
            </div>
        </div>
    )
}
