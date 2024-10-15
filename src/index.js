// src/index.js
import express from "express";
import http from "http";
import dotenv from "dotenv";
import figlet from "figlet";
import {OpenAiService} from "./OpenAiService.js";
import {setupSocketIO} from "./SocketIO.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.APP_PORT;

console.log(figlet.textSync('MCI GY'));

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome');
});

const openAiService = new OpenAiService();
setupSocketIO(server, openAiService);

server.listen(PORT, async () => {
    await openAiService.initializeClient(process.env.OPENAI_API_KEY);
    console.log(`Server is running on http://localhost:${PORT}`);
});
