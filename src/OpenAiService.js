// src/services/openAiService.js
import {RealtimeClient} from '@openai/realtime-api-beta';

export const clientsOptions = [
    {instructions: "a", voice: "shimmer"},
    {instructions: "b", voice: "shimmer"},
    {instructions: "c", voice: "shimmer"},
    {instructions: "d", voice: "shimmer"},
    {instructions: "e", voice: "shimmer"}
]

export class OpenAiService {

    constructor() {
        this.clients = {};
    }

    async initializeClient(apiKey) {
        try {

            for (const clientsOption of clientsOptions) {

                this.clients[clientsOption.instructions] = new RealtimeClient({apiKey});
                this.clients[clientsOption.instructions].updateSession({voice: clientsOption.voice});
                this.clients[clientsOption.instructions].updateSession({instructions: clientsOption.instructions});
                await this.clients[clientsOption.instructions].connect();

                if (this.clients[clientsOption.instructions].isConnected())
                    console.log(`Open AI ${clientsOption.instructions} connection established`);

            }

            console.log(`All AI instruction connected established`);

        } catch (error) {
            console.error('Failed to initialize OpenAI client:', error);
        }
    }

    getClient(instruction): RealtimeClient {

        if (!this.clients[instruction])
            console.error("instruction not found")

        return this.clients[instruction];

    }

}