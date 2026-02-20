import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import Login from './components/Login'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'
import { LanguageProvider, useLanguage } from './LanguageContext'

// Initialize socket with dynamic host for LAN support
const socketUrl = `http://${window.location.hostname}:3000`;
const socket = io(socketUrl, {
  autoConnect: false
})

// Content Component to use the hook
function AppContent() {
  const { language, setLanguage, t } = useLanguage();
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('') // Logged in user name
  const [currentRoom, setCurrentRoom] = useState(null) // Room data
  const [gameState, setGameState] = useState(null) // Game data
  const [error, setError] = useState(null)

  // Login Handler needs to be defined here or prop passed down?
  // Handler logic is independent of language basically, but error messages might need t()

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setCurrentRoom(null)
    })

    socket.on('login_success', (data) => {
      // confirm login
    })

    socket.on('room_update', (room) => {
      setCurrentRoom(room)
    })

    socket.on('room_list', (list) => {
      setRoomList(list)
    })

    socket.on('left_room', () => {
      setCurrentRoom(null)
      setGameState(null)
    })

    socket.on('game_update', (game) => {
      setGameState(game)
    })

    socket.on('error', (msg) => {
      setError(msg)
      setTimeout(() => setError(null), 3000)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('room_update')
      socket.off('room_list')
      socket.off('game_update')
      socket.off('error')
    }
  }, [])

  const handleLogin = (name) => {
    setUsername(name)
    socket.emit('login', name)
    // Request initial list
    socket.emit('request_room_list');
  }

  const [gameOptions, setGameOptions] = useState({ timerDuration: 30 })
  const [roomList, setRoomList] = useState([])

  const handleCreateRoom = (roomName, options) => {
    socket.emit('create_room', roomName);
    setGameOptions(options); // Store options to send when starting game
  }

  const handleJoinRoom = (roomId) => {
    socket.emit('join_room', roomId)
  }

  const handleStartGame = () => {
    socket.emit('start_game', gameOptions)
  }

  const handlePlayCards = (selectedCardIds) => {
    socket.emit('play_cards', { cards: selectedCardIds });
  }

  const handlePass = () => {
    socket.emit('pass_turn');
  }

  const handleUpdateSettings = (settings) => {
    socket.emit('update_settings', settings);
  }

  const handleLeaveRoom = () => {
    socket.emit('leave_room');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-4 relative overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background Decor - Modern Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none mix-blend-overlay"></div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-50 flex gap-2">
        <button
          onClick={() => setLanguage('ko')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${language === 'ko' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200'}`}
        >
          한국어
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${language === 'en' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200'}`}
        >
          ENG
        </button>
      </div>

      {error && (
        <div className="fixed top-20 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
          {error}
        </div>
      )}

      {!username ? (
        <div className="w-full max-w-md relative z-10">
          <Login onLogin={handleLogin} />
        </div>
      ) : !currentRoom ? (
        <div className="w-full max-w-7xl relative z-10">
          <Lobby
            username={username}
            roomList={roomList}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onRefreshList={() => socket.emit('request_room_list')}
          />
        </div>
      ) : (
        <div className="w-full relative z-10">
          <GameRoom
            socket={socket}
            room={currentRoom}
            gameState={gameState}
            username={username}
            onStartGame={handleStartGame}
            onPlay={handlePlayCards}
            onPass={handlePass}
            onUpdateSettings={handleUpdateSettings}
            onLeave={handleLeaveRoom}
          />
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}



export default App
