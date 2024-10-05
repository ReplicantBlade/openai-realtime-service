import * as socketIO from 'socket.io';

export function setupSocketIO(server, openAiService) {
    const io = new socketIO.Server(server);

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('VoiceMessage', async (audio) => {
            await openAiService.sendVoiceMessage(audio, async (response) => {
                await socket.emitWithAck("VoiceResponse")
            });
        });
    });

    return io;
}