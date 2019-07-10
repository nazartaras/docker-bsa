
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
const timer = require('./timer');
require("./passport.config.js");
app.use(express.static(path.join(__dirname, "/public")));
app.use(passport.initialize());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

server.listen(3000);
let clientsCount=0;
let playersCount = 0;
let playersInfo = [];
let mapId = getRandomInt(3);
let breakBetweenRaces = 20;
let timeStart;
let timeEnd;
let commentFactory = new commentator;
let raceTimerId = 'no-timer';
let breakTimerId = 'no-timer';
let waitTimerId = 'no-timer';
let raceTimer;
let currResultAnnounceIntId;
let randomCommentIntId;
let waitTimer='no-timer';

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
    clientsCount++;
    if (breakTimerId != 'no-timer') {
        socket.join('race');
    } else if (raceTimerId === 'no-timer') {
        const currTime = new Date;
        const textTime = maps.find(map => map.id === mapId).time;
        timeEnd = Date.parse(currTime) + (textTime * 1000);
        socket.join('race');
        socket.emit('start');
        startRaceTimer(textTime);
    } else if (raceTimerId != 'no-timer') {
        socket.join('waiting');
        const currTime = new Date;
        let timerTime = timeEnd - Date.parse(currTime);
        socket.emit('wait');
        startWaitTimer(timerTime/1000);
    }
    socket.on('player-finished', payload => {
        let user = jwt.verify(payload.token, 'someSecret')
        if (user) {
            playersCount -= 1;
            socket.emit('commentator-change', {comment: commentFactory.createComment('announce-someone-finished', jwt.decode(payload.token).login)});
            socket.broadcast.to('race').emit('commentator-change', {comment: commentFactory.createComment('announce-someone-finished', jwt.decode(payload.token).login)});
            if (playersCount == 0) {
                playersInfo = playersInfo.sort((a,b)=>{let x = a.progress - b.progress
                if(x!=0)
                return x;
                return  b.timeWastedForMap - a.timeWastedForMap;
             });
                socket.broadcast.to('race').emit('commentator-change', {comment: commentFactory.createComment('announce-results', playersInfo)});
                socket.emit('commentator-change', {comment: commentFactory.createComment('announce-results', playersInfo)});
                playersInfo = [];
                socket.broadcast.to('race').emit('finish-race');
                socket.emit('finish-race');
                mapId = getRandomInt(3);
                timeEnd = Date.parse(new Date);
                raceTimer.stopTimer();
                clearInterval(raceTimerId);
                clearInterval(waitTimerId);
                clearInterval(currResultAnnounceIntId);
                clearInterval(randomCommentIntId);
                startBreakTimer(breakBetweenRaces);
                raceTimerId='no-timer';
                io.sockets.in('waiting').emit('transfer');
                waitTimerId='no-timer';
            }
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
            playersInfo[currPlayerInfoIndex].timeWastedForMap = raceTimer.getWastedTime();
            if(payload.currProgress == payload.maxProgress-30){
                socket.emit('commentator-change', {comment: commentFactory.createComment('announce-someone-close-to-finish', jwt.decode(payload.token).login)})
            }
            socket.broadcast.to('race').emit('someone-progress-changed', { token: payload.token, newProgress: payload.currProgress });
            socket.emit('someone-progress-changed', { token: payload.token, newProgress: payload.currProgress });
        }
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
        clientsCount--;
        playersCount -= 1;
        socket.broadcast.to('race').emit('someone-disconnected');
        if (playersCount == 0) {
            mapId = getRandomInt(3);
            timeEnd = Date.parse(new Date);
            raceTimer.stopTimer();
            if(waitTimerId!='no-timer'){
            clearInterval(waitTimerId);
            waitTimer.stopTimer();
            waitTimerId='no-timer';
            }
            if(breakTimerId!='no-timer'){
                clearInterval(breakTimerId);
                breakTimer.stopTimer();
                breakTimerId='no-timer';
            }
            clearInterval(raceTimerId);
            clearInterval(randomCommentIntId);
            clearInterval(currResultAnnounceIntId);
            if(clientsCount>0){
            startBreakTimer(breakBetweenRaces);
            socket.broadcast.to('waiting').emit('transfer');
        }else
        raceTimerId='no-timer'
    }
    })

});


function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
function startRaceTimer(textTime){
    io.sockets.in('race').emit('change-timer-text', {text: 'Time to the end of current race '});
    setTimeout(()=>{
    io.sockets.in('race').emit('commentator-change', { comment: commentFactory.createComment('present') });
    setTimeout(()=>{
        io.sockets.in('race').emit('commentator-change', {comment: commentFactory.createComment('present-racers', playersInfo)});
    }, 3000);
    currResultAnnounceIntId = setInterval(()=>{
        playersInfo =  playersInfo.sort((a,b)=>{return a.progress - b.progress});
        io.sockets.in('race').emit('commentator-change', { comment: commentFactory.createComment('announce-current-results', playersInfo)});
    },30000);
    randomCommentIntId = setInterval(()=>{
        io.sockets.in('race').emit('commentator-change', { comment: commentFactory.createComment('announce-random-comment')});
    }, 8000)
    const currTime = new Date;
    timeEnd = Date.parse(currTime) + (textTime * 1000);
    breakTimerId = 'no-timer'
    raceTimer = new timer(textTime,1);
    maxRaceTime = raceTimer.maxTimerTime;
    raceTimerId = setInterval(()=>{
        let currRaceTimerTime = raceTimer.getTimerTime();
        io.sockets.in('race').emit('update-timer', {newTime: currRaceTimerTime});
        if(currRaceTimerTime<1){
            playersInfo = playersInfo.sort((a,b)=>{let x = a.progress - b.progress
                if(x!=0)
                return x;
                return b.timeWastedForMap - a.timeWastedForMap;
             });
            io.sockets.in('race').emit('commentator-change', {comment: commentFactory.createComment('announce-results', playersInfo)});
            io.sockets.in('race').emit('finish-race', {newTime: currRaceTimerTime});
            clearInterval(randomCommentIntId);
            playersInfo=[];
            playersCount = 0;
            startBreakTimer(breakBetweenRaces);
            clearInterval(currResultAnnounceIntId);
            raceTimer.stopTimer();
            clearInterval(raceTimerId);
            
        }
        })},1000);
}
function startBreakTimer(breakTime){
    setTimeout(()=>{
        io.sockets.in('race').emit('change-timer-text', {text: 'Time to next race '});
        raceTimerId = 'no-timer';
        let breakTimer = new timer(breakTime,1);
        breakTimerId = setInterval(()=>{
        let currBreakTimerTime = breakTimer.getTimerTime();
        io.sockets.in('race').emit('update-timer', {newTime: currBreakTimerTime});
        if(currBreakTimerTime<1){
            mapId = getRandomInt(3);
            timeStart = new Date;
            const textTime = maps.find(map => map.id === mapId).time;
            timeEnd = Date.parse(timeStart)+ 1000 + (textTime.time * 1000);
            io.sockets.in('race').emit('start');
            waitTimerId='no-timer';
            startRaceTimer(textTime);
            breakTimer.stopTimer();
            clearInterval(breakTimerId);
        }
        })
    }, 1000);
}
function startWaitTimer(textTime){
    io.sockets.in('waiting').emit('change-timer-text', {text: 'Time to the end of current race '});
    waitTimer = new timer(textTime,1);
    waitTimerId = setInterval(()=>{
        let currWaitTimerTime = waitTimer.getTimerTime();
        io.sockets.in('waiting').emit('update-timer', {newTime: currWaitTimerTime});
        if(currWaitTimerTime<1){
            io.sockets.in('waiting').emit('transfer');
            clearInterval(waitTimerId);
        }
        })
}