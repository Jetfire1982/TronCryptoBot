const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

// import fetch from node-fetch;

const token = "7661178189:AAG6jWSHeBsG4gh7vqSqTwG_y7It6u25_Dg";

const bot = new TelegramBot(token, { polling: true });

// bot.on('message', (msg) => {
//     // let hi = "hi";
//     // var Hi = "hi";
//     // if (msg.text.toString().toLowerCase().indexOf(Hi) === 0) {
//     bot.sendMessage(msg.chat.id, "Hello dear user from message ");
//     // bot.sendMessage(msg.chat.id, `Your request was ${msg.text}}`);
//     // bot.sendPhoto(msg.chat.id,"https://images.app.goo.gl/e5h9ev9bD5Jqo5jJ8", {caption : "Here we go!"} );
//     // console.log("msg = ", msg)
// });

// bot.onText(/\/start/, (msg) => {
//     // bot.sendMessage(msg.chat.id, "Welcome", {
//     //     "reply_markup": {
//     //         "keyboard": [["Sample text", "Second sample"],   ["Keyboard"], ["I'm robot"]]
//     //         }
//     //     });
//     bot.sendMessage(msg.chat.id, "Hello dear user from command ");
//     // cryptoFetch();

// })

let exp = /tar/;
let exp2 = /remcoinful/;
// let exp3 = /[a-z]usdt/i; //чтобы из полученного массива данных с binance выбрать только с usdt на конце
let exp3 = /\wusdt/i; //чтобы из полученного массива данных с binance выбрать только с usdt на конце
let exp4 = /getstatus/; //команда для получения статуса по конкетной паре, пр: getstatus_btc
// let expTest1 = /1000why/i;

let exchange = false; //обмен с binance и поиск целевого значения и м.б. поиск импульса включен/выключен
let lookImpactOnOff = false; //система поиска импульса движения включена/выключена
let intervalId;
let countExchange = 0;
let currentMinute = 0;
let currentSector = 0;

let obTargets = {};
//ниже массив по которому были сигналы targets - содержит 20 элементов с автозатиранием старого
let lastSignals = [];
//ниже массив по которому были импульсные движения цены
let lastImpacts = [];
//ниже разрешение/запрет на сигнал при импульсе
let impactsAlert = true;
//ниже задаем дельту в процентах для импульсного движения цены:
let deltaImpact = 0.8;
//структура объекта выше следующая пример:
/*obTargets = {
    BTCUSDT: {
        targets: [],
        lastPercentagesArrayTF5: [0,0,0,0,0,0,0,0,0,0,0],
        lastPercentagesTF5:0,
        lastPriceTF5: 0
    }
}
*/

bot.setMyCommands([
    { command: "/start", description: "Начальное приветствие" },
    // { command: "/test1", description: "Запрос binance" },
    // { command: "/test2", description: "Запрос binance" },
    { command: "/start_stop_exchange_with_binance", description: "Запуск/остановка обмена с бинанс" },
    { command: "/start_stop_looking_for_impact", description: "Запуск/остановка поиск импульсов по парам" },
    { command: "/start_stop_impacts_alert", description: "Запуск/остановка оповещения импульсов" },
    {
        command: "/tar",
        description:
            "Полученение монеты для отслеживания и цены для контроля в формате tar_ticker_neededPrice",
    },
    {
        command: "/remcoinful",
        description:
            "Удаление монеты для отслеживания полностью в формате remcoinful_ticker",
    },
    // {
    //     command: "/remcoinpart",
    //     description:
    //         "Удаление частично монеты для отслеживания  в формате remcoinpart_ticker_unnecessaryPrice",
    // },
    {
        command: "/remcoinsall",
        description: "Удаление всех монет для отслеживания в формате remcoinsall",
    },

    { command: "/status", description: "Получение статуса работы бота" },
    { command: '/lastsignals', description: "Последние сигналы" },
    { command: '/lastimpacts', description: "Последние импульсы по парам" },
    { command: "/getstatus", description: "Получение статуса по конкретной паре (getstatus_ticker)" },

    { command: "/info", description: "Получить информацию о пользователе" },
    { command: "/game", description: 'Игра: "Угадай число"' },
]);

bot.onText(/\/color/, (msg) => {
    const chatId = msg.chat.id;
    const messageText = `<font color='red'>This text is red!</font> <font color='blue'>This is blue.</font>`;
    bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
});

bot.on("message", async (msg) => {
    console.log("User sent this =", msg.text);
    const text = msg.text; //текст который отправил пользователь

    chatId = msg.chat.id; //айди нашего чата


    if (text === "/test2") {
        await cryptoFetchTest2();
        //   bot.sendMessage(chatId, ans);

    }

    if (text === "/start_stop_exchange_with_binance") {
        try {
            if (!exchange) {
                exchange = !exchange
                intervalId = setInterval(async () => {
                    console.log("Count = ", countExchange)
                    countExchange++; //просто счетчик циклов обмена, сбрасываю при прекращении обмена
                    let arrCryptoPairs = await cryptoFetchTest();
                    let myDate = new Date();
                    let instantMinute = myDate.getMinutes();
                    //ниже проверяем включен ли алгоритм поиска импульса (он внутри содержит и проверку целевого значения)
                    if (!(instantMinute % 5) && (currentMinute != instantMinute) && (lookImpactOnOff)) {
                        currentMinute = instantMinute;
                        currentSector = (instantMinute / 5) - 1;
                        if (currentSector === -1) { //такое будет если получили instantMinute равной 0
                            currentSector = 11;
                        }
                        console.log("currentMinute = ", currentMinute, " currentSector =", currentSector)
                        if (arrCryptoPairs != undefined) { //тут просто проверяем а то иногда с binance случается ошибка или если инет пропал
                            arrCryptoPairs.forEach(el => {
                                if (exp3.test(el.symbol)) { //тут выбираем пары с usdt на конце ведь только с ними и работаем

                                    //Теперь сделаем проверку а есть ли в глобальном объекте obTargets свойства на текущую пару и если нет создаем
                                    if (!obTargets[el.symbol]) {
                                        obTargets[el.symbol] = {
                                            targets: [],
                                            lastPercentagesArrayTF5: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                            lastPercentagesTF5: 0,
                                            lastPriceTF5: 0
                                        }
                                    }

                                    // let deltaPercent = Math.abs(100 - ((obTargets[el.symbol].lastPriceTF5 * 100) / el.price))
                                    let deltaPercent = 100 - ((obTargets[el.symbol].lastPriceTF5 * 100) / el.price)
                                    //теперь заносим значение в массив из 11 значений дельт 
                                    obTargets[el.symbol].lastPercentagesArrayTF5[currentSector] = deltaPercent.toFixed(2);
                                    //обновляем lastPercentagesTF5:
                                    obTargets[el.symbol].lastPercentagesTF5 = deltaPercent.toFixed(2);
                                    //обновляем lastPriceTF5:
                                    obTargets[el.symbol].lastPriceTF5 = el.price;
                                    //теперь делаем проверку и в случае если текущая дельта и предыдущая больше deltaImpact сообщаем трейдеру
                                    //также делаем проверку если текущий сектор равен 0  то предыдущий это 11
                                    if (currentSector >= 1) {
                                        if ((obTargets[el.symbol].lastPercentagesArrayTF5[currentSector] >= deltaImpact) && (obTargets[el.symbol].lastPercentagesArrayTF5[currentSector - 1] >= deltaImpact)) {
                                            //заполняем массив импульсно идущих пар
                                            if (lastImpacts.length == 20) {
                                                lastImpacts.shift(); //удаляем первый элемент
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()}    `); //добавляем в конец новый
                                            } else {
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()}    `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} летит вверх!`)
                                        }
                                        if ((obTargets[el.symbol].lastPercentagesArrayTF5[currentSector] <= -deltaImpact) && (obTargets[el.symbol].lastPercentagesArrayTF5[currentSector - 1] <= -deltaImpact)) {
                                            //заполняем массив импульсно идущих пар
                                            if (lastImpacts.length == 20) {
                                                lastImpacts.shift(); //удаляем первый элемент
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `); //добавляем в конец новый
                                            } else {
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} летит вниз!`)
                                        }
                                    } else { //т.е. текущий сектор равен 0
                                        if ((obTargets[el.symbol].lastPercentagesArrayTF5[0] >= deltaImpact) && (obTargets[el.symbol].lastPercentagesArrayTF5[11] >= deltaImpact)) {
                                            //заполняем массив импульсно идущих пар
                                            if (lastImpacts.length == 20) {
                                                lastImpacts.shift(); //удаляем первый элемент
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `); //добавляем в конец новый
                                            } else {
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} летит вверх!`)
                                        }
                                        if ((obTargets[el.symbol].lastPercentagesArrayTF5[currentSector] <= -deltaImpact) && (obTargets[el.symbol].lastPercentagesArrayTF5[currentSector - 1] <= -deltaImpact)) {
                                            //заполняем массив импульсно идущих пар
                                            if (lastImpacts.length == 20) {
                                                lastImpacts.shift(); //удаляем первый элемент
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `); //добавляем в конец новый
                                            } else {
                                                lastImpacts.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} летит вниз!`)
                                        }
                                    }

                                    //Теперь прописываем алгоритм сравнения с целевыми значениями
                                    obTargets[el.symbol].targets.forEach(elem => {
                                        if (Math.abs(100 - (elem * 100 / el.price)) <= 0.5) {
                                            //удаляем значение которое дало сигнал из контролируемых чтобы постоянно не сигналило;
                                            obTargets[el.symbol].targets = obTargets[el.symbol].targets.slice(0, index).concat(obTargets[el.symbol].targets.slice(index + 1));
                                            //добавляем сигнал в массив прошедших сигналов из 20 штук
                                            if (lastSignals.length == 20) {
                                                lastSignals.shift(); //удаляем первый элемент
                                                lastSignals.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `); //добавляем в конец новый
                                            } else {
                                                lastSignals.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} близка к целевому значению ${elem}!    ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()}`)
                                        }
                                    })
                                }
                            });
                        }
                    } else {
                        //Ну и в случае else просто проверяем на целевые значения
                        if (arrCryptoPairs != undefined) { //тут просто проверяем а то иногда с binance случается ошибка или если инет пропал


                            arrCryptoPairs.forEach(el => {
                                if (exp3.test(el.symbol)) { //тут выбираем пары с usdt на конце ведь только с ними и работаем

                                    //Теперь сделаем проверку а есть ли в глобальном объекте obTargets свойство на текущую пару и если нет создаем
                                    if (!obTargets[el.symbol]) {
                                        obTargets[el.symbol] = {
                                            targets: [],
                                            lastPercentagesArrayTF5: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                            lastPercentagesTF5: 0,
                                            lastPriceTF5: 0
                                        }
                                    }

                                    obTargets[el.symbol].targets.forEach((elem, index) => {
                                        if (Math.abs(100 - (elem * 100 / el.price)) <= 0.5) {
                                            //удаляем значение которое дало сигнал из контролируемых чтобы постоянно не сигналило;
                                            obTargets[el.symbol].targets = obTargets[el.symbol].targets.slice(0, index).concat(obTargets[el.symbol].targets.slice(index + 1));
                                            //добавляем сигнал в массив прошедших сигналов из 20 штук
                                            if (lastSignals.length == 20) {
                                                lastSignals.shift(); //удаляем первый элемент
                                                lastSignals.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `); //добавляем в конец новый
                                            } else {
                                                lastSignals.push(` ${el.symbol} - ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()} `);
                                            }
                                            bot.sendMessage(chatId, `Пара ${el.symbol} близка к целевому значению ${elem}!    ${myDate.getHours() + "h:" + myDate.getMinutes() + "m   " + myDate.toDateString()}`)
                                        }
                                    })
                                }
                            })
                        } else {
                            console.log("!!!arrCryptoPairs = ", arrCryptoPairs)
                        }
                    }

                }, 10000)
            } else {
                exchange = !exchange
                //ну и отключаем цикл
                clearInterval(intervalId)
                countExchange = 0;
                return bot.sendMessage(chatId, "Обмен с binance отключен");
            }
            return bot.sendMessage(chatId, "Начинаем обмен с binance");
        } catch (e) {
            console.log("Ошибка в нашем start_stop_exchange_with_binance,  Error = ", e.message);
            return bot.sendMessage(chatId, `Ошибка в нашем start_stop_exchange_with_binance,  Some Error =${e.message}`);
        }
    }


    if (text === "/start") {
        await bot.sendSticker(
            chatId,
            "https://tlgrm.ru/_/stickers/eb5/41e/eb541eba-3be4-3bea-bd7f-5e487503be39/2.webp"
        );
        return bot.sendMessage(chatId, "Добро пожаловать в телеграм бот TronAlert");
    }

    if (text === "/status") {
        bot.sendMessage(chatId, `Текущая минута - currentMinute = ${currentMinute}`);
        bot.sendMessage(chatId, `Текущий сектор currentSector = ${currentSector}`);
        bot.sendMessage(chatId, `Счетчик натикал countExchange = ${countExchange}`);

        if (lookImpactOnOff) {
            bot.sendMessage(chatId, 'Looking for impact is ACTIVE');
        } else {
            bot.sendMessage(chatId, '<i>Looking for impact is NOT active</i>', { parse_mode: 'HTML' });
        }

        //ниже найдем пары по которым есть отслеживание и отошлем пользователю массив этих пар
        let arrayTargetPairs = [];
        Object.keys(obTargets).forEach(el => {
            if (obTargets[el].targets.length !== 0) {
                console.log("el = ", el)
                arrayTargetPairs.push(el)
            }
        })
        bot.sendMessage(chatId, `Pair with targets = ${JSON.stringify(arrayTargetPairs)}`);
        if (exchange) {
            return bot.sendMessage(chatId, 'Exchange with binance is ACTIVE');
        } else {
            return bot.sendMessage(chatId, '<i>Exchange with binance is NOT active</i>', { parse_mode: 'HTML' });
            // await bot.sendMessage(chatId, `tg://user?id=${msg.from.id}`);
            // await bot.sendMessage(chatId, '<font "color = green">Test</font>', {parse_mode : "HTML"});
            // await bot.sendMessage(chatId,  "Texto con *negrita*, _cursiva_ y `code`",{parse_mode : "Markdown"});

            // const messageText = "<i style={color: red}>Hello, world!</i>";
            // bot.sendMessage(chatId, messageText, { parse_mode: 'HTML' });
        }
    }

    if (text === "/lastsignals") {
        return bot.sendMessage(chatId, `Last sigals = ${JSON.stringify(lastSignals)}`);
    }

    if (text === "/lastimpacts") {
        return bot.sendMessage(chatId, `Last impacts = ${JSON.stringify(lastImpacts)}`);
    }

    if (text === "/start_stop_impacts_alert") {
        impactsAlert = !impactsAlert;
        return bot.sendMessage(chatId, `<i>${impactsAlert ? "Оповещение импульсов ВКЛЮЧЕНО" : "Оповещение импульсов ВЫКЛЮЧЕНО"}</i>`, { parse_mode: 'HTML' });
    }

    if (text === "/start_stop_looking_for_impact") {
        if (!lookImpactOnOff) {
            lookImpactOnOff = !lookImpactOnOff
            return bot.sendMessage(chatId, `<i>${lookImpactOnOff ? "Поиск импульсов по парам включен" : "Поиск импульсов по парам выключен"}</i>`, { parse_mode: 'HTML' });
        } else {
            lookImpactOnOff = !lookImpactOnOff
            return bot.sendMessage(chatId, `<i>${lookImpactOnOff ? "Поиск импульсов по парам включен" : "Поиск импульсов по парам выключен"}</i>`, { parse_mode: 'HTML' });
        }
    }

  


    if (text === "/remcoinsall") {
        Object.keys(obTargets).forEach(key => {
            console.log("key = ", key)
            obTargets[key].targets = []
        })
        return bot.sendMessage(chatId, `Массивы targets по всем парам обнулины`);
    }

    //ниже проверяем на команду с отслеживанием
    if (exp.test(text)) {
        console.log("exp");
        try {
            let result = await getTarget(text, obTargets);
            console.log("result  =", result)
            if (!result) {
                return bot.sendMessage(chatId, 'Такой пары нет на binance');
            }
            return bot.sendMessage(chatId, `По паре ${result} полный объект равен = ${JSON.stringify(obTargets[result])}`);
        } catch (e) {
            console.log("Error = ", e.message);
            return bot.sendMessage(chatId, `Some Error =${e.message}, try one more`);
        }
    }

    //ниже проверяем на команду удаленение по какой то монете всех отслеживаний
    if (exp2.test(text)) {
        console.log("exp2");
        try {
            let result = text.match(/_\w*/gi).map((el) => {
                return el.replace(/_/g, "");
            });

            result = (result[0] + "usdt").toUpperCase(); //добавляем usdt на конец и переводим в верхний регистр
            obTargets[result].targets = []; //обнуляем массив

            return bot.sendMessage(chatId, `По паре ${result} targets обнулен и полный объект равен = ${JSON.stringify(obTargets[result])}`);
        } catch (e) {
            console.log("Error = ", e.message);
            return bot.sendMessage(chatId, `Some Error =${e.message}, try one more`);
        }
    }


    //ниже проверяем на команду по получению статуса по конкретной паре
    if (exp4.test(text)) {
        console.log("exp4");
        try {
            let result = text.match(/_\w*/gi).map((el) => {
                return el.replace(/_/g, "");
            });

            result = (result + "usdt").toUpperCase(); //добавляем usdt на конец и переводим в верхний регистр

            return bot.sendMessage(chatId, `По паре ${result} полный объект равен = ${JSON.stringify(obTargets[result])}`);
        } catch (e) {
            console.log("Error = ", e.message);
            return bot.sendMessage(chatId, `Some Error =${e.message}, try one more`);
        }
    }
});

async function cryptoFetch() {
    try {
        const res = await fetch(
            "https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22BNBUSDT%22,%22TRUMPUSDT%22]"
        );
        if (!res.ok) {
            throw new Error(
                // `Could not fetch ${this._apiBase + url}, status: ${res.status}`
                `Could not fetch, status: ${res.status}`
            );
        }

        // console.log("res = ",res)
        const some = await res.json();
        console.log("Answer = ", some);
        return some;
    } catch (e) {
        console.log("WTF =", e);
        console.log("WTF =", e.message);
    }
}

async function getTarget(target, obTargets) {
    try {
        let result = target.match(/_\w*_/gi).map((el) => {
            return el.replace(/_/g, "");
        });
        result = (result + "usdt").toUpperCase(); //добавляем usdt на конец и переводим в верхний регистр

        //теперь мне надо совершить локальный запрос к binance по этой паре чтобы удостовериться что она выдается api прежде чем ее отслеживать
        const res = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${result}`
        );
        if (!res.ok) {
            throw new Error(
                // `Could not fetch ${this._apiBase + url}, status: ${res.status}`
                `Could not fetch, status: ${res.status}`
            );
        }

        let result2 = target.match(/\d*\.\d*/g) || target.match(/\d{1,}/g); //пришлось схитрить т.е. первое выражение для выражений с точкой типа 10.10, а второе работает без точки 10

        //Теперь сделаем проверку а есть ли в глобальном объекте obTargets свойство на текущую пару и если нет создаем
        if (!obTargets[result]) {
            obTargets[result] = {
                targets: [],
                lastPercentagesArrayTF5: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                lastPercentagesTF5: 0,
                lastPriceTF5: 0
            }
        }

        // if (obTargets.hasOwnProperty(result)) {
        console.log("result2 = ", +result2[result2.length - 1])
        obTargets[result].targets.push(+result2[result2.length - 1]); //т.к. в название пары может быть и число которое может попасть в массив targets и для исключения мы берем именно последнее число что есть targets
        //ниже уберем дублирующие значения цены если они есть
        obTargets[result].targets = Array.from(new Set(obTargets[result].targets));
        // } else {

        // obTargets[result].targets = [+result2];
        // arrPairRequests.push((result + "usdt").toUpperCase());
        // }
        console.log("result in function = ", result)
        return result;
    } catch (e) {
        console.log("WTF =", e);
        console.log("WTF =", e.message);
        return null;
    }
}


async function cryptoFetchTest() {
    try {
        const res = await fetch(
            "https://api.binance.com/api/v3/ticker/price"
        );

        if (res.status != 200) {
            console.log("STATUS 1 =", res.status);
            console.log("HEADERS =", res.headers);
        }

        if (!res.ok) {
            throw new Error(
                // `Could not fetch ${this._apiBase + url}, status: ${res.status}`
                `Could not fetch, status: ${res.status}`
            );
        }

        // console.log("res = ",res)
        const some = await res.json();

        return some;
    } catch (e) {
        console.log("WTF =", e);
        console.log("WTF =", e.message);
    }
}


async function cryptoFetchTest2() {
    try {
        const res = await fetch(
            "https://api.binance.com/api/v3/ticker/price"
        );
        if (!res.ok) {
            throw new Error(
                // `Could not fetch ${this._apiBase + url}, status: ${res.status}`
                `Could not fetch, status: ${res.status}`
            );
        }

        // console.log("res = ",res)
        const some = await res.json().then(ans => {
            ans.forEach(el => {
                if (el.symbol === "BTCUSDT") {
                    // if((expTest1.test(el.symbol))){
                    bot.sendMessage(chatId, `el.symbol = ${el.symbol}, el.price = ${el.price} `);
                }

            });
        })

        return some;
    } catch (e) {
        console.log("WTF =", e);
        console.log("WTF =", e.message);
    }



    // try {
    //     const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    //     const data = await response.json();

    //     const prices = {};
    //     data.symbols.forEach(symbolInfo => {
    //         if (symbolInfo.status === "TRADING") {
    //             const symbol = symbolInfo.symbol;
    //             // Предполагается, что цена последней сделки есть в /ticker/24hr
    //             fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
    //                 .then(response => response.json())
    //                 .then(tickerData => {
    //                     if (tickerData && tickerData.lastPrice) {
    //                         prices[symbol] = {
    //                             price: tickerData.lastPrice,
    //                             volume: tickerData.volume
    //                         };
    //                         if(symbol ==="API3USDT"){
    //                              bot.sendMessage(chatId, `ok  =${JSON.stringify(prices["API3USDT"])}`);
    //                         }
    //                     }
    //                 })
    //                 .catch(error => console.error(`Ошибка при получении данных для ${symbol}:`, error));
    //         }
    //     });
    //     return prices;
    // } catch (error) {
    //     console.error('Ошибка при получении данных с API Binance:', error);
    //     return null;
    // }



}


// module.exports.gameOptions={
//     reply_markup: JSON.stringify({
//        inline_keyboard:[ //тут каждый вложенный массив это отдельная строка и т.о. ниже мы сверстали такую клавиатуру
//           [{text:"7", callback_data:"7"},{text:"8", callback_data:"8"},{text:"9", callback_data:"9"}],   //callback_data - это какая то ИНФОРМАЦИЯ которая вернется на сервер когда пользователь нажмет на кнопк, т.е. по ней мы определим какая кнопка нажата
//           [{text:"4", callback_data:"4"},{text:"5", callback_data:"5"},{text:"6", callback_data:"6"}],
//           [{text:"1", callback_data:"1"},{text:"2", callback_data:"2"},{text:"3", callback_data:"3"}],
//           [{text:"0", callback_data:"0"}]

//        ]
//     })
//  }
