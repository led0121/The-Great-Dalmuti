import { useState, useEffect, createContext, useContext } from 'react'
import io from 'socket.io-client'
import Login from './components/Login'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'
import { translations } from './translations'

// Initialize socket with dynamic host for LAN support
const socketUrl = `http://${window.location.hostname}:3000`;
const socket = io(socketUrl, {
  autoConnect: false
})

// Language Context
const LanguageContext = createContext()

export const useLanguage = () => useContext(LanguageContext)

function App() {
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('') // Logged in user name
  const [currentRoom, setCurrentRoom] = useState(null) // Room data
  const [gameState, setGameState] = useState(null) // Game data
  const [error, setError] = useState(null)

  // Language State (Default Korean as per user request "All languages to Korean")
  const [language, setLanguage] = useState('ko')

  // Translation Helper
  const t = (key, params = {}) => {
    let text = translations[language][key] || key
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param])
    })
    return text
  }

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

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center justify-center p-4 relative">
        {/* Language Toggle */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
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

        {!username ? (
          <Login onLogin={handleLogin} />
        ) : !currentRoom ? (
          <Lobby
            username={username}
            roomList={roomList}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onRefreshList={() => socket.emit('request_room_list')}
          />
        ) : (
          <GameRoom
            socket={socket}
            room={currentRoom}
            gameState={gameState}
            username={username}
            onStartGame={handleStartGame}
            onPlay={handlePlayCards}
            onPass={handlePass}
          />
        )}
      </div>
    </LanguageContext.Provider>
  )
}

export default App
