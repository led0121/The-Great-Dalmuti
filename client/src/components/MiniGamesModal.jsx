import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useLanguage } from '../LanguageContext'

export default function MiniGamesModal({ socket, isOpen, onClose }) {
    const { language } = useLanguage()
    const ko = language === 'ko'
    const [activeTab, setActiveTab] = useState('slot')

    // Universal states
    const [bet, setBet] = useState(100)
    const [isSpinning, setIsSpinning] = useState(false)
    const [resultMsg, setResultMsg] = useState(null)
    const [netGain, setNetGain] = useState(null)

    // Slot states
    const [reels, setReels] = useState(['🍒', '🍒', '🍒'])

    // Roulette states
    const [colorBet, setColorBet] = useState('red') // 'red', 'black', 'green'
    const [rouletteColor, setRouletteColor] = useState(null)
    const [rouletteNum, setRouletteNum] = useState(null)

    useEffect(() => {
        if (!isOpen) {
            setResultMsg(null)
            setIsSpinning(false)
        }
    }, [isOpen])

    const handlePlaySlot = () => {
        if (isSpinning) return
        setIsSpinning(true)
        setResultMsg(null)

        // Spin animation
        let spinCount = 0
        const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣']
        const interval = setInterval(() => {
            setReels([
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
            ])
            spinCount++
            if (spinCount > 15) {
                clearInterval(interval)
                socket.emit('play_minigame', { gameType: 'slot', betAmount: bet }, (res) => {
                    setIsSpinning(false)
                    if (res.success) {
                        setReels(res.resultData.reels)
                        setResultMsg(res.resultData.message)
                        setNetGain(res.payout - bet)
                    } else {
                        setResultMsg(res.error)
                        setNetGain(null)
                    }
                })
            }
        }, 100)
    }

    const handlePlayRoulette = () => {
        if (isSpinning) return
        setIsSpinning(true)
        setResultMsg(null)
        setRouletteColor(null)
        setRouletteNum(null)

        // Spin animation
        let spinCount = 0
        const interval = setInterval(() => {
            setRouletteNum(Math.floor(Math.random() * 15))
            spinCount++
            if (spinCount > 15) {
                clearInterval(interval)
                socket.emit('play_minigame', { gameType: 'roulette', betAmount: bet, extraData: { color: colorBet } }, (res) => {
                    setIsSpinning(false)
                    if (res.success) {
                        setRouletteNum(res.resultData.number)
                        setRouletteColor(res.resultData.color)
                        setResultMsg(res.resultData.message)
                        setNetGain(res.payout - bet)
                    } else {
                        setResultMsg(res.error)
                        setNetGain(null)
                    }
                })
            }
        }, 100)
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col border border-gray-600 relative z-50 text-white overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 border-t-4 border-t-amber-500">
                        <h2 className="text-xl font-black text-amber-400">
                            🎰 {ko ? '미니 게임' : 'Mini Games'}
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-900 border-b border-gray-700">
                        {[
                            { id: 'slot', label: ko ? '슬롯머신' : 'Slot Machine' },
                            { id: 'roulette', label: ko ? '룰렛' : 'Roulette' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => { setActiveTab(t.id); setResultMsg(null); }}
                                className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activeTab === t.id ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Game View */}
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-700 mb-6 min-h-[160px] flex flex-col items-center justify-center relative">
                            {activeTab === 'slot' && (
                                <div className="text-center">
                                    <div className="flex gap-4 justify-center text-5xl mb-4 bg-gray-800 p-4 rounded-xl border-y-4 border-yellow-600 shadow-inner">
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-900 rounded border border-gray-700">{reels[0]}</div>
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-900 rounded border border-gray-700">{reels[1]}</div>
                                        <div className="w-16 h-16 flex items-center justify-center bg-gray-900 rounded border border-gray-700">{reels[2]}</div>
                                    </div>
                                    {resultMsg && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={`text-xl font-black ${netGain > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultMsg} {netGain > 0 ? `+${netGain}` : netGain}
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'roulette' && (
                                <div className="text-center flex flex-col items-center">
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black border-4 shadow-xl mb-4
                                        ${rouletteNum === null ? 'bg-gray-800 border-gray-600' :
                                            rouletteColor === 'green' ? 'bg-green-600 border-green-400 text-white' :
                                                rouletteColor === 'red' ? 'bg-red-600 border-red-400 text-white' :
                                                    'bg-black border-gray-600 text-white'}`}
                                    >
                                        {rouletteNum !== null ? rouletteNum : '?'}
                                    </div>
                                    {resultMsg && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={`text-xl font-black ${netGain > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultMsg} {netGain > 0 ? `+${netGain}` : netGain}
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="space-y-4">
                            {/* Bet Settings */}
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wider block">
                                    🪙 {ko ? '베팅 금액' : 'Bet Amount'}
                                </label>
                                <div className="flex gap-2">
                                    {[100, 500, 1000, 5000].map(amt => (
                                        <button
                                            key={amt}
                                            disabled={isSpinning}
                                            onClick={() => setBet(amt)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${bet === amt
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-gray-700 text-gray-300 disabled:opacity-50'
                                                }`}
                                        >
                                            {amt.toLocaleString()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Game specific inputs & action button */}
                            {activeTab === 'slot' && (
                                <button
                                    disabled={isSpinning}
                                    onClick={handlePlaySlot}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all"
                                >
                                    {isSpinning ? (ko ? '회전 중...' : 'Spinning...') : (ko ? '스핀 (SPIN)' : 'SPIN')}
                                </button>
                            )}

                            {activeTab === 'roulette' && (
                                <div>
                                    <div className="flex gap-2 mb-4">
                                        <button disabled={isSpinning} onClick={() => setColorBet('red')} className={`flex-1 py-2 rounded-lg font-bold border-2 ${colorBet === 'red' ? 'bg-red-600 border-red-400 text-white' : 'bg-red-600/30 border-red-600/50 text-red-200'}`}>{ko ? '🔴 레드 (x2)' : 'Red (x2)'}</button>
                                        <button disabled={isSpinning} onClick={() => setColorBet('green')} className={`flex-1 py-2 rounded-lg font-bold border-2 ${colorBet === 'green' ? 'bg-green-600 border-green-400 text-white' : 'bg-green-600/30 border-green-600/50 text-green-200'}`}>{ko ? '🟢 그린 (x15)' : 'Green (x15)'}</button>
                                        <button disabled={isSpinning} onClick={() => setColorBet('black')} className={`flex-1 py-2 rounded-lg font-bold border-2 ${colorBet === 'black' ? 'bg-black border-gray-400 text-white' : 'bg-black/50 border-gray-600 text-gray-400'}`}>{ko ? '⚫ 블랙 (x2)' : 'Black (x2)'}</button>
                                    </div>
                                    <button
                                        disabled={isSpinning}
                                        onClick={handlePlayRoulette}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all"
                                    >
                                        {isSpinning ? (ko ? '회전 중...' : 'Spinning...') : (ko ? '베팅 (PLACE BET)' : 'PLACE BET')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
