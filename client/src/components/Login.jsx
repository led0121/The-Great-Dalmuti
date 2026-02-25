import { useState } from 'react'
import { useLanguage } from '../LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function Login({ onLogin, socket }) {
    const [mode, setMode] = useState('login') // 'login' or 'register'
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { language } = useLanguage()

    const ko = language === 'ko'

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!username.trim() || !password.trim()) return
        if (mode === 'register' && !displayName.trim()) return

        setLoading(true)
        setError('')

        if (mode === 'register') {
            socket.emit('register', {
                username: username.trim(),
                password: password.trim(),
                displayName: displayName.trim()
            }, (result) => {
                setLoading(false)
                if (result.success) {
                    onLogin(result.user)
                } else {
                    setError(result.error || (ko ? '회원가입 실패' : 'Registration failed'))
                }
            })
        } else {
            socket.emit('auth_login', {
                username: username.trim(),
                password: password.trim()
            }, (result) => {
                setLoading(false)
                if (result.success) {
                    onLogin(result.user)
                } else {
                    setError(result.error || (ko ? '로그인 실패' : 'Login failed'))
                }
            })
        }
    }

    return (
        <div className="w-full max-w-md">
            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-8"
            >
                <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-lg">
                    🎰 {ko ? '카지노 로비' : 'Casino Lobby'}
                </h1>
                <p className="text-gray-400 text-sm">
                    {ko ? '달무티 • 원카드 • 블랙잭 • 포커' : 'Dalmuti • OneCard • Blackjack • Poker'}
                </p>
            </motion.div>

            {/* Card */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden"
            >
                {/* Mode Toggle */}
                <div className="flex border-b border-gray-700">
                    <button
                        onClick={() => { setMode('login'); setError('') }}
                        className={`flex-1 py-3 font-bold text-sm transition-all ${mode === 'login'
                            ? 'bg-gray-700/50 text-amber-400 border-b-2 border-amber-400'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        🔑 {ko ? '로그인' : 'Login'}
                    </button>
                    <button
                        onClick={() => { setMode('register'); setError('') }}
                        className={`flex-1 py-3 font-bold text-sm transition-all ${mode === 'register'
                            ? 'bg-gray-700/50 text-emerald-400 border-b-2 border-emerald-400'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        ✨ {ko ? '회원가입' : 'Register'}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Username/ID */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                            {ko ? '아이디' : 'Username'}
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            maxLength={16}
                            className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none text-white transition-all placeholder-gray-600"
                            placeholder={ko ? '아이디 (2~16자)' : 'Username (2-16 chars)'}
                            autoFocus
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                            {ko ? '비밀번호' : 'Password'}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            maxLength={32}
                            className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none text-white transition-all placeholder-gray-600"
                            placeholder={ko ? '비밀번호 (4자 이상)' : 'Password (4+ chars)'}
                        />
                    </div>

                    {/* Display Name (Register only) */}
                    <AnimatePresence>
                        {mode === 'register' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">
                                    {ko ? '이름 (닉네임)' : 'Display Name'}
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    maxLength={16}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 focus:outline-none text-white transition-all placeholder-gray-600"
                                    placeholder={ko ? '게임에서 표시될 이름' : 'Name shown in game'}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg"
                            >
                                ⚠️ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !username.trim() || !password.trim() || (mode === 'register' && !displayName.trim())}
                        className={`w-full font-bold py-3 px-4 rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${mode === 'login'
                            ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-500/20'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/20'
                            }`}
                    >
                        {loading ? (ko ? '처리 중...' : 'Loading...') :
                            mode === 'login'
                                ? (ko ? '🔑 로그인' : '🔑 Login')
                                : (ko ? '✨ 회원가입' : '✨ Register')}
                    </button>
                </form>

                {/* Info */}
                <div className="px-6 pb-4">
                    <div className="text-center text-xs text-gray-600">
                        {ko
                            ? '가입 시 매일 오전 12시 10,000 게임 머니가 지급됩니다'
                            : 'New accounts receive 10,000 coins, refilled daily at midnight'}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
