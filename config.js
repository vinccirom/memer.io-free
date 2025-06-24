module.exports = {
    host: process.env.HOST || "0.0.0.0",
    port: process.env.PORT || 3000,
    logpath: "logger.php",
    foodMass: 1,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
	virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
	},
    gameWidth: 5000,
    gameHeight: 5000,
    adminPass: "memersol99",
    gameMass: 20000,
    maxFood: 1000,
    maxVirus: 50,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 300000, // 60 seconds instead of 5
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 1,
    minMassLoss: 50,
    winnerMassThreshold: parseInt(process.env.WINNER_MASS_THRESHOLD || '3000'), // First player to reach this mass wins
    maxPlayers: parseInt(process.env.MAX_PLAYERS || '100'), // Maximum number of players allowed in the game
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
