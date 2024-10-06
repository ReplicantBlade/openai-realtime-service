import * as socketIO from 'socket.io';

export function setupSocketIO(server, openAiService) {
    const io = new socketIO.Server(server, {
        allowUpgrades: true,
        transports: ["websocket", "polling"],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e7
    });

    io.on('connection',  async (socket) => {
        socket.on('VoiceMessage', async (audio) => {
            await openAiService.sendVoiceMessage(audio, async (response) => {
                console.log("Sending response")
                await socket.emitWithAck("VoiceResponse", response);
            });
        });

        socket.on('disconnect', async (socket) =>{
            console.error('A user disconneced:', socket);
        });
    });

    return io;
}