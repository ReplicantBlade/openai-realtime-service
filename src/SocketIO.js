import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";

export function setupSocketIO(server, openAiService) {

    const lastAudioOffset = {};

    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket", "polling"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7,
    });

    io.on('connection', async (socket) => {

        socket.on('StreamVoiceChunk', async ({data, instruction}) => {

            openAiService.getClient(instruction).cancelResponse();

            const audioData = new Int16Array(data.buffer, data.byteOffset, data.byteLength / Int16Array.BYTES_PER_ELEMENT);
            openAiService.getClient(instruction).appendInputAudio(audioData);

        });

        socket.on('StreamVoiceEnd', async ({instruction}) => {

            openAiService.getClient(instruction).createResponse();

            openAiService.getClient(instruction).on('conversation.updated', async ({item}) => {

                const audioData = item.formatted.audio;

                if (item.role !== "assistant" || item.formatted.audio.length === 0) return;

                const offset = lastAudioOffset[item.id] ? Number.parseInt(lastAudioOffset[item.id]) : 1;

                const chunkedAudioData = audioData.slice(offset - 1, audioData.length);

                socket.emit('AIResponseAudioChunk', {
                    id: item.id,
                    order: 1,
                    audio: JSON.stringify(chunkedAudioData),
                });

                lastAudioOffset[item.id] = audioData.length;

                if (item.status === "completed")
                {
                    await socket.emitWithAck("AIResponseComplete", {
                        id: item.id,
                        role: item.role,
                        text: item.formatted.text,
                        transcript: item.formatted.transcript,
                        //audio: JSON.stringify(audioData),
                    });

                    lastAudioOffset[item.id] = undefined;

                    console.log("AIResponseComplete");
                }
            });

            console.log("StreamVoiceEnd");
        });

        socket.on('disconnect', async () => {
            console.error('A user disconnected');
        });

        console.log("new client connected");

    });

    return io;
}