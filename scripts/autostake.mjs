import { Autostake } from "./base.mjs";

const autostake = new Autostake();
const networkNames = process.argv.slice(2, process.argv.length)

const main = async () => {
  console.log("Restake is booting...!")

  const RETRIES = 10
  for (let i = 0; i < networkNames; i++) {
    const networkName = networkNames[i]
    console.log(`Starting Restake for ${networkName}...`)

    for (let j = 0; j < RETRIES; j++) {
      try {
        await autostake.run(networkName)

        // Success! Set j to mx to short circuit the loop.
        j = tries
      } catch (e) {
        console.log(`[${i + 1}/${RETRIES}]Caught an error running on ${networkName}: ${e}`)
        console.log(`Retrying after a delay...`)
        await new Promise(r => setTimeout(r, (Math.random() * 31) * 1000));
      }
    }
  }
}
main()
