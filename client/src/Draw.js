export default class View {
    constructor() { }
    draw(arr) {
        const canvas = document.getElementById('canvas')
        const ctx = canvas.getContext('2d')
        const imageData = ctx.createImageData(1000, 1000)
        imageData.data.set(arr)
        ctx.putImageData(imageData, 0, 0)
    }
}