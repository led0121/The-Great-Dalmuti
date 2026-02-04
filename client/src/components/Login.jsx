import { useState } from 'react'
import { useLanguage } from '../App'

export default function Login({ onLogin }) {
    const [name, setName] = useState('')
    const { t } = useLanguage()

    const handleSubmit = (e) => {
        e.preventDefault()
        if (name.trim()) {
            onLogin(name)
        }
    }

    return (
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
            <h1 className="text-3xl font-bold mb-6 text-center text-amber-400">{t('appTitle')}</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-300">{t('enterNameLabel')}</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:border-amber-500 focus:outline-none text-white transition-colors"
                        placeholder={t('namePlaceholder')}
                        autoFocus
                    />
                </div>
                <button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-all transform active:scale-95"
                >
                    {t('enterGameBtn')}
                </button>
            </form>
        </div>
    )
}
