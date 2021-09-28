import express from "express";
import helmet from "helmet";
import logger from "morgan";
import cors from "cors";

import { initContracts } from './utils/firebase';
import userRoute from './routes/user';

require('dotenv').config({ path: __dirname + '/../.env' })
const env: string = process.argv[2];

initContracts();


const startServer = () => {
  const port = process.env.PORT || 3006;

  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Handle internal server errors
  app.use((error: Error, req: express.Request, res: express.Response, next) => {
    return res.status(500).json({ error: error.toString() });
  });

  // Show API calls in console
  app.use(logger("dev"));

  // CORS policy
  app.use(cors());

  // Add headers
  app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Pass to next layer of middleware
    next();
  });

  // Set HTTP headers for security
  app.use(helmet());

  // Configure Express to parse incoming JSON data
  app.use(express.json());

  // Routes
  app.use("/user", userRoute);

  if (env === "prod") { // For local prod
    const server = require("https").createServer(app);
    server.listen(port, () => {
      console.log(`Back-end PROD (Non-SSL) running on port ${port}`);
    });
  } else { // For local dev
    const server = require("http").createServer(app);
    server.listen(port, () => {
      console.log(`Back-end DEV (Non-SSL) running on port ${port}`);
    });
  }
};

startServer();
