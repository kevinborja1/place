const redis = require('redis')
const { promisify } = require("util");
const client = redis.createClient({
    host: 'rediscluster.1d62h7.0001.use2.cache.amazonaws.com',
    port: '6379'
});
const dim = 1000
const boardAsync = promisify(client.bitfield).bind(client);
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const expireAsync = promisify(client.expire).bind(client);

exports.handler = async (event, context) => {
    try {
        ({ x, y, color } = JSON.parse(event.body))
        if ((Number.isInteger(x) && x >= 0 && x < dim) &&
            (Number.isInteger(y) && y >= 0 && y < dim) &&
            (Number.isInteger(color) && color >= 0 && color < 16)
        ) {
            const clientIp = event.requestContext.identity.sourceIp
            const timeOut = await getAsync(clientIp)
            if (timeOut) {
                return {
                    statusCode: 429,
                    body: `Rate limited (${clientIp})`,
                }
            }
            else {
                await setAsync(clientIp, clientIp)
                await expireAsync(clientIp, 300)
            }
            const offset = y * dim + x
            await boardAsync('place', 'SET', 'u4', '#' + offset, color)
            client.publish("board-updates", offset + ":" + color)
            return {
                statusCode: 200,
                body: "Success",
            };

        } else
            return {
                statusCode: 400,
                body: "Bad Request",
            }
    }
    catch (err) {
        console.log(err)
        return {
            statusCode: 500,
            body: "Error"
        }
    }
}