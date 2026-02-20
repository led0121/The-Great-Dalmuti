import { useState } from 'react'
import { useLanguage } from '../LanguageContext'

export default function Login({ onLogin }) {
    const [name, setName] = useState('')
    const { t } = useLanguage()

    const handleSubmit = (e) => {
        e.preventDefault()
        if (name.trim()) {
            onLogin(name.trim())
        }
    }

    return (
        <div className="backdrop-blur-xl bg-slate-900/60 p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] border border-slate-700/50 w-full transform transition-all duration-500 hover:shadow-[0_8px_32px_0_rgba(245,158,11,0.1)]">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 text-transparent bg-clip-text drop-shadow-sm mb-2">
                    {t('appTitle')}
                </h1>
                <p className="text-slate-400 text-sm font-medium">왕좌를 차지하기 위한 치열한 계급 투쟁</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="group">
                    <label htmlFor="playerName" className="block text-sm font-semibold mb-2 text-slate-300 group-focus-within:text-amber-400 transition-colors">
                        {t('enterNameLabel')}
                    </label>
                    <div className="relative">
                        <input
                            id="playerName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={16}
                            className="w-full px-5 py-3 rounded-xl bg-slate-800/80 border border-slate-600/50 focus:border-amber-400/80 focus:ring-4 focus:ring-amber-400/10 focus:outline-none text-slate-100 placeholder-slate-500 transition-all shadow-inner"
                            placeholder={t('namePlaceholder')}
                            autoFocus
                            autoComplete="off"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 bg-slate-800/90 px-2 py-1 rounded-md">
                            {name.length}/16
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all duration-300 transform active:scale-[0.98] ring-1 ring-white/10"
                >
                    {t('enterGameBtn')}
                </button>
            </form>
        </div>
    )
}
