import { useState } from 'react'
import PatchNotes from './PatchNotes'
import { useLanguage } from '../LanguageContext'

export default function Lobby({ username, roomList, onCreateRoom, onJoinRoom, onRefreshList }) {
    const [roomName, setRoomName] = useState('')
    const [roomIdToJoin, setRoomIdToJoin] = useState('')
    const { t } = useLanguage()

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full h-[85vh] p-2">
            {/* Left: Patch Notes */}
            <div className="w-full lg:w-[28%] xl:w-1/4 h-[30vh] lg:h-full">
                <PatchNotes />
            </div>

            {/* Middle: Actions */}
            <div className="backdrop-blur-lg bg-slate-900/60 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] border border-slate-700/50 w-full lg:w-[32%] xl:w-1/3 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full mix-blend-screen filter blur-[80px] pointer-events-none"></div>

                <h2 className="text-3xl font-extrabold mb-8 text-center text-slate-100 tracking-tight drop-shadow-sm relative z-10">
                    <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-transparent bg-clip-text">
                        {t('welcome', { name: username })}
                    </span>
                </h2>

                <div className="space-y-8 relative z-10">
                    {/* Create Room Section */}
                    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 hover:border-amber-500/30 transition-all duration-300 group">
                        <h3 className="text-lg font-bold mb-4 text-amber-400 flex items-center gap-2">
                            <span className="text-xl group-hover:rotate-12 transition-transform">✨</span> {t('createRoomTitle')}
                        </h3>
                        <div className="flex flex-col gap-3">
                            <input
                                type="text"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                placeholder={t('roomNamePlaceholder')}
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-900/80 border border-slate-600/50 focus:border-amber-400/80 focus:ring-4 focus:ring-amber-400/10 focus:outline-none text-slate-100 placeholder-slate-500 transition-all shadow-inner"
                            />
                            <button
                                onClick={() => { if (roomName.trim()) onCreateRoom(roomName.trim()) }}
                                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3.5 rounded-xl font-bold transition-all duration-300 transform active:scale-[0.98] shadow-lg hover:shadow-emerald-500/25 w-full ring-1 ring-white/10"
                            >
                                {t('createBtn')}
                            </button>
                        </div>
                    </div>

                    {/* Join Room Section */}
                    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 group">
                        <h3 className="text-lg font-bold mb-4 text-blue-400 flex items-center gap-2">
                            <span className="text-xl group-hover:scale-110 transition-transform">🔍</span> {t('joinTitle')}
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={roomIdToJoin}
                                onChange={(e) => setRoomIdToJoin(e.target.value)}
                                placeholder={t('roomIdPlaceholder')}
                                className="flex-1 px-4 py-3.5 rounded-xl bg-slate-900/80 border border-slate-600/50 focus:border-blue-400/80 focus:ring-4 focus:ring-blue-400/10 focus:outline-none text-slate-100 placeholder-slate-500 transition-all shadow-inner w-full min-w-0"
                            />
                            <button
                                onClick={() => { if (roomIdToJoin.trim()) onJoinRoom(roomIdToJoin.trim()) }}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-3.5 rounded-xl font-bold transition-all duration-300 transform active:scale-[0.98] shadow-lg hover:shadow-blue-500/25 ring-1 ring-white/10 shrink-0"
                            >
                                {t('joinBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Room List */}
            <div className="backdrop-blur-lg bg-slate-900/60 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] border border-slate-700/50 flex-1 flex flex-col relative overflow-hidden">
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full mix-blend-screen filter blur-[80px] pointer-events-none"></div>

                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50 relative z-10">
                    <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
                        <span className="text-emerald-400">🎮</span> {t('activeRoomsTitle')}
                        <span className="text-xs font-semibold bg-slate-800/80 text-slate-300 px-3 py-1 rounded-full border border-slate-600/50 shadow-inner">
                            {roomList?.length || 0}
                        </span>
                    </h2>
                    <button
                        onClick={onRefreshList}
                        className="text-sm font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 px-4 py-2 rounded-xl transition-all border border-slate-600/50 flex items-center gap-2 hover:shadow-md hover:border-slate-500/50 active:scale-95"
                    >
                        <span className="hover:rotate-180 transition-transform duration-500">🔄</span> {t('refreshBtn')}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar relative z-10">
                    {roomList && roomList.length > 0 ? (
                        roomList.map(room => (
                            <div key={room.id} className="bg-slate-800/40 hover:bg-slate-800/80 transition-all duration-300 p-5 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:-translate-y-1 hover:shadow-lg hover:border-slate-600/80">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-xl text-slate-100 mb-1 group-hover:text-emerald-400 transition-colors tracking-tight truncate">{room.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mb-3">ID: {room.id}</div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm flex items-center gap-1.5 ${room.status === 'LOBBY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${room.status === 'LOBBY' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                                            {room.status === 'LOBBY' ? t('statusLobby') : t('statusPlaying')}
                                        </span>
                                        <span className="text-sm font-medium text-slate-300 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700/50 flex items-center gap-1.5 shadow-inner">
                                            <span>👥</span> {t('players', { count: room.playerCount })}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onJoinRoom(room.id)}
                                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 transform active:scale-[0.98] shadow-md ring-1 ring-white/10 w-full sm:w-auto shrink-0 ${room.status === 'LOBBY'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/25'
                                        : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white hover:shadow-amber-500/25'
                                        }`}
                                >
                                    {room.status === 'LOBBY' ? t('joinBtn') : t('spectateBtn')}
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <span className="text-6xl opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-700">📭</span>
                            <div className="text-lg font-medium">{t('noRooms')}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
