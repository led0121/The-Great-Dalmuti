import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useLanguage } from '../LanguageContext'

export default function RulesModal({ isOpen, onClose }) {
    const { language } = useLanguage()
    const ko = language === 'ko'
    const [activeTab, setActiveTab] = useState('dalmuti')

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
                    className="bg-gray-800 w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col border border-gray-600 relative z-50 text-white"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 rounded-t-xl">
                        <h2 className="text-2xl font-black text-amber-400">
                            {ko ? '📜 보드게임 라운지 규칙 및 용어' : '📜 Board Game Rules & Terms'}
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-gray-900/50 p-2 gap-2 overflow-x-auto">
                        {[
                            { id: 'dalmuti', label: ko ? '👑 달무티' : '👑 Dalmuti', color: 'bg-yellow-600' },
                            { id: 'onecard', label: ko ? '🃏 원카드' : '🃏 OneCard', color: 'bg-blue-600' },
                            { id: 'blackjack', label: ko ? '🎰 블랙잭' : '🎰 Blackjack', color: 'bg-green-600' },
                            { id: 'poker', label: ko ? '♠️ 포커' : '♠️ Poker', color: 'bg-purple-600' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`flex-1 py-2 px-4 whitespace-nowrap text-sm font-bold rounded-lg transition-colors ${activeTab === t.id ? `${t.color} text-white` : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {activeTab === 'dalmuti' && (
                            <div className="space-y-6 text-sm">
                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">1. {ko ? '승리 조건 & 카드' : 'Goal & Cards'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>{ko ? '손에 있는 카드를 가장 먼저 다 터는 사람이 승리합니다.' : 'The first person to empty their hand wins.'}</li>
                                        <li>{ko ? '카드 숫자가 낮을수록 좋습니다. (1이 최고, 12가 최하)' : 'Lower rank numbers are better. (1 is best, 12 is worst).'}</li>
                                        <li>{ko ? '조커(13)는 원하는 아무 숫자로 쓸 수 있는 만능 카드입니다.' : 'Jokers (13) are wildcards.'}</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">2. {ko ? '카드 내는 법 (용어)' : 'How to Play (Terms)'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                                        <li><span className="text-amber-200 font-bold">카드 내기 (Play)</span>: {ko ? '이전 사람이 낸 카드보다 더 좋은(숫자가 낮은) 카드를 똑같은 장수 이상 내야 합니다.' : 'You must play LOWER (better) rank, and SAME or MORE quantity of cards.'}</li>
                                        <li><span className="text-amber-200 font-bold">건너뛰기 (Pass)</span>: {ko ? '낼 카드가 없거나 내기 싫으면 턴을 넘깁니다.' : 'Skip your turn.'}</li>
                                        <li>{ko ? '모두가 패스하면, 마지막으로 카드를 낸 사람이 다음 턴을 시작합니다.' : 'If everyone passes, the last player starts the new trick.'}</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">3. {ko ? '세금과 혁명 (특수 룰)' : 'Taxation & Revolution'}</h3>
                                    <ul className="list-disc list-inside space-y-2 text-gray-300 ml-2">
                                        <li><span className="text-green-200 font-bold">{ko ? '세금 (Taxation)' : 'Taxation'}</span>: {ko ? '매 판 시작 시 계급이 제일 낮은 농노(Peon)는 자신의 가장 좋은 카드 2장을 달무티(1등)에게 바칩니다. 달무티는 아무 카드나 2장 골라서 돌려줍니다.' : 'The lowest rank must give their 2 best cards to the highest rank. The highest rank gives back any 2 cards.'}</li>
                                        <li><span className="text-red-300 font-bold">{ko ? '혁명 (Revolution)' : 'Revolution'}</span>: {ko ? '게임 시작 전 조커 2장을 가진 사람이 원하면 선언 가능! 계급이 완전히 뒤바뀌며 세금을 면제받습니다.' : 'A player with 2 Jokers can declare Revolution. Ranks reverse and taxes cancel!'}</li>
                                        <li><span className="text-blue-300 font-bold">{ko ? '시장 (Market)' : 'Market'}</span>: {ko ? '원하는 카드 1장을 다른 사람과 무작위로 교환할 수 있는 기회입니다.' : 'A chance to randomly trade 1 card with another player.'}</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'onecard' && (
                            <div className="space-y-6 text-sm">
                                <section>
                                    <h3 className="text-lg font-bold text-blue-400 mb-2">1. {ko ? '승리 조건' : 'Goal'}</h3>
                                    <p className="text-gray-300 mb-2">{ko ? '손에 있는 카드를 가장 먼저 다 터는 사람이 승리합니다.' : 'The first person to empty their hand wins.'}</p>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-blue-400 mb-2">2. {ko ? '플레이 방식' : 'How to Play'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>{ko ? '바닥에 깔린 카드의 무늬(♠️♦️♥️♣️)나 숫자가 같아야 낼 수 있습니다.' : 'Match the suit or the rank of the top card.'}</li>
                                        <li>{ko ? '낼 카드가 없으면 카드를 1장 뽑아야 합니다.' : 'If you cannot play, you must draw a card.'}</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-red-400 mb-2">3. {ko ? '특수 카드 (공격/방어)' : 'Special Cards'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                                        <li><span className="text-red-300 font-bold">2, A, 조커</span>: {ko ? '다음 사람에게 카드를 먹이는 공격 기능! (조커가 제일 쎕니다)' : 'Attack! The next player draws cards.'}</li>
                                        <li><span className="text-yellow-300 font-bold">3</span>: {ko ? '방어 용도 (2 공격 막기 등)' : 'Defend against attacks.'}</li>
                                        <li><span className="text-green-300 font-bold">J (점프)</span>: {ko ? '다음 사람의 턴을 건너뜁니다.' : 'Skip the next player.'}</li>
                                        <li><span className="text-green-300 font-bold">Q (리버스)</span>: {ko ? '진행 방향을 반대로 바꿉니다.' : 'Reverse the turn order.'}</li>
                                        <li><span className="text-purple-300 font-bold">K (한장 더)</span>: {ko ? '카드를 하나 더 낼 수 있습니다.' : 'Play one more card.'}</li>
                                        <li><span className="text-pink-300 font-bold">7 (무늬 변경)</span>: {ko ? '내가 원하는 무늬로 판을 바꿀 수 있습니다.' : 'Change the current suit.'}</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'blackjack' && (
                            <div className="space-y-6 text-sm">
                                <section>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">1. {ko ? '카드 점수 (21 만들기)' : 'Goal & Points'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li>{ko ? '기본 목표는 카드 합이 21을 넘지 않으면서 딜러보다 큰 점수를 만드는 것입니다.' : 'Get closer to 21 than the dealer without going over.'}</li>
                                        <li>{ko ? 'J, Q, K는 10점으로 계산합니다.' : 'J, Q, K are worth 10 points.'}</li>
                                        <li>{ko ? 'A(에이스)는 상황에 따라 1점 또는 11점으로 유리하게 자동 계산됩니다.' : 'Ace is 1 or 11.'}</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-green-400 mb-2">2. {ko ? '주요 액션 용어' : 'Action Terms'}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-gray-700/50 p-3 rounded">
                                            <div className="text-amber-300 font-bold mb-1">🃏 {ko ? '히트 (HIT)' : 'Hit'}</div>
                                            <p className="text-gray-300">{ko ? '카드를 1장 더 받습니다. (21을 넘지 않도록 조심!)' : 'Draw exactly 1 more card.'}</p>
                                        </div>
                                        <div className="bg-gray-700/50 p-3 rounded">
                                            <div className="text-amber-300 font-bold mb-1">✋ {ko ? '스탠드 (STAND)' : 'Stand'}</div>
                                            <p className="text-gray-300">{ko ? '더 이상 카드를 받지 않고 턴을 마칩니다.' : 'Stop drawing cards and end your turn.'}</p>
                                        </div>
                                        <div className="bg-gray-700/50 p-3 rounded">
                                            <div className="text-amber-300 font-bold mb-1">💰 {ko ? '더블다운 (DOUBLE DOWN)' : 'Double Down'}</div>
                                            <p className="text-gray-300">{ko ? '사용 포인트를 2배로 올리고 딱 1장만 더 받습니다. (첫 2장일때만 가능)' : 'Double your entry point and receive exactly 1 more card.'}</p>
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-yellow-400 mb-2">3. {ko ? '규칙 용어' : 'Rule Terms'}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                                        <li><span className="text-red-400 font-bold">버스트 (Bust)</span>: {ko ? '카드 합이 21을 넘김. 무조건 패배' : 'Over 21. Automatic loss.'}</li>
                                        <li><span className="text-yellow-400 font-bold">블랙잭 (Blackjack)</span>: {ko ? '처음 두 장이 A(11) + 10점 카드로 정확히 21. 보너스 획득!' : 'First two cards equal 21 (Ace + 10). Pays 1.5x.'}</li>
                                        <li><span className="text-gray-400 font-bold">푸시 (Push)</span>: {ko ? '딜러와 점수가 같음. 무승부로 포인트 반환' : 'Tie with dealer. Points returned.'}</li>
                                        <li>{ko ? '참고: 딜러는 16점 이하면 무조건 히트, 17점 이상이면 무조건 스탠드합니다.' : 'Note: Dealer must Hit on 16 or below, Stand on 17 or above.'}</li>
                                    </ul>
                                </section>
                            </div>
                        )}

                        {activeTab === 'poker' && (
                            <div className="space-y-6 text-sm">
                                <section>
                                    <h3 className="text-lg font-bold text-purple-400 mb-2">1. {ko ? '기본 규칙 (텍사스 홀덤)' : 'Texas Holdem Basics'}</h3>
                                    <p className="text-gray-300 mb-2">{ko ? '각자 받는 개인 카드 2장과 바닥의 공용 카드 5장을 조합하여, 최고의 5장 족보를 만드는 게임입니다.' : 'Combine your 2 hole cards with 5 community cards to make the best 5-card hand.'}</p>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-purple-400 mb-2">2. {ko ? '포커 액션 용어' : 'Poker Action Terms'}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-gray-700/50 p-2 rounded">
                                            <span className="text-red-400 font-bold">❌ {ko ? '폴드 (Fold)' : 'Fold'}</span> {ko ? '이번 판을 포기합니다.' : 'Give up this round.'}
                                        </div>
                                        <div className="bg-gray-700/50 p-2 rounded">
                                            <span className="text-green-400 font-bold">✅ {ko ? '체크 (Check)' : 'Check'}</span> {ko ? '추가 포인트 소모 없이 턴을 넘깁니다. (아무도 금액을 올리지 않았을 때만 가능)' : 'Pass without adding points (if no one raised).'}
                                        </div>
                                        <div className="bg-gray-700/50 p-2 rounded">
                                            <span className="text-blue-400 font-bold">💵 {ko ? '콜 (Call)' : 'Call'}</span> {ko ? '앞 사람이 낸 금액과 똑같이 맞춥니다.' : 'Match the current highest points.'}
                                        </div>
                                        <div className="bg-gray-700/50 p-2 rounded">
                                            <span className="text-yellow-400 font-bold">📈 {ko ? '레이즈 (Raise)' : 'Raise'}</span> {ko ? '포인트를 더 많이 걸어 판을 키웁니다.' : 'Increase the current highest points.'}
                                        </div>
                                        <div className="bg-gray-700/50 p-2 rounded md:col-span-2">
                                            <span className="text-red-500 font-bold">💥 {ko ? '올인 (All-In)' : 'All In'}</span> {ko ? '가진 모든 포인트를 한 번에 다 겁니다.' : 'Put all your remaining points into the pot.'}
                                        </div>
                                    </div>
                                </section>
                                <section>
                                    <h3 className="text-lg font-bold text-purple-400 mb-2">3. {ko ? '족보 순위 (높은 순)' : 'Hand Rankings (High to Low)'}</h3>
                                    <ul className="grid grid-cols-2 gap-2 text-gray-300">
                                        <li>1. 로얄 스트레이트 플러시</li>
                                        <li>2. 스트레이트 플러시</li>
                                        <li>3. 포카드 (Four of a Kind)</li>
                                        <li>4. 풀하우스 (Full House)</li>
                                        <li>5. 플러시 (Flush)</li>
                                        <li>6. 스트레이트 (Straight)</li>
                                        <li>7. 트리플 (Three of a Kind)</li>
                                        <li>8. 투페어 (Two Pair)</li>
                                        <li>9. 원페어 (One Pair)</li>
                                        <li>10. 하이카드 (High Card)</li>
                                    </ul>
                                </section>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
