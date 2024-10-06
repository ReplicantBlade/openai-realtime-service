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

    getClient() {
        return this.client;
    }
}