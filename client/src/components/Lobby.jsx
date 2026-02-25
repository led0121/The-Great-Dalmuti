import { useState, useEffect } from 'react'
import PatchNotes from './PatchNotes'
import { useLanguage } from '../LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function Lobby({ username, userInfo, roomList, onCreateRoom, onJoinRoom, onRefreshList, socket, onlineCount }) {
    const [roomName, setRoomName] = useState('')
    const [roomIdToJoin, setRoomIdToJoin] = useState('')
    const [betAmount, setBetAmount] = useState(0)
    const { language } = useLanguage()
    const ko = language === 'ko'

    const balance = userInfo?.balance || 0

    const gameTypeIcons = {
        dalmuti: '👑',
        onecard: '🃏',
        blackjack: '🎰',
        poker: '♠️'
    }
    const gameTypeLabels = {
        dalmuti: ko ? '달무티' : 'Dalmuti',
        onecard: ko ? '원카드' : 'OneCard',
        blackjack: ko ? '블랙잭' : 'Blackjack',
        poker: ko ? '포커' : 'Poker'
    }
    const gameTypeColors = {
        dalmuti: 'amber',
        onecard: 'emerald',
        blackjack: 'purple',
        poker: 'blue'
    }

    const handleCreate = () => {
        if (!roomName.trim()) return
        onCreateRoom({ roomName: roomName.trim(), betAmount })
    }

    return (
        <div className="flex flex-col gap-4 w-full max-w-7xl h-[90vh] p-4">
            {/* Top Bar: User Info + Online Count */}
            <div className="flex items-center justify-between bg-gray-800/80 backdrop-blur rounded-2xl px-6 py-3 border border-gray-700/50 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                        {(userInfo?.displayName || username)?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold text-white">{userInfo?.displayName || username}</div>
                        <div className="text-xs text-gray-400">@{userInfo?.username || username}</div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Game Money */}
                    <motion.div
                        key={balance}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border border-yellow-500/30 px-4 py-2 rounded-full"
                    >
                        <span className="text-xl">🪙</span>
                        <span className="text-amber-300 font-black text-lg">{balance.toLocaleString()}</span>
                    </motion.div>

                    {/* Online Count */}
                    <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/30 px-3 py-2 rounded-full">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-green-300 text-sm font-bold">
                            {onlineCount || 0} {ko ? '명 접속중' : 'online'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-4 flex-1 min-h-0">
                {/* Left: Patch Notes */}
                <div className="w-1/4 h-full hidden lg:block">
                    <PatchNotes />
                </div>

                {/* Middle: Create Room */}
                <div className="bg-gradient-to-b from-gray-800 to-gray-800/80 p-6 rounded-2xl shadow-xl w-1/3 border border-gray-700/50 flex flex-col justify-center backdrop-blur">
                    <h2 className="text-xl font-bold mb-6 text-center text-amber-100">
                        {ko ? `환영합니다, ${userInfo?.displayName || username}님` : `Welcome, ${userInfo?.displayName || username}`}
                    </h2>

                    <div className="space-y-6">
                        {/* Create Room Section */}
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/30">
                            <h3 className="text-lg font-semibold mb-3 text-amber-300">
                                🏠 {ko ? '방 만들기' : 'Create Room'}
                            </h3>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder={ko ? '방 이름' : 'Room Name'}
                                    className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-600 focus:border-amber-500 focus:outline-none text-white placeholder-gray-600"
                                />

                                {/* Bet Amount */}
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-1 block uppercase tracking-wider">
                                        🪙 {ko ? '판돈' : 'Bet Amount'}
                                    </label>
                                    <div className="flex gap-2">
                                        {[0, 100, 500, 1000, 5000].map(amt => (
                                            <button
                                                key={amt}
                                                onClick={() => setBetAmount(amt)}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${betAmount === amt
                                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {amt === 0 ? (ko ? '무료' : 'Free') : amt.toLocaleString()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreate}
                                    disabled={!roomName.trim()}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                                >
                                    🎲 {ko ? '방 만들기' : 'Create Room'}
                                </button>
                            </div>
                        </div>

                        {/* Join Room Section */}
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/30">
                            <h3 className="text-lg font-semibold mb-3 text-blue-300">
                                🔗 {ko ? 'ID로 입장' : 'Join by ID'}
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomIdToJoin}
                                    onChange={(e) => setRoomIdToJoin(e.target.value)}
                                    placeholder={ko ? '방 ID' : 'Room ID'}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-600 focus:border-blue-500 focus:outline-none text-white placeholder-gray-600"
                                />
                                <button
                                    onClick={() => { if (roomIdToJoin) onJoinRoom(roomIdToJoin) }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95"
                                >
                                    {ko ? '입장' : 'Join'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Room List */}
                <div className="bg-gradient-to-b from-gray-800 to-gray-800/80 p-6 rounded-2xl shadow-xl border border-gray-700/50 flex-1 flex flex-col backdrop-blur">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-blue-100">
                            📋 {ko ? '대기 중인 방' : 'Active Rooms'}
                        </h2>
                        <button onClick={onRefreshList} className="text-sm text-gray-400 hover:text-white underline transition-colors">
                            🔄 {ko ? '새로고침' : 'Refresh'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
                        {roomList && roomList.length > 0 ? (
                            roomList.map(room => {
                                const color = gameTypeColors[room.gameType] || 'gray';
                                return (
                                    <motion.div
                                        key={room.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-gray-900/50 hover:bg-gray-700/50 transition-all p-4 rounded-xl border border-gray-700/30 flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-bold text-lg text-white mb-1 group-hover:text-blue-300 transition-colors">
                                                {room.name}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono">ID: {room.id}</div>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${room.status === 'LOBBY'
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-red-500/20 text-red-300'
                                                    }`}>
                                                    {room.status === 'LOBBY' ? (ko ? '대기중' : 'LOBBY') : (ko ? '게임중' : 'PLAYING')}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-${color}-500/20 text-${color}-300`}>
                                                    {gameTypeIcons[room.gameType]} {gameTypeLabels[room.gameType]}
                                                </span>
                                                <span className="text-xs text-gray-300 bg-black/30 px-2 py-0.5 rounded">
                                                    👥 {room.playerCount}{ko ? '명' : 'P'}
                                                </span>
                                                {room.betAmount > 0 && (
                                                    <span className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                        🪙 {room.betAmount.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onJoinRoom(room.id)}
                                            className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm ${room.status === 'LOBBY'
                                                ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-lg shadow-blue-500/20'
                                                : 'bg-yellow-600 hover:bg-yellow-500 text-white active:scale-95'
                                                }`}
                                        >
                                            {room.status === 'LOBBY' ? (ko ? '입장' : 'Join') : (ko ? '관전' : 'Spectate')}
                                        </button>
                                    </motion.div>
                                )
                            })
                        ) : (
                            <div className="text-center text-gray-500 mt-20">
                                <div className="text-4xl mb-3">🎲</div>
                                {ko ? '생성된 방이 없습니다. 새로운 방을 만들어보세요!' : 'No active rooms... Create one!'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
