import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import Login from './components/Login'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'
import OneCardRoom from './components/OneCardRoom'
import BlackjackRoom from './components/BlackjackRoom'
import PokerRoom from './components/PokerRoom'
import ProfileModal from './components/ProfileModal'
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
  const [username, setUsername] = useState('')
  const [userInfo, setUserInfo] = useState(null) // { id, username, displayName, balance }
  const [currentRoom, setCurrentRoom] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [error, setError] = useState(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('request_online_count')
    })

    socket.on('disconnect', () => {
      setConnected(false)
      setCurrentRoom(null)
    })

    socket.on('login_success', (data) => {
      // legacy login confirm
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

    socket.on('online_count', (count) => {
      setOnlineCount(count)
    })

    socket.on('balance_update', ({ balance }) => {
      setUserInfo(prev => prev ? { ...prev, balance } : prev)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('room_update')
      socket.off('room_list')
      socket.off('game_update')
      socket.off('error')
      socket.off('online_count')
      socket.off('balance_update')
      socket.off('login_success')
    }
  }, [])

  const handleLogin = (user) => {
    // user = { id, username, displayName, balance } from auth
    setUsername(user.displayName || user.username)
    setUserInfo(user)
    socket.emit('request_room_list')
    socket.emit('request_online_count')
  }

  const [gameOptions, setGameOptions] = useState({ timerDuration: 30 })
  const [roomList, setRoomList] = useState([])

  const handleCreateRoom = (data) => {
    socket.emit('create_room', data)
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

  // Determine which game room component to show
  const getGameRoomComponent = () => {
    const gameType = currentRoom?.settings?.gameType || 'dalmuti';

    if (gameType === 'blackjack' || gameState?.gameType === 'blackjack') {
      return (
        <BlackjackRoom
          socket={socket}
          room={currentRoom}
          gameState={gameState}
          username={username}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
          onUpdateSettings={handleUpdateSettings}
        />
      )
    }

    if (gameType === 'poker' || gameState?.gameType === 'poker') {
      return (
        <PokerRoom
          socket={socket}
          room={currentRoom}
          gameState={gameState}
          username={username}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
          onUpdateSettings={handleUpdateSettings}
        />
      )
    }

    if (gameType === 'onecard' || gameState?.gameType === 'onecard') {
      return (
        <OneCardRoom
          socket={socket}
          room={currentRoom}
          gameState={gameState}
          username={username}
          onStartGame={handleStartGame}
          onLeave={handleLeaveRoom}
          onUpdateSettings={handleUpdateSettings}
        />
      )
    }

    // Default: Dalmuti
    return (
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
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center justify-center p-4 relative">
      {/* Top Bar */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 items-center">
        {username && (
          <button
            onClick={() => setShowProfile(true)}
            className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-sm font-bold transition-all flex items-center gap-1 border border-purple-500/50"
          >
            📊 {language === 'ko' ? '전적' : 'Stats'}
          </button>
        )}
        <button
          onClick={() => setLanguage('ko')}
          className={`px-3 py-1 rounded border ${language === 'ko' ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-gray-500 text-gray-400'}`}
        >
          한국어
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded border ${language === 'en' ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-500 text-gray-400'}`}
        >
          ENG
        </button>
      </div>

      {error && (
        <div className="fixed top-20 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
          {error}
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        socket={socket}
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />

      {!username ? (
        <Login onLogin={handleLogin} socket={socket} />
      ) : !currentRoom ? (
        <Lobby
          username={username}
          userInfo={userInfo}
          roomList={roomList}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onRefreshList={() => socket.emit('request_room_list')}
          socket={socket}
          onlineCount={onlineCount}
        />
      ) : (
        getGameRoomComponent()
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
