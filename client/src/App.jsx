import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import Login from './components/Login'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

// Initialize socket with dynamic host for LAN support
const socketUrl = `http://${window.location.hostname}:3000`;
const socket = io(socketUrl, {
  autoConnect: false
})

function App() {
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('') // Logged in user name
  const [currentRoom, setCurrentRoom] = useState(null) // Room data
  const [gameState, setGameState] = useState(null) // Game data
  const [error, setError] = useState(null)

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
      socket.off('game_update')
      socket.off('error')
    }
  }, [])

  const handleLogin = (name) => {
    setUsername(name)
    socket.emit('login', name)
  }

  const [gameOptions, setGameOptions] = useState({ timerDuration: 30 })

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
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center justify-center p-4">
      {error && (
        <div className="fixed top-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
          {error}
        </div>
      )}

      {!username ? (
        <Login onLogin={handleLogin} />
      ) : !currentRoom ? (
        <Lobby
          username={username}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
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
  )
}

export default App
