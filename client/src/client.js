import * as https from 'https'
import Draw from './draw'

const LAMBDA_URL = 'yur25ntvzc'
const URL = 'place-Appli-14HFNB0A1ACOL-1862139462.us-east-2.elb.amazonaws.com'
const socket = new WebSocket(`ws://${URL}`)
const dim = 1000
const chunkSize = 4 * dim * dim
const batchSize = chunkSize / 32
socket.onopen = (event) => {
    console.log('Connected')
}

let app = new Draw()

var colorId = 0;
document.getElementById("selector").addEventListener("pointerdown", e => {
    colorId = parseInt(e.target.id)
})
document.getElementById('setForm').addEventListener('submit', function (e) {
    e.preventDefault()
    var xVal = parseInt(document.getElementById('x').value)
    var yVal = parseInt(document.getElementById('y').value)

    console.log(xVal, yVal, colorId)

    const postData = JSON.stringify({
        x: xVal,
        y: yVal,
        color: colorId
    })
    var options = {
        hostname: LAMBDA_URL + ".execute-api.us-east-2.amazonaws.com",
        port: 443,
        path: '/v0/lambda',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };
    var req = https.request(options, (res) => {
        console.log('statusCode:', res.statusCode);
        console.log('headers:', res.headers);
        res.setHeader('Access-Control-Allow-Origin', '*'); 
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
        res.setHeader('Access-Control-Max-Age', 2592000); // 30 days
        res.on('data', (d) => {
            process.stdout.write(d);
        });
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(postData);
    req.end();
})

let boardDraw = false
let boardUpdates = []
const arr = new Uint8ClampedArray(4 * dim * dim);

socket.onmessage = (e) => {
    console.log("received message")
    if (e.data instanceof Blob) {
        const buffer = e.data.arrayBuffer()
        buffer.then((data) => {
            const board = new Int32Array(data)
            console.log(board)
            for (let i = 0; i < batchSize; i++) {
                const colors = toColorIds(board[i])
                for (let j = 0; j < 8; j++) {
                    const point = toRGB(colors[j])
                    for (let k = 0; k < 4; k++) {
                        arr[i * 32 + j * 4 + k] = point[k]
                    }
                }
            }
            boardUpdates.forEach((update) => {
                ({ coord, point } = update)
                for (let x = 0; x < 4; x++) {
                    arr[(4 * coord) + x] = point[x]
                }
            })
            app.draw(arr)
            boardDraw = true
        })
    }
    else {
        console.log(e.data)
        const dataSplit = e.data.split(':')
        const coord = dataSplit[0]
        const color = dataSplit[1]
        const points = toRGB(color)
        if (boardDraw) {
            for (let x = 0; x < 4; x++) {
                arr[(4 * coord) + x] = points[x]
            }
            app.draw(arr)
        } else {
            boardUpdates.push({ coord: coord, points: points })
        }
    }
}
function toColorIds(num) {
    const col = new Array(8)
    for (let i = 0; i < 8; i++) {
        col[7 - i] = num % 16
        num = Math.floor(num / 16)
    }
    return col
}
function toRGB(colorID) {
    const colors = [
        [255, 255, 255, 255], // white
        [228, 228, 228, 255], // light grey
        [136, 136, 136, 255], // dark grey
        [34, 34, 34, 255],    // black
        [255, 167, 209, 255], // pink
        [229, 0, 0, 255],     // red
        [229, 149, 0, 255],   // orange
        [160, 106, 66, 255],  // brown
        [229, 217, 0, 255],   // yellow
        [148, 224, 68, 255],  // light green
        [2, 190, 1, 255],     // dark green
        [0, 211, 221, 255],   // cyan
        [0, 131, 199, 255],   // blue
        [0, 0, 234, 255],     // dark blue
        [207, 110, 228, 255], // peppa pink
        [130, 0, 128, 255],   // wine
    ]
    return colors[colorID]
}