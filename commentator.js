let cars = ['ferrari', 'mercedes', 'porshe', 'lamborgini', 'bentley', 'mclaren']
let randomComments = ['А спонсором сьогоднішньої гонки є Велика Кишеня. Велика кишеня, завжди свіжі продукти до вашого столу.', 'Найкращим гравцем в історії існування клавогонок є nagibator228, на його рахунку быльше 10000 перемог', 'Якщо ви помітили якісь порушення правил під час гонки, звертайтеся з скаргам в Асоціацію клавогонок України'];
let Comment = {};

let proxy = new Proxy(Comment, {
    set(target, prop, value) {
        target[prop] = value;
        return true;
    }
})
class CommentFactory {
    createComment(type) {
        switch (type) {
            case 'present':
                proxy.text = 'Добрий день, на дворі прекрасна погода, а у нас надзвичайно цікава гонка, яку для вас коментуватиме Василь Петров';
                break;
            case 'present-racers':
                let racersSring = getRacersString(arguments[1]);
                proxy.text = `В цій гонці будуть брати участь${racersSring} `;
                break;
            case 'announce-current-results':
                proxy.text =  getRacersAnnounceCurrResultsString(arguments[1]);
                break;
            case 'announce-someone-close-to-finish':
                proxy.text = `І ось ${arguments[1]} наближається до фінішу, йому залишилось всього 30 символів`
                break;
            case 'announce-someone-finished':
                proxy.text = `${arguments[1]} перетинає фінішну лінію`
                break;
            case 'announce-results':
                proxy.text = getAnnounceResultsString(arguments[1]);
                break;
            case 'announce-random-comment':
                proxy.text = randomComments[getRandomInt(randomComments.length)];
                break;

        }
        return Comment;
    }
}
function getRacersString(arrayRacers) {
    let str = '';
    let carId;
    arrayRacers.forEach(element => {
        carId = getRandomInt(cars.length);
        str = ' '+str + element.login + ' на ' + cars[carId] + ',';
    });
    str = str.replace(/.$/,".");
    return str;
}

function getRacersAnnounceCurrResultsString(arrayRacers){
    let str = '';
    if(arrayRacers.length==1){
        str='На першому місці '+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+' символів.'
    }else if(arrayRacers.length==2){
        str='На першому місці '+arrayRacers[1].login+' з результатом '+arrayRacers[1].progress+' символів, за ним '+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+' символів.'
    }else{
        str='На першому місці '+arrayRacers[2].login+' з результатом '+arrayRacers[2].progress+' символів, за ним '+arrayRacers[1].login+' з результатом '+arrayRacers[1].progress+' символів, замикає трійку лідерів'+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+'.'
    }
    return str;
}

function getAnnounceResultsString(arrayRacers){
    let str = 'Результати гонки, яка щойно закінчилась ';
    if(arrayRacers.length==1){
        str=str+'на першому місці '+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+' символів за '+arrayRacers[0].timeWastedForMap+' секунди.';
    }else if(arrayRacers.length==2){
        str=str+'на першому місці '+arrayRacers[1].login+' з результатом '+arrayRacers[1].progress+' символів за '+arrayRacers[1].timeWastedForMap+' секунди, за ним на другому місці '+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+' символів за '+arrayRacers[0].timeWastedForMap+' секунди.';
    }else{
        str=str+'на першому місці '+arrayRacers[2].login+' з результатом '+arrayRacers[2].progress+' символів за '+arrayRacers[2].timeWastedForMap+' секунди, за ним на другому місці з результатом '+arrayRacers[1].progress+' символів за '+arrayRacers[1].timeWastedForMap+' секунди'+arrayRacers[1].login+', замикає трійку лідерів '+arrayRacers[0].login+' з результатом '+arrayRacers[0].progress+' символів за '+arrayRacers[0].timeWastedForMap+' секунди.';
    }
    return str;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


module.exports = CommentFactory;