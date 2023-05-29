const WebSocket = require('ws');
// Static content
var express = require('express');
var app = express();

const SOCKET_PORT = 8081;
const SERVER_PORT = 8080;
const wss = new WebSocket.Server({ port: SOCKET_PORT });

const redis = require("redis");
const client = redis.createClient({
	host: 'rediscluster.1d62h7.0001.use2.cache.amazonaws.com',
	port: '6379'
});
const subscriber = client.duplicate();
const dim = 1000
let upTime = 0
let cachedBoard = null
const chunkSize = 8 * dim * dim / 10
const batchSize = chunkSize / 16


client.get('place', function (err, reply) {
	if (err) console.log(err)
	else {
		if (reply) {
			console.log("Board already exists")
		}
		else {
			console.log("Board does not exist, creating...")
			resetBoard()
		}
	}
})

wss.on('close', function () {
	console.log('disconnected');
});

wss.broadcast = function broadcast(data) {
	wss.clients.forEach(function each(client) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
	});
};

// for heartbeat to make sure connection is alive 
function heartbeat() {
	this.isAlive = true;
}

wss.on('connection', function (ws) {
	// heartbeat
	ws.isAlive = true;
	ws.on('pong', heartbeat);
	// console.log("connected")
	let time = new Date().getTime()
	if ((time - upTime) < 100){
		ws.send(cachedBoard)
		return
	}
	getBoard((err, data) => {
		if (err) {
			console.log(err)
			ws.send('Board Error')
		} else {
			upTime = new Date().getTime()
			cachedBoard = new Int32Array(data.flat()).buffer
			ws.send(cachedBoard)
		}
	})

});

subscriber.on("message", (channel, message) => {
	wss.broadcast(message)
})
subscriber.subscribe("board-updates")

function getBoard(callback) {
	const board = []
	const boardBatches = []
	let batches = 0
	while (batches < 10) {
		const batch = client.batch()
		const batchProm = new Promise((res, rej) => {
			let i = 0
			while (i < batchSize) {
				batch.bitfield('place', 'GET', 'u32', '#' + ((batches * batchSize) + i))
				i++
			}
			batch.exec(function (err, reply) {
				if (err) rej(err)
				else { res(reply) }
			})
		})
		boardBatches.push(batchProm)
		batches++
	}
	Promise.all(boardBatches).then(boardRes => {
		boardRes.forEach(val => {
			board.push(val.flat())
		})
		callback(null, board.flat())
	}).catch(err => callback(err, null))
}
function resetBoard() {
	client.del('place')
	const batch = client.batch();
	let batches = 0
	while (batches < 10) {
		let i = 0;
		while (i < batchSize) {
			batch.bitfield('place', 'SET', 'u32', '#' + (batches * batchSize + i), 0)
			i++
		}
		batch.exec(function (reply, err) {
		})
		batches++
	}
}

app.get("/bitfield", (req, res) => {
	getBoard((err, data) => {
		if (!err) res.send(data)
		else throw new Error(err)
	})
})

app.get("/ping", (req, res) => {
	res.sendStatus(200)
})

app.listen(SERVER_PORT, function () {
	console.log('Server app listening on port ' + SERVER_PORT);
});

