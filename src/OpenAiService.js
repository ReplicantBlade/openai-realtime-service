// src/services/openAiService.js
import {RealtimeClient} from '@openai/realtime-api-beta';

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
                        item.formatted["originalAudio"] = int16ArrayToBase64(item.formatted.audio);
                    }

                    callback(items);
                }
            });
        } catch (error) {
            console.error('Error sending voice message:', error);
        }

        function int16ArrayToBase64(int16Array) {
            // Convert Int16Array to Buffer
            const buffer = Buffer.from(int16Array.buffer);

            // Convert Buffer to Base64 string
            return buffer.toString('base64');
        }

    }

}