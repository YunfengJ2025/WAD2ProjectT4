const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const mongoose = require("mongoose");
const fs = require("fs");
const server = express();
const userRoutes = require("./routes/userRoute");
const plantRoutes = require("./routes/plantRoute");
const cors = require("cors");
const boardRoutes = require("./routes/boardRoute");
const tokenRoutes = require("./routes/tokenRoute");
const reviewRoutes = require("./routes/reviewRoute");
const careRequestRoutes = require("./routes/careRequestRoute");
const careVisitRoutes = require("./routes/careVisitRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
// Start visit deadlines only after the database connection is ready.
const { startVisitSweeper } = require("./services/visitSweeper");
const postRoutes = require("./routes/postRoute");
const nearbyRoutes = require("./routes/nearbyRequests");
const { validateJwtConfig } = require("./config/jwt");
validateJwtConfig();
// Specify the path to the environment variable file '.env'
server.use(cors());
server.use(express.urlencoded({ extended: true }));
server.use(express.json());
// server.use(
//   session({
//     secret: process.env.SECRET || "wad2_secret_key",
//     resave: false,
//     saveUninitialized: false,
//   }),
// );
//Routes
server.use("/user", userRoutes);
server.use("/plants", plantRoutes);
server.use("/token", tokenRoutes);
server.use("/review", reviewRoutes);
server.use("/api", boardRoutes);
server.use("/post", postRoutes);
server.use("/care-requests", careRequestRoutes);
server.use("/care-visits", careVisitRoutes);
server.use("/find-nearby", nearbyRoutes);
// Expose the authenticated in-app notice endpoints.
server.use("/notifications", notificationRoutes);

async function connectDB() {
  try {
    // connecting to Database with our config.env file and DB is constant in config.env
    await mongoose.connect(process.env.DB);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

function startServer() {
  const hostname = "localhost"; // Define server hostname
  const port = 8000; // Define port number

  // Start the server and listen on the specified hostname and port
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

// call connectDB first and when connection is ready we start the web server
connectDB().then(() => {
  startServer();
  // Check for missed and unclaimed visits at startup, then every 15 minutes.
  startVisitSweeper();
});
// startServer()
