import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

export default function RulesModal({ isOpen, onClose, currentPhase }) {
    const [activeTab, setActiveTab] = useState('general')

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
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gray-800 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-600 relative z-50 text-white"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
                        <h2 className="text-2xl font-bold text-amber-400">📜 Game Rules</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-900/50 p-1 gap-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'general' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                        >
                            General Rules
                        </button>
                        <button
                            onClick={() => setActiveTab('phases')}
                            className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'phases' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                        >
                            Game Phases
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-6 text-sm">
                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">1. Card Ranks</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>**Dalmuti (1)** is the best. **Peon (12)** is the worst.</li>
                                        <li>**Jokers (13)** are Wildcards (can be any rank).</li>
                                        <li>You want to get rid of cards. Lower rank number = Better card.</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">2. How to Play Cards</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>**Rank Rule**: You must play a rank **LOWER (Better)** than the current cards on the table.</li>
                                        <li>**Quantity Rule**: You must play **SAME or MORE** number of cards than the previous player.</li>
                                        <li>(e.g., If Table has `2x Rank 10`, you can play `2x Rank 9` or `3x Rank 9`).</li>
                                        <li>**Pass**: If you can't or don't want to play, you rank Pass.</li>
                                        <li>If everyone passes, the last player to play wins the trick and leads the next one.</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">3. Special Events</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>**Revolution**: As a tax or during play, if a player has **2 Jokers**, a Revolution occurs!</li>
                                        <li>Effect: Ranks might swap, or Taxation is cancelled.</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'phases' && (
                            <div className="space-y-6 text-sm">
                                <section className={`p-3 rounded border ${currentPhase === 'TAXATION' ? 'bg-green-900/30 border-green-500' : 'border-gray-700'}`}>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">🏛️ Taxation (Round Start)</h3>
                                    <p className="text-gray-300 mb-2">After the first round, players have ranks.</p>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>**Great Peon (Last)** Must give their **2 Best Cards** to the Great Dalmuti.</li>
                                        <li>**Great Dalmuti (1st)** must give **Any 2 Cards** back to the Peon.</li>
                                        <li>This makes the rich richer and poor poorer!</li>
                                    </ul>
                                </section>

                                <section className={`p-3 rounded border ${currentPhase === 'MARKET' ? 'bg-blue-900/30 border-blue-500' : 'border-gray-700'}`}>
                                    <h3 className="text-lg font-bold text-blue-400 mb-2">⚖️ Market Phase</h3>
                                    <p className="text-gray-300 mb-2">A chance for everyone to improve their hand.</p>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>Select **1 Card** to trade.</li>
                                        <li>The server will swap it with a random card from another player.</li>
                                        <li>You can trade multiple times until time runs out.</li>
                                    </ul>
                                </section>

                                <section className={`p-3 rounded border ${currentPhase === 'PLAYING' ? 'bg-yellow-900/30 border-yellow-500' : 'border-gray-700'}`}>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">⚔️ Playing Phase</h3>
                                    <p className="text-gray-300">The main game. Play cards, pass turns, and try to empty your hand first!</p>
                                </section>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-700 bg-gray-900 text-center text-xs text-gray-500">
                        Tip: Press '?' or click the Help button anytime.
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
