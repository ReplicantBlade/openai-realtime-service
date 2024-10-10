import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";
import {HttpStatusCode} from "axios";

export function setupSocketIO(server, openAiService) {

    const lastAudioOffset = new Map();

    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7,
    });

    io.on('connection', async (socket) => {

        let client = null;
        socket.on('ConnectNewInstruction', async ({instructionId}) => {
            try {

                socket.removeAllListeners('Interrupt');
                socket.removeAllListeners('StreamVoiceChunk');
                socket.removeAllListeners('StreamVoiceEnd');

                if (client !== null) {
                    client.cancelResponse();
                    client.clearEventHandlers();
                    client.disconnect();
                    client = null;
                    console.log("Prev client disconnected successfully");
                }

                client = await openAiService.establishConnection(instructionId);

                if (!client) {
                    console.log("connecting to new client failed");
                    await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.ExpectationFailed});
                    return;
                }

                await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.Ok});
                console.log("connecting to new client :" + instructionId + "OK");

                socket.on('Interrupt', () => {
                    client.cancelResponse();
                });

                socket.on('StreamVoiceChunk', ({data}) => {
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
                    client.appendInputAudio(audioData);
                });

                socket.on('StreamVoiceEnd', () => {
                    client.createResponse();

                    client.on('conversation.updated', async ({item}) => {
                        const audioData = item.formatted.audio;

                        if (item.role !== "assistant" || !audioData.length) return;

                        const offset = lastAudioOffset.get(item.id) || 0;
                        const chunkedAudioData = audioData.slice(offset);

                        socket.emit('AIResponseAudioChunk', {
                            id: item.id,
                            order: 1,
                            audio: JSON.stringify(chunkedAudioData),
                        });

                        lastAudioOffset.set(item.id, audioData.length);

                        if (item.status === "completed") {
                            await socket.emitWithAck('AIResponseComplete', {
                                id: item.id,
                                role: item.role,
                                text: item.formatted.text,
                                transcript: item.formatted.transcript,
                            });

                            lastAudioOffset.delete(item.id);
                            client.clearEventHandlers();
                            console.log("AIResponseComplete");
                        }
                    });

                    console.log("StreamVoiceEnd");
                });

            } catch (error) {
                console.error("Error in getNewInstruction:", error);
                await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.InternalServerError});
            }
        });

        socket.on('disconnect', (e) => {
            socket.removeAllListeners();
            console.log('A user disconnected', e);
        });

        console.log("new client connected");
    });

    return io;
}