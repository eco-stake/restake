const willThrow = () => {
  try {
    throw new Error('throw inner')
  } catch (e) {
    console.log(`caught`)
    throw new Error('rethrown')
  }
}

const main = () => {
  try {
    willThrow()
  } catch (e) {
    console.log('caught at top level ' + e.message)
  }
}

main()