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

    async sendVoiceMessage(audio, callback) {
        try {
            this.client.sendUserMessageContent([{type: 'input_audio', audio}]);

            this.client.on('conversation.item.completed', async ({item}) => {
                if (item.type === 'message') {
                    const items = this.client.conversation.getItems();
                    const modifiedItems = [];

                    for (const item of items) {
                        const fileName = `${item.id}.wav`;

                        if (fs.existsSync(path.join('/mnt/public_files/files', fileName)) || item.role !== "assistant") continue;

                        const audioFilePath = await saveAudioToFile(item.formatted.audio, fileName);
                        item.formatted["audioDownloadLink"] = `${process.env.SERVER_ADDR}/${path.basename(audioFilePath)}`;

                        modifiedItems.push(item);
                    }

                    if (modifiedItems.length === 0) return;

                    callback(modifiedItems);
                }
            });
        } catch (error) {
            console.error('Error sending voice message:', error);
        }

        async function saveAudioToFile(int16Array, fileName) {
            const filePath = path.join('/mnt/public_files/files', fileName);

            const audioBuffer = Buffer.from(int16Array.buffer);
            await fs.promises.writeFile(filePath, audioBuffer);

            return filePath;
        }
    }

}