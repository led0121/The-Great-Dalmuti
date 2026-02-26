import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../LanguageContext'

export default function ForgotModal({ socket, isOpen, onClose }) {
    const { language } = useLanguage()
    const ko = language === 'ko'

    const [tab, setTab] = useState('findId') // 'findId' or 'resetPw'
    const [displayName, setDisplayName] = useState('')
    const [username, setUsername] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [resultMsg, setResultMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [foundAccounts, setFoundAccounts] = useState([])

    if (!isOpen) return null

    const handleFindId = (e) => {
        e.preventDefault()
        setErrorMsg('')
        setResultMsg('')
        setFoundAccounts([])

        if (!displayName.trim()) return setErrorMsg(ko ? '이름을 입력해주세요' : 'Enter your Display Name')

        socket.emit('auth_find_account', { displayName: displayName.trim() }, (res) => {
            if (res.success) {
                setFoundAccounts(res.accounts)
            } else {
                setErrorMsg(res.error)
            }
        })
    }

    const handleResetPw = (e) => {
        e.preventDefault()
        setErrorMsg('')
        setResultMsg('')

        if (!username.trim() || !displayName.trim() || !newPassword.trim()) {
            return setErrorMsg(ko ? '모든 필드를 입력해주세요' : 'Fill all fields')
        }

        socket.emit('auth_reset_password', {
            username: username.trim(),
            displayName: displayName.trim(),
            newPassword: newPassword.trim()
        }, (res) => {
            if (res.success) {
                setResultMsg(ko ? '비밀번호가 성공적으로 변경되었습니다!' : 'Password successfully changed!')
                setUsername('')
                setDisplayName('')
                setNewPassword('')
            } else {
                setErrorMsg(res.error)
            }
        })
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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
                    className="bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col border border-gray-600 relative z-50 text-white overflow-hidden"
                >
                    <div className="flex bg-gray-900 border-b border-gray-700">
                        <button
                            onClick={() => { setTab('findId'); setErrorMsg(''); setResultMsg(''); }}
                            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${tab === 'findId' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
                        >
                            🔍 {ko ? '아이디 찾기' : 'Find ID'}
                        </button>
                        <button
                            onClick={() => { setTab('resetPw'); setErrorMsg(''); setResultMsg(''); }}
                            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${tab === 'resetPw' ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
                        >
                            🔑 {ko ? '비밀번호 재설정' : 'Reset PW'}
                        </button>
                    </div>

                    <div className="p-6">
                        {tab === 'findId' && (
                            <form onSubmit={handleFindId} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">{ko ? '가입된 닉네임 (이름)' : 'Display Name'}</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-900 border border-gray-600 focus:border-blue-500 focus:outline-none"
                                        placeholder={ko ? '게임 내 표시 이름' : 'Your display name'}
                                    />
                                </div>
                                <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all">
                                    {ko ? '찾기' : 'Search'}
                                </button>

                                {foundAccounts.length > 0 && (
                                    <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                                        <div className="text-xs text-blue-300 mb-2">{ko ? '검색된 계정:' : 'Found accounts:'}</div>
                                        {foundAccounts.map((acc, i) => (
                                            <div key={i} className="font-mono text-white bg-gray-800 px-3 py-1 rounded inline-block m-1">{acc.maskedUsername}</div>
                                        ))}
                                    </div>
                                )}
                            </form>
                        )}

                        {tab === 'resetPw' && (
                            <form onSubmit={handleResetPw} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">{ko ? '아이디' : 'Username'}</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-900 border border-gray-600 focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">{ko ? '가입된 닉네임 (이름)' : 'Display Name'}</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-900 border border-gray-600 focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">{ko ? '새 비밀번호' : 'New Password'}</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-900 border border-gray-600 focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <button type="submit" className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all">
                                    {ko ? '재설정' : 'Reset Password'}
                                </button>
                            </form>
                        )}

                        {errorMsg && <div className="mt-4 text-sm text-red-400 bg-red-900/20 p-2 rounded">{errorMsg}</div>}
                        {resultMsg && <div className="mt-4 text-sm text-green-400 bg-green-900/20 p-2 rounded">{resultMsg}</div>}
                    </div>

                    <button onClick={onClose} className="absolute top-3 right-4 text-gray-400 hover:text-white font-bold">&times;</button>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
