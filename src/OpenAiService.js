// src/services/openAiService.js
import {RealtimeClient} from '@openai/realtime-api-beta';
import fs from "fs";
import path from "path";

export class OpenAiService {
    constructor(apiKey) {
        this.client = new RealtimeClient({apiKey});
    }

    async initializeClient() {
        try {
            this.client.updateSession({voice: 'echo'});

            await this.client.connect();

            if (this.client.isConnected())
                console.log("Open AI connection established")

        } catch (error) {
            console.error('Failed to initialize OpenAI client:', error);
        }
    }

    ids = new Set();

    async sendVoiceMessage(audio, callback) {
        try {
            this.client.sendUserMessageContent([{type: 'input_audio', audio}]);

            this.client.on('conversation.item.completed', async ({item}) => {
                if (item.type === 'message') {
                    const items = this.client.conversation.getItems();
                    const modifiedItems = [];

                    for (const item of items) {
                        const fileName = `${item.id}.wav`;

                        if (this.ids.has(fileName) || item.role !== "assistant") continue;

                        const base64Audio = int16ArrayToBase64(item.formatted.audio);

                        // fs.existsSync(path.join('/mnt/public_files/files', fileName))
                        //const audioFilePath = await saveAudioToFile(base64Audio, fileName);
                        //item.formatted["audioDownloadLink"] = `${process.env.SERVER_ADDR}/${path.basename(audioFilePath)}`;
                        this.ids.add(fileName);
                        item.formatted["audioBase64"] = base64Audio;

                        modifiedItems.push(item);
                    }

                    if (modifiedItems.length === 0) return;

                    callback(modifiedItems);
                }
            });
        } catch (error) {
            console.error('Error sending voice message:', error);
        }

        function int16ArrayToBase64(int16Array) {
            const buffer = Buffer.from(int16Array.buffer);
            return buffer.toString('base64');
        }

        async function saveAudioToFile(base64Audio, fileName) {
            const filePath = path.join('/mnt/public_files/files', fileName); // Change the directory

            const audioBuffer = Buffer.from(base64Audio, 'base64');
            await fs.promises.writeFile(filePath, audioBuffer);

            return filePath;
        }
    }

}