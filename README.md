# Memer.io FREE

A free-to-play multiplayer Agar.io clone built with Socket.IO and HTML5 Canvas. Compete with other players in real-time to grow your cell and dominate the arena!

![Game Screenshot](screenshot.png)

## 🎮 Features

- **100% Free-to-Play** - No payments, no crypto, just pure gaming fun
- **Real-time Multiplayer** - Compete with up to 100 players simultaneously
- **Custom Skins** - Choose from a variety of meme-themed skins
- **Winner System** - First player to reach the mass threshold wins the round
- **Spectator Mode** - Watch games in progress
- **Live Chat** - Communicate with other players
- **Mobile Responsive** - Play on desktop or mobile devices
- **Dark/Light Theme** - Toggle between day and night modes

## 🚀 How to Play

1. **Enter Your Name** - Choose a unique nickname
2. **Select Your Skin** - Pick from available meme skins
3. **Control Your Cell** - Move your mouse to navigate
4. **Eat to Grow** - Consume food particles and smaller players
5. **Split to Attack** - Press SPACE to split your cell
6. **Eject Mass** - Press W to feed other players or escape
7. **Win the Round** - Be the first to reach 3000 mass!

## 📋 Game Rules

- Players start with invincibility until they eat their first food
- Larger players move slower than smaller ones
- You can only eat players smaller than you
- Splitting makes you vulnerable but allows for strategic plays
- Ejected mass can be reclaimed by any player

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- NPM

### Quick Start
```bash
# Clone the repository
git clone https://github.com/vinccirom/memer.io-free.git
cd memer.io-free

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

The game will be available at `http://localhost:3000`

### Development Mode
```bash
# Watch for changes and auto-reload
npm run watch
```

### Docker Setup
```bash
# Build and run with Docker
docker build -t memer-io-free .
docker run -it -p 3000:3000 memer-io-free
```

## ⚙️ Configuration

Edit `config.js` to customize game settings:

- `maxPlayers`: Maximum number of concurrent players (default: 100)
- `winnerMassThreshold`: Mass required to win (default: 3000)
- `gameWidth/gameHeight`: Arena dimensions (default: 5000x5000)
- `defaultPlayerMass`: Starting player mass (default: 10)
- `maxFood`: Maximum food particles (default: 1000)

## 🎯 Game Commands

While playing, type these commands in chat:

- `-ping` - Check your connection latency
- `-players` - Show current player count
- `-help` - Display available commands

## 🏆 Scoring System

- **Mass**: Your size determines your strength
- **Eating**: Gain mass by consuming food and other players
- **Splitting**: Temporarily reduces mass but enables strategic plays
- **Winning**: First player to reach the mass threshold wins the round

## 🔧 Technical Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5 Canvas, JavaScript, CSS3
- **Build Tools**: Gulp, Webpack, Babel
- **Database**: SQLite3
- **Real-time Communication**: WebSockets

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Credits

This is a free-to-play version of an Agar.io clone, converted from a pay-to-earn version. The game mechanics are inspired by the original Agar.io game.

## 🐛 Issues & Support

If you encounter any bugs or have feature requests, please open an issue on the GitHub repository.

---

**Have fun and may the biggest cell win!** 🏆
