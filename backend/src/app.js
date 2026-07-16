import express from "express";
import { createServer } from "node:http";

import { Server } from "socket.io";

import mongoose, { mongo } from "mongoose";

import cors from "cors";
import { connectToSocket } from "./controllers/socketManager.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8001));
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

const start = async () => {
    app.set("mongo_user");
    const connectionDb = await mongoose.connect("mongodb+srv://silentsyntax7_antarsetu_cluster:antarsetu2506@antarsetu-cluster.ughdtod.mongodb.net/")
    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`)
    server.listen(app.get("port"), () => {
        console.log("LISTENING ON PORT 8001")
    });
}

start();