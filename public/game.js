window.onload = () => {

    const socket = io.connect("http://localhost:3000");
    const resultDiv = document.querySelector('#results');
    const entered = document.querySelector('#entered');
    const textField = document.querySelector('#to-enter');
    const waiting_timer = document.querySelector('#waiting-timer');
    const place_for_comments = document.querySelector('#commentator-place');
    let minutesHtml = document.getElementById('minutes');
    let secondsHtml = document.getElementById('seconds');
    let progress = 0;
    let currText = 0;
    let currMapLength = 0;
    const token = localStorage.getItem('jwt');
   

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
            })
        })

    })
    socket.on('add-event-listener',payload=>{
        window.addEventListener('keypress', listener)
    })
    socket.on('remove-event-listener', payload=>{
        window.removeEventListener('keypress', listener)
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
        socket.emit('progress-change', { currProgress: progress, token: token, maxProgress: currMapLength});
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
    socket.on('change-timer-text', payload=>{
        document.getElementById('timer-text').innerHTML = payload.text;
    })


    socket.on('finish-race', payload => {
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
    socket.on('transfer', ev => {
        socket.emit('to-room-race', { token: token });
    })
    socket.on('update-timer', payload => {
        let seconds = payload.newTime % 60;
        let minutes = (payload.newTime - seconds) / 60;
        if (minutes < 1) {
            minutesHtml.style.display = 'none';
        }
        else {
            minutesHtml.style.display = 'inline-block';
            minutesHtml.innerHTML = minutes;
        }
        secondsHtml.innerHTML = seconds;
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
        progress = 0;
        deleteProgressBars();
    }
    function deleteProgressBars() {
        while (resultDiv.firstChild) {
            resultDiv.removeChild(resultDiv.firstChild);
        }
    }
    function listener(ev){
        socket.emit('keypressed', { keycode: ev.keyCode, charNum: progress, currTextId: currText, token: token });
    }
}