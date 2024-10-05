import * as socketIO from 'socket.io';
import path from "path";
import {promises as fs} from "fs";

export function setupSocketIO(server, openAiService) {
    const io = new socketIO.Server(server);

    io.on('connection',  async (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('VoiceMessage', async (audio) => {
            await openAiService.sendVoiceMessage(audio, async (response) => {
                await socket.emitWithAck("VoiceResponse", response);
            });
        });
    });

    return io;
}