import { useState } from 'react'

export default function Lobby({ username, onCreateRoom, onJoinRoom }) {
    const [roomName, setRoomName] = useState('')
    const [roomIdToJoin, setRoomIdToJoin] = useState('')
    const [timerDuration, setTimerDuration] = useState(30)

    return (
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
            <h2 className="text-2xl font-bold mb-6 text-center text-amber-100">Welcome, {username}</h2>

            <div className="space-y-8">
                {/* Create Room Section */}
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-amber-300">Create a New Room</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                placeholder="Room Name"
                                className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-600 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                            <span>Turn Timer (sec):</span>
                            <input
                                type="number"
                                value={timerDuration}
                                onChange={(e) => setTimerDuration(Number(e.target.value))}
                                className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded"
                                min="5" max="120"
                            />
                        </div>
                        <button
                            onClick={() => { if (roomName) onCreateRoom(roomName, { timerDuration }) }}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold transition-all active:scale-95 w-full"
                        >
                            Create
                        </button>
                    </div>
                </div>

                {/* Join Room Section */}
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-blue-300">Join Existing Room</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={roomIdToJoin}
                            onChange={(e) => setRoomIdToJoin(e.target.value)}
                            placeholder="Room ID"
                            className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-600 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            onClick={() => { if (roomIdToJoin) onJoinRoom(roomIdToJoin) }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-all active:scale-95"
                        >
                            Join
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
