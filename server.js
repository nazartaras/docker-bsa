
const path = require('path');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const jwt = require('jsonwebtoken');
const passport = require('passport');
const bodyParser = require('body-parser');
const users = require('./users.json');
const maps = require('./maps.json');
const commentator = require('./commentator')
require("./passport.config.js");
app.use(express.static(path.join(__dirname, "public")));
app.use(passport.initialize());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

server.listen(3000);
let status = 0;
let playersCount = 0;
let playersInfo = [];
let waiters = 0;
let mapId = getRandomInt(3);
let breakBetweenRaces = 10;
let timeStart;
let timeEnd;
let commentFactory = new commentator;

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get('/game', function (req, res) {
    res.sendFile(path.join(__dirname, "game.html"));
});
app.post('/login', function (req, res) {
    const userFromReq = req.body;
    const userInDB = users.find(user => user.login === userFromReq.login);
    if (userInDB && userInDB.password === userFromReq.password) {
        const token = jwt.sign(userFromReq, "someSecret");
        res.status(200).json({ auth: true, token });
    } else {
        res.status(401).json({ auth: false })
    }
});
app.post('/game', passport.authenticate('jwt', { session: false }), function (req, res) {
    const text = maps.find(map => map.id === mapId);
    res.json({ currMap: text, textId: mapId });
});


io.on('connection', function (socket) {
    if (status === 0) {
        status = 1;
        const currTime = new Date;
        const textTime = maps.find(map => map.id === mapId);
        timeEnd = Date.parse(currTime) + (textTime.time * 1000);
        socket.join('race');
        socket.emit('start');
        socket.emit('commentator-change', { comment: commentFactory.createComment('present') });
    } else if (status == 1) {
        socket.join('waiting');
        const currTime = new Date;
        let timerTime = timeEnd - Date.parse(currTime);
        socket.emit('wait');
        socket.emit('start-timer', { time: Math.ceil(timerTime / 1000), status: 3 })
        waiters += 1;
    } else if (status == 2) {
        socket.join('race');
        const currTime = new Date;
        let timerTime = breakBetweenRaces * 1000 - (Date.parse(currTime) - timeEnd);
        socket.emit('start-timer', { time: Math.ceil(timerTime / 1000), status: 3 })
    }
    socket.on('present-racers', payload => {
        socket.emit('commentator-change', {comment: commentFactory.createComment('present-racers', playersInfo)});
    });
    socket.on('player-finished', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            playersCount -= 1;
            socket.broadcast.to('race').emit('someone-finished-race', { token: payload.token });
            socket.emit('commentator-change', {comment: commentFactory.createComment('announce-someone-finished', jwt.decode(payload.token).login)});
            socket.broadcast.to('race').emit('commentator-change', {comment: commentFactory.createComment('announce-someone-finished', jwt.decode(payload.token).login)});
            if (playersCount == 0) {
                socket.broadcast.to('race').emit('commentator-change', {comment: commentFactory.createComment('announce-results', playersInfo)});
                socket.emit('commentator-change', {comment: commentFactory.createComment('announce-results', playersInfo)});
                playersInfo = [];
                socket.emit('clear-interval');
                socket.broadcast.to('race').emit('clear-interval');
                socket.broadcast.to('race').emit('race-finished');
                socket.emit('race-finished');
                mapId = getRandomInt(3);
                staus = 2;
                timeEnd = Date.parse(new Date);
                socket.broadcast.to('waiting').emit('transfer');
                socket.emit('start-timer', { time: breakBetweenRaces, status: 2 });
                socket.broadcast.to('waiting').emit('start-timer', { time: breakBetweenRaces, status: 2 });
                socket.broadcast.to('race').emit('start-timer', { time: breakBetweenRaces, status: 2 });
            }
        }
    })
    socket.on('start-next', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            timeStart = new Date;
            const textTime = maps.find(map => map.id === mapId);
            timeEnd = Date.parse(timeStart) + (textTime.time * 1000);
            status = 1
            socket.emit('start');
            socket.emit('commentator-change', { comment: commentFactory.createComment('present') });
        }
    })
    socket.on('to-room-race', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            socket.leave('waiting');
            socket.join('race');
        }
    })
    socket.on('add-player', payload => {
        playersCount += 1;
    })
    socket.on('someone-connected', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            let loginUs = jwt.decode(payload.token).login;
            let playerInfoObject = {
                login: loginUs,
                progress: 0,
                timeWastedForMap: 0
            }
            playersInfo.push(playerInfoObject);
            socket.broadcast.to('race').emit('someone-new-connected', { token: payload.token, userLogin: loginUs });
            socket.emit('someone-new-connected', { token: payload.token, userLogin: loginUs });
        }
    })
    socket.on('progress-change', payload => {
        let user = jwt.verify(payload.token, 'someSecret');
        if (user) {
            currPlayerInfoIndex = playersInfo.findIndex(player => player.login==jwt.decode(payload.token).login);
            playersInfo[currPlayerInfoIndex].progress=payload.currProgress;
            playersInfo[currPlayerInfoIndex].timeWastedForMap = payload.timeWasted;
            if(payload.currProgress == payload.maxProgress-30){
                socket.emit('commentator-change', {comment: commentFactory.createComment('announce-someone-close-to-finish', jwt.decode(payload.token).login)})
            }
            socket.broadcast.to('race').emit('someone-progress-changed', { token: payload.token, newProgress: payload.currProgress });
            socket.emit('someone-progress-changed', { token: payload.token, newProgress: payload.currProgress });
        }
    })
    socket.on('announce-current-results',payload=>{
        playersInfo =  playersInfo.sort((a,b)=>{return a.progress - b.progress});
        socket.emit('commentator-change', { comment: commentFactory.createComment('announce-current-results', playersInfo)})
        console.log('sorted : ' + playersInfo);
    })
    socket.on('keypressed', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            const text = maps.find(map => map.id === payload.currTextId);
            if (String.fromCharCode(payload.keycode) === text.map[payload.charNum]) {
                socket.emit('correct', { charNum: payload.charNum });
            }
            else {
                socket.emit('incorrect', { charNum: payload.charNum });
            }
        }
    });
    socket.on('disconnect', payload => {
        playersCount -= 1;
        socket.broadcast.to('race').emit('someone-disconnected');
        if (playersCount == 0) {
            mapId = getRandomInt(3);
            staus = 2;
            timeEnd = Date.parse(new Date);
            socket.broadcast.to('waiting').emit('transfer');
            socket.emit('start-timer', { time: 10, status: 2 });
            socket.broadcast.to('waiting').emit('start-timer', { time: 10, status: 2 });
            socket.broadcast.to('race').emit('start-timer', { time: 10, status: 2 });
        }
    })

});





function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
