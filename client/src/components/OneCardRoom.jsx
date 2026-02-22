import { useState, useEffect } from 'react'
import Chat from './Chat'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS = { hearts: '#ef4444', diamonds: '#ef4444', clubs: '#1f2937', spades: '#1f2937' }
const SUIT_BG = { hearts: '#fef2f2', diamonds: '#fef2f2', clubs: '#f9fafb', spades: '#f9fafb' }
const SUIT_NAMES_KO = { hearts: '하트', diamonds: '다이아', clubs: '클로버', spades: '스페이드' }
const SUIT_NAMES_EN = { hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades' }

// Attack card info for display
const ATTACK_CARDS_INFO = {
    two: { label_ko: '2', label_en: '2', value: '+2', color: 'blue' },
    ace: { label_ko: 'A', label_en: 'A', value: '+3', color: 'red' },
    blackJoker: { label_ko: '흑백 조커', label_en: 'B.Joker', value: '+5', color: 'gray' },
    colorJoker: { label_ko: '컬러 조커', label_en: 'C.Joker', value: '+7', color: 'purple' },
}

function PlayingCard({ card, isSelected, onClick, isPlayable = true, size = 'normal', faceDown = false }) {
    if (faceDown) {
        const sizeClasses = size === 'small' ? 'w-10 h-14' : size === 'tiny' ? 'w-6 h-9' : 'w-20 h-28'
        return (
            <div className={`${sizeClasses} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-600 shadow-md flex items-center justify-center`}>
                <div className="w-3/4 h-3/4 border border-blue-400/30 rounded opacity-50 bg-blue-900/50" />
            </div>
        )
    }

    // === JOKER CARDS ===
    if (card.rank === 'BJ' || card.rank === 'CJ') {
        const isColor = card.rank === 'CJ'
        const sizeClasses = size === 'small' ? 'w-10 h-14 text-[10px]' : size === 'tiny' ? 'w-6 h-9 text-[8px]' : 'w-20 h-28 text-base'

        return (
            <motion.div
                onClick={onClick}
                className={`${sizeClasses} rounded-lg border-2 shadow-md flex flex-col items-center justify-center cursor-pointer select-none relative overflow-hidden transition-all duration-200
                    ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-3 z-40 scale-105' : 'hover:-translate-y-1'}
                    ${!isPlayable ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                    ${isColor
                        ? 'border-purple-500 shadow-purple-500/30 bg-gradient-to-br from-red-100 via-yellow-100 via-green-100 to-blue-100'
                        : 'border-gray-600 shadow-gray-500/20 bg-gradient-to-br from-gray-100 to-gray-300'
                    }
                `}
                whileHover={isPlayable ? { y: -4 } : {}}
                whileTap={isPlayable ? { y: 0 } : {}}
            >
                {/* Joker symbol */}
                <div className={`text-center ${size === 'normal' ? 'text-xs' : 'text-[6px]'}`}>
                    <div className={`font-black ${size === 'normal' ? 'text-2xl' : 'text-sm'} ${isColor ? 'text-purple-600' : 'text-gray-700'}`}>
                        {isColor ? '🌈' : '🃏'}
                    </div>
                    <div className={`font-bold tracking-tighter ${isColor ? 'text-purple-600' : 'text-gray-600'}`}>
                        JOKER
                    </div>
                </div>

                {/* Attack badge */}
                {size === 'normal' && (
                    <div className={`absolute top-0.5 right-0.5 text-white text-[7px] px-1 rounded font-bold ${isColor ? 'bg-purple-600' : 'bg-gray-600'}`}>
                        {isColor ? '+7' : '+5'}
                    </div>
                )}
                {size === 'normal' && (
                    <div className={`absolute bottom-0.5 left-0.5 text-[7px] font-bold ${isColor ? 'text-purple-600' : 'text-gray-500'}`}>
                        {isColor ? 'COLOR' : 'B&W'}
                    </div>
                )}
            </motion.div>
        )
    }

    // === NORMAL CARDS ===
    const suitSymbol = SUIT_SYMBOLS[card.suit] || ''
    const suitColor = SUIT_COLORS[card.suit] || '#000'
    const bgColor = SUIT_BG[card.suit] || '#fff'

    const sizeClasses = size === 'small' ? 'w-10 h-14 text-[10px]' : size === 'tiny' ? 'w-6 h-9 text-[8px]' : 'w-20 h-28 text-base'
    const rankSize = size === 'small' ? 'text-xs' : size === 'tiny' ? 'text-[8px]' : 'text-lg'
    const symbolSize = size === 'small' ? 'text-lg' : size === 'tiny' ? 'text-sm' : 'text-3xl'

    // Determine if this card is a special/attack card
    const attackLabels = { 'A': '+3', '2': '+2' }
    const specialLabels = { 'J': 'SKIP', 'Q': 'REV', '7': 'SUIT', '3': '🛡' }
    const badge = attackLabels[card.rank] || specialLabels[card.rank] || null
    const isAttackType = ['A', '2'].includes(card.rank)
    const isDefense = card.rank === '3'

    return (
        <motion.div
            onClick={onClick}
            className={`${sizeClasses} rounded-lg border-2 shadow-md flex flex-col items-center justify-between p-1 cursor-pointer select-none relative overflow-hidden transition-all duration-200
                ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-3 z-40 scale-105' : 'hover:-translate-y-1'}
                ${!isPlayable ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                ${isAttackType ? 'border-red-500 shadow-red-500/20' : isDefense ? 'border-green-500 shadow-green-500/20' : 'border-gray-300'}
            `}
            style={{ backgroundColor: bgColor }}
            whileHover={isPlayable ? { y: -4 } : {}}
            whileTap={isPlayable ? { y: 0 } : {}}
        >
            {/* Top-left rank + suit */}
            <div className={`w-full flex justify-start items-center gap-0.5 ${rankSize} font-bold`} style={{ color: suitColor }}>
                <span>{card.rank}</span>
                <span className="text-[0.7em]">{suitSymbol}</span>
            </div>

            {/* Center symbol */}
            <div className={`${symbolSize} font-bold`} style={{ color: suitColor }}>
                {suitSymbol}
            </div>

            {/* Bottom-right (rotated) */}
            <div className={`w-full flex justify-end items-center gap-0.5 ${rankSize} font-bold rotate-180`} style={{ color: suitColor }}>
                <span>{card.rank}</span>
                <span className="text-[0.7em]">{suitSymbol}</span>
            </div>

            {/* Badge */}
            {badge && size === 'normal' && (
                <div className={`absolute top-0.5 right-0.5 text-white text-[7px] px-1 rounded font-bold ${isAttackType ? 'bg-red-500' : isDefense ? 'bg-green-500' : 'bg-amber-500'
                    }`}>
                    {badge}
                </div>
            )}
        </motion.div>
    )
}

// Attack card toggle component
function AttackCardToggle({ cardKey, info, enabled, onChange, language }) {
    const colorMap = {
        blue: { on: 'bg-blue-500 border-blue-400', off: 'bg-gray-700 border-gray-600', text: 'text-blue-400' },
        red: { on: 'bg-red-500 border-red-400', off: 'bg-gray-700 border-gray-600', text: 'text-red-400' },
        gray: { on: 'bg-gray-500 border-gray-400', off: 'bg-gray-700 border-gray-600', text: 'text-gray-300' },
        purple: { on: 'bg-purple-500 border-purple-400', off: 'bg-gray-700 border-gray-600', text: 'text-purple-400' },
    }
    const colors = colorMap[info.color] || colorMap.blue

    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${enabled ? `${colors.on} text-white shadow-lg` : `${colors.off} text-gray-500`
                }`}
        >
            <span className="font-bold text-sm">{language === 'ko' ? info.label_ko : info.label_en}</span>
            <span className={`text-xs font-mono ${enabled ? 'text-white/80' : 'text-gray-600'}`}>{info.value}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${enabled ? 'bg-white/20' : 'bg-gray-800'
                }`}>
                {enabled ? 'ON' : 'OFF'}
            </span>
        </button>
    )
}

export default function OneCardRoom({ socket, room, gameState, username, onStartGame, onLeave, onUpdateSettings }) {
    const [selectedCards, setSelectedCards] = useState([])
    const { t, language } = useLanguage()
    const suitNames = language === 'ko' ? SUIT_NAMES_KO : SUIT_NAMES_EN

    const isOwner = room.ownerId === socket.id
    const myPlayer = gameState?.players?.find(p => p.id === socket.id)
    const isMyTurn = gameState?.currentTurn === socket.id
    const topCard = gameState?.topCard

    // Reset selection on turn change
    useEffect(() => {
        setSelectedCards([])
    }, [gameState?.currentTurn, gameState?.phase])

    // --- LOBBY VIEW ---
    if (room.status === 'LOBBY') {
        const settings = room.settings || {};
        const attackCards = settings.attackCards || { two: true, ace: true, blackJoker: true, colorJoker: true };

        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 via-emerald-950 to-gray-900 p-4">
                <div className="bg-gray-800/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-emerald-700/50 text-center relative">
                    {/* Leave Button */}
                    <button onClick={onLeave} className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg z-10 transition-colors">
                        {t('leaveRoomBtn')}
                    </button>

                    <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="text-4xl">🃏</span>
                        <h2 className="text-3xl font-bold text-emerald-400">{room.name}</h2>
                    </div>
                    <div className="text-gray-400 mb-6 font-mono bg-gray-900/50 p-2 rounded-lg inline-block text-sm">
                        ID: <span className="text-white select-all">{room.id}</span>
                    </div>

                    {/* Game Type Selection */}
                    <div className="mb-4">
                        {isOwner ? (
                            <div className="flex justify-center gap-3">
                                <button
                                    onClick={() => onUpdateSettings({ gameType: 'dalmuti' })}
                                    className={`px-6 py-2 rounded-lg font-bold transition-all border-2 ${settings.gameType !== 'onecard'
                                            ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/30'
                                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-amber-500/50'
                                        }`}
                                >
                                    👑 {t('dalmuti')}
                                </button>
                                <button
                                    onClick={() => onUpdateSettings({ gameType: 'onecard' })}
                                    className={`px-6 py-2 rounded-lg font-bold transition-all border-2 ${settings.gameType === 'onecard'
                                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-emerald-500/50'
                                        }`}
                                >
                                    🃏 {t('onecard')}
                                </button>
                            </div>
                        ) : (
                            <span className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-bold">
                                🃏 {t('onecard')}
                            </span>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="mb-6 bg-gray-700/50 p-5 rounded-xl space-y-5">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                            {t('gameSettings')}
                        </h3>

                        {isOwner ? (
                            <>
                                {/* Timer */}
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">{t('turnTimerLabel')}</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="5" max="30" step="5"
                                            value={settings.timerDuration || 30}
                                            onChange={(e) => onUpdateSettings({ timerDuration: Number(e.target.value) })}
                                            className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-center text-white focus:border-emerald-500 outline-none"
                                        />
                                        <span className="text-sm text-gray-400">sec</span>
                                    </div>
                                </div>

                                {/* Deck Count */}
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">
                                        {language === 'ko' ? '카드 덱 수' : 'Card Decks'}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => onUpdateSettings({ attackCardCount: n })}
                                                className={`w-10 h-10 rounded-lg font-bold transition-all ${(settings.attackCardCount || 1) === n
                                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Same Number Play Toggle */}
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-300">
                                        {language === 'ko' ? '같은 숫자 한번에 내기' : 'Play Same Number'}
                                    </label>
                                    <button
                                        onClick={() => onUpdateSettings({ sameNumberPlay: !settings.sameNumberPlay })}
                                        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${settings.sameNumberPlay ? 'bg-emerald-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${settings.sameNumberPlay ? 'left-7' : 'left-0.5'
                                            }`} />
                                    </button>
                                </div>

                                {/* Attack Cards Section */}
                                <div className="border-t border-gray-600 pt-4">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        ⚔️ {language === 'ko' ? '공격 카드 설정' : 'Attack Card Settings'}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 mb-3">
                                        {language === 'ko'
                                            ? '각 공격 카드를 ON/OFF 할 수 있습니다. 같은 종류만 방어 가능하며, 상위 카드로는 막을 수 없습니다.'
                                            : 'Toggle each attack card. Defense only with same type - higher cards cannot block lower ones.'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {Object.entries(ATTACK_CARDS_INFO).map(([key, info]) => (
                                            <AttackCardToggle
                                                key={key}
                                                cardKey={key}
                                                info={info}
                                                enabled={attackCards[key] !== false}
                                                onChange={(val) => onUpdateSettings({ attackCards: { ...attackCards, [key]: val } })}
                                                language={language}
                                            />
                                        ))}
                                    </div>
                                    {/* 3 blocks 2 note */}
                                    <div className="mt-3 text-[11px] text-green-400 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                                        🛡 {language === 'ko' ? '3 카드는 2 공격만 막을 수 있습니다 (방어 전용)' : '3 card can block 2 attacks only (defense only)'}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Non-owner settings display */
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between">
                                    <span>{t('turnTimerLabel')}</span>
                                    <span className="text-white font-bold">{settings.timerDuration || 30}s</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{language === 'ko' ? '카드 덱 수' : 'Card Decks'}</span>
                                    <span className="text-white font-bold">{settings.attackCardCount || 1}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{language === 'ko' ? '같은 숫자 내기' : 'Same Number'}</span>
                                    <span className={`font-bold ${settings.sameNumberPlay ? 'text-emerald-400' : 'text-gray-500'}`}>
                                        {settings.sameNumberPlay ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                <div className="border-t border-gray-600 pt-2 mt-2">
                                    <div className="text-xs text-gray-400 mb-2 font-bold uppercase">
                                        ⚔️ {language === 'ko' ? '공격 카드' : 'Attack Cards'}
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {Object.entries(ATTACK_CARDS_INFO).map(([key, info]) => (
                                            <span key={key} className={`text-xs px-2 py-1 rounded font-bold ${attackCards[key] !== false
                                                    ? `bg-${info.color}-500/20 text-${info.color}-300`
                                                    : 'bg-gray-800 text-gray-600 line-through'
                                                }`}>
                                                {language === 'ko' ? info.label_ko : info.label_en} {info.value}
                                                {attackCards[key] !== false ? ' ✓' : ' ✗'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Players */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-white">
                            {t('players', { count: (room.players || []).length })}
                        </h3>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {(room.players || []).map(p => (
                                <div key={p.id} className="bg-gray-700/80 px-4 py-2 rounded-xl flex items-center gap-2 border border-gray-600">
                                    <span className="text-2xl font-bold text-emerald-400">{p.username?.[0]?.toUpperCase() || '?'}</span>
                                    <span className="text-white">{p.username}</span>
                                    {room.ownerId === p.id && (
                                        <span className="text-xs text-yellow-400 border border-yellow-400 px-1.5 rounded ml-1">{t('hostLabel')}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {isOwner ? (
                        <button
                            onClick={onStartGame}
                            disabled={(room.players || []).length < 2}
                            className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xl font-bold py-3 px-10 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                        >
                            {t('startGameBtn')}
                        </button>
                    ) : (
                        <div className="text-gray-400 animate-pulse">{t('waitingHost')}</div>
                    )}
                </div>
            </div>
        )
    }

    if (!gameState) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-2xl animate-pulse">{t('loading')}</div>

    // --- SUIT SELECTION MODAL ---
    if (gameState.phase === 'CHOOSE_SUIT' && gameState.suitChooser === socket.id) {
        return (
            <div className="w-full h-screen bg-gradient-to-b from-gray-900 via-emerald-950 to-gray-900 flex flex-col items-center justify-center relative">
                <Chat socket={socket} username={username} room={room} />
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-800/95 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-emerald-500/30 text-center"
                >
                    <h2 className="text-3xl font-bold text-emerald-400 mb-6">
                        {language === 'ko' ? '무늬를 선택하세요!' : 'Choose a Suit!'}
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                            <motion.button
                                key={suit}
                                onClick={() => socket.emit('choose_suit', suit)}
                                className="px-8 py-6 rounded-xl text-4xl font-bold transition-all shadow-lg hover:shadow-xl border-2"
                                style={{
                                    backgroundColor: SUIT_BG[suit],
                                    color: SUIT_COLORS[suit],
                                    borderColor: SUIT_COLORS[suit] + '40'
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div>{SUIT_SYMBOLS[suit]}</div>
                                <div className="text-sm mt-1">{suitNames[suit]}</div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            </div>
        )
    }

    // --- GAME OVER ---
    if (gameState.phase === 'FINISHED') {
        const winner = gameState.finishedPlayers?.[0]
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-emerald-950 to-gray-900 text-white p-4">
                <Chat socket={socket} username={username} room={room} />
                <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="text-center"
                >
                    <h1 className="text-6xl font-black text-emerald-400 mb-4 drop-shadow-lg">
                        {language === 'ko' ? '게임 종료!' : 'GAME OVER!'}
                    </h1>
                    <div className="text-3xl mb-8 font-bold text-yellow-400">
                        🏆 {winner?.username} {language === 'ko' ? '승리!' : 'Wins!'} 🏆
                    </div>
                    <div className="grid gap-3 mb-8">
                        {(gameState.finishedPlayers || []).map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.2 }}
                                className={`bg-gray-800/80 p-4 rounded-xl flex justify-between w-80 border shadow-lg ${i === 0 ? 'border-yellow-500 shadow-yellow-500/20' : 'border-gray-700'
                                    }`}
                            >
                                <span className="text-yellow-400 font-bold">#{p.rank}</span>
                                <span className="font-medium">{p.username}</span>
                            </motion.div>
                        ))}
                    </div>
                    {isOwner && (
                        <button
                            onClick={() => socket.emit('restart_game')}
                            className="bg-gradient-to-r from-emerald-600 to-green-500 px-8 py-3 rounded-xl text-xl font-bold hover:scale-105 transition-transform shadow-emerald-500/30 shadow-lg"
                        >
                            {language === 'ko' ? '다시 하기' : 'Play Again'}
                        </button>
                    )}
                </motion.div>
            </div>
        )
    }

    // --- PLAYING VIEW ---
    const attackCardsOpts = gameState.options?.attackCards || { two: true, ace: true, blackJoker: true, colorJoker: true }

    const isAttackCardEnabled = (card) => {
        if (card.rank === '2' && attackCardsOpts.two) return true
        if (card.rank === 'A' && attackCardsOpts.ace) return true
        if (card.rank === 'BJ' && attackCardsOpts.blackJoker) return true
        if (card.rank === 'CJ' && attackCardsOpts.colorJoker) return true
        return false
    }

    const canPlayCard = (card) => {
        if (!isMyTurn) return false
        if (gameState.phase !== 'PLAYING') return false
        if (!topCard) return true

        // Under attack - strict same-type defense only
        if (gameState.pendingAttack > 0) {
            // 3 blocks 2 attacks
            if (gameState.pendingAttackType === '2' && card.rank === '3') return true
            // Same type only
            if (card.rank === gameState.pendingAttackType && isAttackCardEnabled(card)) return true
            return false
        }

        // Suit changed by 7
        if (gameState.chosenSuit) {
            if (card.rank === '7') return true
            if (card.rank === 'BJ' || card.rank === 'CJ') return true
            return card.suit === gameState.chosenSuit || card.rank === topCard.rank
        }

        // Top card is joker - any card plays
        if (topCard && (topCard.rank === 'BJ' || topCard.rank === 'CJ')) return true

        // Normal play
        if (card.rank === 'BJ' || card.rank === 'CJ') return true
        if (card.suit === topCard.suit) return true
        if (card.rank === topCard.rank) return true
        if (card.rank === '7') return true

        return false
    }

    const handleCardClick = (cardId) => {
        if (!isMyTurn || gameState.phase !== 'PLAYING') return

        const card = myPlayer?.hand?.find(c => c.id === cardId)
        if (!card) return

        if (gameState.options?.sameNumberPlay) {
            if (selectedCards.includes(cardId)) {
                setSelectedCards(prev => prev.filter(id => id !== cardId))
                return
            }
            if (selectedCards.length === 0) {
                setSelectedCards([cardId])
            } else {
                const firstSelected = myPlayer.hand.find(c => c.id === selectedCards[0])
                if (firstSelected && card.rank === firstSelected.rank) {
                    setSelectedCards(prev => [...prev, cardId])
                } else {
                    setSelectedCards([cardId])
                }
            }
        } else {
            if (selectedCards.includes(cardId)) {
                setSelectedCards([])
            } else {
                setSelectedCards([cardId])
            }
        }
    }

    const handlePlay = () => {
        if (selectedCards.length === 0) return
        const firstCard = myPlayer?.hand?.find(c => c.id === selectedCards[0])
        if (!firstCard || !canPlayCard(firstCard)) return
        socket.emit('play_cards', { cards: selectedCards })
        setSelectedCards([])
    }

    const handleDraw = () => {
        socket.emit('draw_card')
        setSelectedCards([])
    }

    const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn)
    const opponents = gameState.players?.filter(p => p.id !== socket.id) || []

    // Attack type labels for display
    const attackTypeLabel = (type) => {
        if (type === '2') return language === 'ko' ? '2 공격' : '2 Attack'
        if (type === 'A') return language === 'ko' ? 'A 공격' : 'A Attack'
        if (type === 'BJ') return language === 'ko' ? '흑백조커 공격' : 'B.Joker Attack'
        if (type === 'CJ') return language === 'ko' ? '컬러조커 공격' : 'C.Joker Attack'
        return ''
    }

    const defenseHint = (type) => {
        if (type === '2') return language === 'ko' ? '2 또는 3으로 방어' : 'Defend with 2 or 3'
        if (type === 'A') return language === 'ko' ? 'A로만 방어' : 'Defend with A only'
        if (type === 'BJ') return language === 'ko' ? '흑백조커로만 방어' : 'Defend with B.Joker only'
        if (type === 'CJ') return language === 'ko' ? '컬러조커로만 방어' : 'Defend with C.Joker only'
        return ''
    }

    return (
        <div className="w-full h-screen bg-gradient-to-b from-[#0f1a0f] via-[#1a2e1a] to-[#0f1a0f] relative overflow-hidden flex flex-col">
            <Chat socket={socket} username={username} room={room} />

            {/* Room Info */}
            <div className="absolute top-3 left-3 z-50 text-white/40 text-xs flex items-center gap-2">
                <span>🃏 {room.name} | {username}</span>
                <button onClick={onLeave} className="bg-red-900/50 hover:bg-red-700 text-white px-2 py-0.5 rounded text-xs border border-red-800/50 transition-colors">
                    {t('leaveRoomBtn')}
                </button>
            </div>

            {/* Direction indicator */}
            <div className="absolute top-3 right-3 z-50 text-white/60 text-2xl">
                {gameState.direction === 1 ? '🔄' : '🔃'}
            </div>

            {/* OPPONENTS */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {opponents.map((p, i, arr) => {
                    const total = arr.length
                    const angleStep = 180 / (total + 1)
                    const angle = 180 + (angleStep * (i + 1))
                    const radiusX = 38
                    const radiusY = 32
                    const rad = (angle * Math.PI) / 180
                    const left = 50 + (radiusX * Math.cos(rad))
                    const top = 50 + (radiusY * Math.sin(rad))

                    const isTurn = gameState.currentTurn === p.id

                    return (
                        <motion.div
                            key={p.id}
                            className={`absolute flex flex-col items-center p-2 rounded-xl backdrop-blur-sm pointer-events-auto min-w-[90px] transition-all duration-500 ${isTurn ? 'bg-emerald-900/60 ring-2 ring-emerald-400' : 'bg-black/40'
                                }`}
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                            animate={isTurn ? { scale: 1.05 } : { scale: 1 }}
                        >
                            <div className="relative mb-1">
                                <span className={`text-3xl font-bold ${isTurn ? 'text-emerald-400 animate-pulse' : 'text-gray-400'}`}>
                                    {p.username?.[0]?.toUpperCase()}
                                </span>
                                <div className="absolute -bottom-1 -right-3 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow border border-blue-400">
                                    {p.cardCount || 0}
                                </div>
                                {!p.connected && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="bg-red-600/90 text-white text-[8px] font-bold px-1 rounded animate-pulse">OFFLINE</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-[11px] text-gray-300 max-w-[80px] truncate">{p.username}</div>
                            <div className="flex -space-x-1 mt-1">
                                {Array.from({ length: Math.min(p.cardCount || 0, 7) }).map((_, idx) => (
                                    <div key={idx} className="w-3 h-4 bg-blue-900 rounded-[2px] border border-white/20" />
                                ))}
                            </div>
                            {p.finished && <span className="text-green-400 font-bold mt-1 text-[10px]">✓</span>}
                        </motion.div>
                    )
                })}
            </div>

            {/* CENTER - Discard Pile & Deck */}
            <div className="flex-1 relative flex items-center justify-center">
                {/* Table Surface */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#1e3a1e] rounded-t-[50%] scale-x-150 opacity-30 pointer-events-none" />

                <div className="flex items-center gap-8 z-10">
                    {/* Draw Deck */}
                    <div className="relative">
                        <div className="w-24 h-36 rounded-xl bg-gradient-to-br from-blue-800 to-blue-950 border-2 border-blue-500/50 shadow-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                            onClick={isMyTurn ? handleDraw : undefined}
                        >
                            <div className="text-center">
                                <div className="text-3xl mb-1">🃏</div>
                                <div className="text-blue-300 text-xs font-bold">{gameState.deckCount}</div>
                            </div>
                        </div>
                        {isMyTurn && (
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-emerald-400 text-xs animate-bounce whitespace-nowrap font-bold">
                                {gameState.pendingAttack > 0 ? `+${gameState.pendingAttack}` : (language === 'ko' ? '뽑기' : 'Draw')}
                            </div>
                        )}
                    </div>

                    {/* Discard Pile */}
                    <div className="relative">
                        <AnimatePresence>
                            {topCard && (
                                <motion.div
                                    key={topCard.id}
                                    initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                    exit={{ scale: 0.8, opacity: 0, rotate: 15 }}
                                    className="relative"
                                >
                                    <PlayingCard card={topCard} isPlayable={false} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Pending Attack Indicator */}
                        {gameState.pendingAttack > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-6 -right-6 flex flex-col items-center"
                            >
                                <div className="bg-red-600 text-white font-black text-xl px-4 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-red-400">
                                    +{gameState.pendingAttack}
                                </div>
                                <div className="text-red-400 text-[9px] font-bold mt-0.5 bg-black/60 px-2 py-0.5 rounded whitespace-nowrap">
                                    {attackTypeLabel(gameState.pendingAttackType)}
                                </div>
                            </motion.div>
                        )}

                        {/* Defense Hint when under attack and it's my turn */}
                        {gameState.pendingAttack > 0 && isMyTurn && (
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-yellow-400 text-[10px] font-bold bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-lg whitespace-nowrap">
                                💡 {defenseHint(gameState.pendingAttackType)}
                            </div>
                        )}

                        {/* Chosen Suit Indicator */}
                        {gameState.chosenSuit && !gameState.pendingAttack && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 px-3 py-1 rounded-full text-sm flex items-center gap-1 whitespace-nowrap"
                                style={{ color: SUIT_COLORS[gameState.chosenSuit] }}
                            >
                                <span className="text-lg">{SUIT_SYMBOLS[gameState.chosenSuit]}</span>
                                <span className="text-xs">{suitNames[gameState.chosenSuit]}</span>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Current Turn Indicator */}
                <div className="absolute top-16 w-full text-center pointer-events-none">
                    <div className="text-gray-400 text-xs tracking-widest uppercase mb-1">
                        {isMyTurn
                            ? (language === 'ko' ? '당신의 턴!' : 'YOUR TURN!')
                            : (language === 'ko' ? `${currentPlayer?.username || ''}님의 턴` : `${currentPlayer?.username || ''}'s Turn`)
                        }
                    </div>
                    <div className="text-2xl font-black text-white drop-shadow-md">
                        {currentPlayer?.username}
                    </div>
                    {gameState.timeLeft !== undefined && (
                        <div className={`font-mono text-lg ${gameState.timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-emerald-300'}`}>
                            {gameState.timeLeft}s
                        </div>
                    )}
                </div>

                {/* Suit Choosing Waiting */}
                {gameState.phase === 'CHOOSE_SUIT' && gameState.suitChooser !== socket.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40 pointer-events-none">
                        <div className="text-2xl text-emerald-400 animate-pulse font-bold">
                            {language === 'ko' ? '무늬 선택 중...' : 'Choosing suit...'}
                        </div>
                    </div>
                )}
            </div>

            {/* PLAYER HAND AREA */}
            <div className="absolute bottom-2 left-4 right-4 z-50 pointer-events-auto">
                {/* Controls */}
                <div className="mb-2 h-10 flex gap-3 items-center">
                    {isMyTurn && myPlayer && !myPlayer.finished && gameState.phase === 'PLAYING' && (
                        <>
                            <motion.button
                                onClick={handlePlay}
                                disabled={selectedCards.length === 0}
                                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:from-gray-700 disabled:to-gray-600 disabled:opacity-50 text-white font-bold py-2 px-8 rounded-full shadow-lg transition-all active:scale-95 border-2 border-emerald-400/50 disabled:border-gray-500"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                🔥 {language === 'ko' ? `카드 내기 (${selectedCards.length})` : `Play (${selectedCards.length})`}
                            </motion.button>
                            <motion.button
                                onClick={handleDraw}
                                className={`font-bold py-2 px-6 rounded-full shadow-lg transition-all active:scale-95 border-2 ${gameState.pendingAttack > 0
                                        ? 'bg-red-700 hover:bg-red-600 text-white border-red-500'
                                        : 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500'
                                    }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                📥 {gameState.pendingAttack > 0 ? `+${gameState.pendingAttack} ${language === 'ko' ? '받기' : 'Take'}` : (language === 'ko' ? '뽑기' : 'Draw')}
                            </motion.button>
                        </>
                    )}
                    {myPlayer && (
                        <div className="bg-blue-600/80 text-white text-xs font-bold px-3 py-1 rounded-full border border-blue-400 ml-auto">
                            {language === 'ko' ? `카드 ${myPlayer.hand?.length || 0}장` : `${myPlayer.hand?.length || 0} Cards`}
                        </div>
                    )}
                </div>

                {/* Hand */}
                <div className="flex items-end -space-x-6 p-2 overflow-x-auto max-w-[90vw] scrollbar-hide" style={{ paddingBottom: '10px' }}>
                    <AnimatePresence>
                        {myPlayer?.hand?.map((card, index) => {
                            const playable = canPlayCard(card)
                            const selected = selectedCards.includes(card.id)
                            return (
                                <motion.div
                                    key={card.id}
                                    layoutId={`onecard-${card.id}`}
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -50, opacity: 0 }}
                                    className="flex-shrink-0"
                                    style={{ zIndex: selected ? 100 : index }}
                                >
                                    <PlayingCard
                                        card={card}
                                        isSelected={selected}
                                        onClick={() => handleCardClick(card.id)}
                                        isPlayable={playable}
                                    />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
