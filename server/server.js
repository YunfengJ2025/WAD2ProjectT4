const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const mongoose = require("mongoose");
const fs = require("fs");
const server = express();
const userRoutes = require("./routes/userRoute")
const session = require("express-session");
// Specify the path to the environment variable file '.env'
server.use(express.urlencoded({ extended: true }));
server.use(express.json())
server.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);
//Routes
server.use("/user",userRoutes)

async function connectDB() {
  try {
    // connecting to Database with our config.env file and DB is constant in config.env
    console.log(process.env.DB);
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
connectDB().then(startServer);
// startServer()
