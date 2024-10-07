import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";

export function setupSocketIO(server, openAiService) {

    const publishedIds = new Set();

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

            console.log("StreamVoiceEnd");

            openAiService.getClient(instruction).createResponse();

            openAiService.getClient(instruction).on('response.audio.delta', async (data) => {
                console.log("response.audio.delta", data);
            });

            openAiService.getClient(instruction).on('response.audio.done', async (data) => {
                console.log("response.audio.done", data);
            });

            // openAiService.getClient(instruction).on('conversation.item.completed', async ({item}) => {
            //
            //     if (item.role !== "assistant" || publishedIds.has(item.id)) return;
            //
            //     publishedIds.add(item.id);
            //
            //     const audioData = item.formatted.audio;
            //
            //     const chunkSize = 8046;
            //     let responseOrder = 1;
            //     for (let i = 0; i < audioData.length; i += chunkSize) {
            //         const chunk = audioData.slice(i, i + chunkSize);
            //         await socket.emitWithAck('AIResponseAudioChunk', {
            //             id: item.id,
            //             order: responseOrder++,
            //             audio: JSON.stringify(chunk),
            //         });
            //     }
            //
            //     await socket.emitWithAck("AIResponseComplete", {
            //         id: item.id,
            //         role: item.role,
            //         text: item.formatted.text,
            //         transcript: item.formatted.transcript,
            //     });
            //
            //     console.log("AIResponseComplete");
            //
            // });

        });

        socket.on('disconnect', async () => {
            console.error('A user disconnected');
        });

        console.log("new client connected");

    });

    return io;
}