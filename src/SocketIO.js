import * as socketIO from 'socket.io';
import fs from "fs";
import path from "path";

export function setupSocketIO(server, openAiService) {

    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket", "polling"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7
    });

    io.on('connection', async (socket) => {

        console.log("new client connected");

        socket.on('StreamVoiceChunk', async (data) => {

            const audioData = new Int16Array(data.buffer, data.byteOffset, data.byteLength / Int16Array.BYTES_PER_ELEMENT);
            openAiService.getClient().appendInputAudio(audioData);

        });

        socket.on('StreamVoiceEnd', async () => {

            console.log("StreamVoiceEnd");

            openAiService.getClient().createResponse();

        });

        openAiService.getClient().on('conversation.item.completed', async ({item}) => {

            if (item.role !== "assistant") return;

            // await socket.emitWithAck("VoiceResponse", {
            //     id: item.id,
            //     role: item.role,
            //     audio: JSON.parse(item.formatted.audio),
            //     text: item.formatted.text,
            //     transcript: item.formatted.transcript,
            // });

            const audioData = item.formatted.audio;

            const chunkSize = 256;
            let responseOrder = 1;
            for (let i = 0; i < audioData.length; i += chunkSize) {
                const chunk = audioData.slice(i, i + chunkSize);
                await socket.emitWithAck('AIResponseAudioChunk', {
                    id: item.id,
                    order: responseOrder++,
                    audio: JSON.stringify(chunk),
                });
            }

            await socket.emitWithAck("AIResponseComplete", {
                id: item.id,
                role: item.role,
                text: item.formatted.text,
                transcript: item.formatted.transcript,
            });

            console.log("AIResponseComplete");

        });

        socket.on('disconnect', async (socket) => {
            console.error('A user disconnected:', socket);
        });
    });

    async function saveAudioToFile(base64Audio, fileName) {

        //fs.existsSync(path.join('/mnt/public_files/files', fileName))
        //const audioFilePath = await saveAudioToFile(base64Audio, fileName);
        //item.formatted["audioDownloadLink"] = `${process.env.SERVER_ADDR}/${path.basename(audioFilePath)}`;

        const filePath = path.join('/mnt/public_files/files', fileName);

        const audioBuffer = Buffer.from(base64Audio, 'base64');
        await fs.promises.writeFile(filePath, audioBuffer);

        return filePath;
    }

    return io;
}