import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '../App'

export default function Chat({ socket, username, room }) {
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef(null)
    const { t } = useLanguage()

    useEffect(() => {
        socket.on('chat_message', (msg) => {
            setMessages(prev => [...prev, msg])
        })
        return () => {
            socket.off('chat_message')
        }
    }, [socket])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = (e) => {
        e.preventDefault()
        if (inputValue.trim()) {
            socket.emit('chat_message', inputValue)
            setInputValue('')
        }
    }

    return (
        <motion.div
            drag
            dragMomentum={false}
            dragElastic={0.1}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 w-64 h-80 bg-gray-800/90 border border-gray-600 rounded-lg flex flex-col shadow-xl z-50 overflow-hidden"
        >
            {/* Header - Drag Handle */}
            <div className="p-2 border-b border-gray-600 bg-gray-900/50 rounded-t-lg cursor-move active:cursor-grabbing">
                <h3 className="text-sm font-bold text-gray-300 pointer-events-none">{t('chatTitle')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 text-sm">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === username ? 'items-end' : 'items-start'}`}>
                        <div className={`px-2 py-1 rounded max-w-[80%] break-words ${msg.sender === username ? 'bg-blue-600' : 'bg-gray-600'
                            }`}>
                            {msg.sender !== username && <span className="text-xs text-blue-200 font-bold block">{msg.sender}</span>}
                            <span>{msg.text}</span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-2 border-t border-gray-600 flex gap-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={t('chatPlaceholder')}
                    className="flex-1 bg-gray-900 text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none focus:border-blue-500"
                />
                <button type="submit" className="text-blue-400 hover:text-blue-300 font-bold text-xs">{t('sendBtn')}</button>
            </form>
        </motion.div>
    )
}
