const greet = process.env.WHO_TO_GREET
console.log(`Hello ${greet ?? 'world'}!`)
