class Timer {
    constructor(time,timerType){
        this.maxTimerTime = time;
        this.timerTime = time;
        this.timerId = 0;
        this.startTimer(time,timerType);
    }
    startTimer(time, timerType){
        this.timerTime = time;
        this.timerId=setInterval(()=>{this.timer(this.timerTime, timerType)}, 1000);
    }
    timer(timerType){
        this.timerTime -=1;
        if(this.timerTime<1){
           this.stopTimer();
        }
    }
    stopTimer(){
        clearInterval(this.timerId)
    }
    getTimerTime(){
        return this.timerTime;
    }
    getWastedTime(){
        return this.maxTimerTime-this.timerTime;
    }
}
module.exports = Timer;