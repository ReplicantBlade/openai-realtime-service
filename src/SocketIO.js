import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";
import {HttpStatusCode} from "axios";

export function setupSocketIO(server, openAiService) {

    const clients = new Map();
    const lastAudioOffsets = new Map();

    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7,
    });

    io.on('connection', async (socket) => {
        console.log("New client connected with ID:", socket.id);

        socket.on('ConnectNewInstruction', async ({instructionId}) => {
            try {

                socket.removeAllListeners('Interrupt');
                socket.removeAllListeners('StreamVoiceChunk');
                socket.removeAllListeners('StreamVoiceEnd');

                if (clients.has(socket.id)) {
                    const existingClient = clients.get(socket.id);
                    existingClient.cancelResponse();
                    existingClient.clearEventHandlers();
                    existingClient.disconnect();
                    clients.delete(socket.id);
                    console.log("Previous client disconnected successfully for socket:", socket.id);
                }

                const client = await openAiService.establishConnection(instructionId);
                if (!client) {
                    console.log("Failed to connect new client for socket:", socket.id);
                    await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.ExpectationFailed});
                    return;
                }

                clients.set(socket.id, client);
                await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.Ok});
                console.log(`Connected new client ${instructionId} for socket:`, socket.id);

                socket.on('Interrupt', () => {
                    const client = clients.get(socket.id);
                    if (client) client.cancelResponse();
                });

                socket.on('StreamVoiceChunk', ({data}) => {
                    const client = clients.get(socket.id);
                    if (client) {
                        let audioData;
                        if (data.byteOffset % 2 === 0) {
                            audioData = new Int16Array(data.buffer, data.byteOffset, data.byteLength / Int16Array.BYTES_PER_ELEMENT);
                        } else {
                            const alignedBuffer = new ArrayBuffer(data.byteLength);
                            const alignedView = new Uint8Array(alignedBuffer);
                            alignedView.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                            audioData = new Int16Array(alignedBuffer);
                        }
                        client.appendInputAudio(audioData);
                    }
                });

                socket.on('StreamVoiceEnd', () => {
                    const client = clients.get(socket.id);
                    if (client) {
                        client.createResponse();

                        client.on('conversation.updated', ({item}) => {
                            const audioData = item.formatted.audio;
                            if (item.role !== "assistant" || !audioData.length) return;

                            const offset = lastAudioOffsets.get(socket.id) || 0;
                            const chunkedAudioData = audioData.slice(offset);

                            socket.emit('AIResponseAudioChunk', {
                                id: item.id,
                                status: item.status,
                                audio: JSON.stringify(chunkedAudioData),
                                transcript: item.formatted.transcript,
                            });

                            lastAudioOffsets.set(socket.id, audioData.length);

                            if (item.status === "completed") {
                                lastAudioOffsets.delete(socket.id);
                                client.clearEventHandlers();
                                console.log("AIResponseComplete for socket:", socket.id);
                            }
                        });

                        console.log("StreamVoiceEnd for socket:", socket.id);
                    }
                });
            } catch (error) {
                console.error("Error in ConnectNewInstruction for socket:", socket.id, error);
                await socket.emitWithAck('ConnectNewInstruction', {status: HttpStatusCode.InternalServerError});
            }
        });

        socket.on('disconnect', (e) => {

            if (clients.has(socket.id)) {
                const client = clients.get(socket.id);
                client.cancelResponse();
                client.clearEventHandlers();
                client.disconnect();
                clients.delete(socket.id);
                lastAudioOffsets.delete(socket.id);
            }

            console.log(`Client disconnected for socket: ${socket.id}`, e);
        });

        await socket.timeout(1500).emitWithAck("ConnectionHasBeenReset");
    });

    return io;
}
