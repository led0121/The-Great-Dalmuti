import { useState } from 'react'
import PatchNotes from './PatchNotes'
import { useLanguage } from '../App'

export default function Lobby({ username, roomList, onCreateRoom, onJoinRoom, onRefreshList }) {
    const [roomName, setRoomName] = useState('')
    const [roomIdToJoin, setRoomIdToJoin] = useState('')
    const { t } = useLanguage()

    return (
        <div className="flex gap-4 items-stretch w-full max-w-7xl h-[80vh] p-4">
            {/* Left: Patch Notes (New Area) */}
            <div className="w-1/4 h-full">
                <PatchNotes />
            </div>

            {/* Middle: Actions */}
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-1/3 border border-gray-700 flex flex-col justify-center">
                <h2 className="text-2xl font-bold mb-6 text-center text-amber-100">{t('welcome', { name: username })}</h2>

                <div className="space-y-8">
                    {/* Create Room Section */}
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-3 text-amber-300">{t('createRoomTitle')}</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder={t('roomNamePlaceholder')}
                                    className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-600 focus:border-amber-500 focus:outline-none text-white"
                                />
                            </div>
                            <button
                                onClick={() => { if (roomName) onCreateRoom(roomName) }}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold transition-all active:scale-95 w-full"
                            >
                                {t('createBtn')}
                            </button>
                        </div>
                    </div>

                    {/* Join Room Section */}
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-3 text-blue-300">{t('joinTitle')}</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={roomIdToJoin}
                                onChange={(e) => setRoomIdToJoin(e.target.value)}
                                placeholder={t('roomIdPlaceholder')}
                                className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-600 focus:border-blue-500 focus:outline-none text-white"
                            />
                            <button
                                onClick={() => { if (roomIdToJoin) onJoinRoom(roomIdToJoin) }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-all active:scale-95"
                            >
                                {t('joinBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Room List */}
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-blue-100">{t('activeRoomsTitle')}</h2>
                    <button onClick={onRefreshList} className="text-sm text-gray-400 hover:text-white underline">{t('refreshBtn')}</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {roomList && roomList.length > 0 ? (
                        roomList.map(room => (
                            <div key={room.id} className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg border border-gray-600 flex justify-between items-center group">
                                <div>
                                    <div className="font-bold text-lg text-white mb-1 group-hover:text-blue-300 transition-colors">{room.name}</div>
                                    <div className="text-xs text-gray-400 font-mono">ID: {room.id}</div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${room.status === 'LOBBY' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                            }`}>
                                            {room.status === 'LOBBY' ? t('statusLobby') : t('statusPlaying')}
                                        </span>
                                        <span className="text-xs text-gray-300 bg-black/30 px-2 py-0.5 rounded">{t('players', { count: room.playerCount })}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onJoinRoom(room.id)}
                                    // Allow joining even if playing (Spectator)
                                    className={`px-4 py-2 rounded font-bold transition-all ${room.status === 'LOBBY'
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                                        : 'bg-yellow-600 hover:bg-yellow-500 text-white active:scale-95' // Spectator join color
                                        }`}
                                >
                                    {room.status === 'LOBBY' ? t('joinBtn') : t('spectateBtn')}
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-500 mt-10">{t('noRooms')}</div>
                    )}
                </div>
            </div>
        </div>
    )
}
