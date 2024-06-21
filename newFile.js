const { io } = require('./server');

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join', ({ name }) => {
        socket.join(name);
        console.log(`${name} joined the chat`);
    });

    socket.on('message', ({ message, sender }) => {
        io.emit('message', { message, sender });
        console.log('message: ' + message);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
