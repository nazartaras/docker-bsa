window.onload = () => {

    const socket = io.connect("http://localhost:3000");
    const resultDiv = document.querySelector('#results');
    const entered = document.querySelector('#entered');
    const textField = document.querySelector('#to-enter');
    const waiting_timer = document.querySelector('#waiting-timer');
    const place_for_comments = document.querySelector('#commentator-place');
    let progress = 0;
    let currText = 0;
    let currMapLength = 0;
    let timerTime;
    let timerId;
    let maxTimer;
    let commentResultAnnounceIntervalId;
    const token = localStorage.getItem('jwt');
    window.addEventListener('keypress', ev => {
        socket.emit('keypressed', { keycode: ev.keyCode, charNum: progress, currTextId: currText, token: token });
    })

    socket.on('start', ev => {
        restoreAll();
        socket.emit('add-player');
        fetch('/game', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        }).then(res => {
            res.json().then(body => {
                socket.emit('someone-connected', { token: token });
                textField.innerHTML = body.currMap.map;
                currText = body.textId;
                currMapLength = body.currMap.map.length;
                clearTimeout();
                timerTime = body.currMap.time;
                maxTimer = timerTime;
                waiting_timer.style.display = 'block';
                timerId = setInterval(() => {
                    timer(1)
                }, 1000);
            })
        })

    })
    socket.on('wait', ev => {
        textField.style.display = "none";
        waiting_timer.style.display = "block";

    })
    socket.on('commentator-change', payload => {
        place_for_comments.innerHTML = payload.comment.text;
    })
    socket.on('correct', ev => {
        let textToEnter = textField.innerHTML.split('');
        let enteredText = entered.innerHTML;
        enteredText = enteredText + textToEnter[0];
        textToEnter.splice(0, 1);
        textField.innerHTML = textToEnter.join('');
        entered.innerHTML = enteredText;
        progress += 1;
        document.getElementById(token).children[1].value = progress;
        socket.emit('progress-change', { currProgress: progress, token: token, maxProgress: currMapLength, timeWasted: maxTimer-timerTime });
        if (progress == textToEnter.length + enteredText.length) {
            socket.emit('player-finished', { token: token });
        }
    })
    socket.on('someone-progress-changed', payload => {
        document.getElementById(payload.token).lastChild.value = payload.newProgress;
        for (let i = 0; i < resultDiv.children.length; i++) {
            if (resultDiv.children[i].lastChild.value < payload.newProgress) {
                resultDiv.insertBefore(document.getElementById(payload.token), resultDiv.children[i]);
            }
        }

    })
    socket.on('someone-finished-race', ev => {
    })

    socket.on('race-finished', payload => {
        hideAll();
    })
    socket.on('someone-new-connected', payload => {
        const newProgWrp = document.createElement('div');
        const newProgLabel = document.createElement('span');
        const newProgBar = document.createElement('progress');
        newProgLabel.innerHTML = payload.userLogin;
        newProgBar.value = 0;
        newProgBar.max = currMapLength;
        newProgWrp.id = payload.token;
        newProgBar.style.display = 'block';
        newProgBar.style.margin = '10px';
        newProgWrp.appendChild(newProgLabel);
        newProgWrp.appendChild(newProgBar);
        resultDiv.appendChild(newProgWrp);
    })
    socket.on('incorrect', ev => { })
    socket.on('transfer', ev => {
        clearInterval(timerId);
        socket.emit('to-room-race', { token: token });
    })
    socket.on('start-timer', payload => {
        waiting_timer.style.display = 'block';
        timerTime = payload.time;
        timerId = setInterval(() => {
            timer(payload.status)
        }, 1000);
    })
    socket.on('clear-interval', payload => {
        clearInterval(timerId);
        clearInterval(commentResultAnnounceIntervalId);
    })
    function hideAll() {
        entered.innerHTML = '';
        textField.innerHTML = '';
        entered.style.display = 'none';
        textField.style.display = 'none';

    }
    function restoreAll() {
        entered.style.display = 'inline-block';
        textField.style.display = 'inline-block';
        waiting_timer.style.display = 'none';
        progress = 0;
        while (resultDiv.firstChild) {
            resultDiv.removeChild(resultDiv.firstChild);
        }
    }

    function timer(timerType) {
        if (timerType === 1 || timerType == 3)
            document.getElementById('timer-text').innerHTML = 'Time to the end of current race ::';
        if (timerType === 2)
            document.getElementById('timer-text').innerHTML = 'Time to the next ::';
        let minutesHtml = document.getElementById('minutes');
        let secondsHtml = document.getElementById('seconds');
        let seconds = timerTime % 60;
        let minutes = (timerTime - seconds) / 60;
        
        if (minutes < 1) {
            minutesHtml.style.display = 'none';
        }
        else {
            minutesHtml.style.display = 'inline-block';
            minutesHtml.innerHTML = minutes;
        }
        secondsHtml.innerHTML = seconds;
        if(timerType == 1 && timerTime==maxTimer){
            commentResultAnnounceIntervalId = setInterval(()=>{
            socket.emit('announce-current-results')},30000);
        }
        timerTime -= 1;
        if (timerType == 1 && timerTime == maxTimer - 5) {
            socket.emit('present-racers');
        }
        
        if (timerTime === -1 && timerType == 1) {
            clearInterval(timerId);
            clearInterval(commentResultAnnounceIntervalId);
            waiting_timer.style.display = 'none';
            socket.emit('player-finished', { token: token });
        }
        if (timerTime === -1 && timerType == 2) {
            clearInterval(timerId);
            waiting_timer.style.display = 'none';
            socket.emit('start-next', { token: token });
        }

    }
}