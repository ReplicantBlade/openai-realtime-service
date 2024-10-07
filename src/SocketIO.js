import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";

export function setupSocketIO(server, openAiService) {

    const lastAudioOffset = {};

    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7,
    });

    io.on('connection', async (socket) => {

        socket.on('Interrupt', ({data, instructionId}) => openAiService.getClient(instructionId).cancelResponse());

        socket.on('StreamVoiceChunk', async ({data, instructionId}) => {

            let audioData;
            if (data.byteOffset % 2 === 0) {
                // The offset is aligned, create the Int16Array directly
                audioData = new Int16Array(data.buffer, data.byteOffset, data.byteLength / Int16Array.BYTES_PER_ELEMENT);
            } else {
                // Offset is not aligned, copy data into a new ArrayBuffer
                const alignedBuffer = new ArrayBuffer(data.byteLength);
                const alignedView = new Uint8Array(alignedBuffer);
                alignedView.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                audioData = new Int16Array(alignedBuffer);
            }

            openAiService.getClient(instructionId).appendInputAudio(audioData);

        });

        socket.on('StreamVoiceEnd', async ({instructionId}) => {

            openAiService.getClient(instructionId).createResponse();

            openAiService.getClient(instructionId).on('conversation.updated', async ({item}) => {

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

        socket.on('disconnect', async (e) => {
            console.error('A user disconnected', e);
        });

        console.log("new client connected");

    });

    return io;
}