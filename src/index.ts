import {
  Field,
  Bool,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Mina,
  Party,
  Poseidon,
  isReady,
  shutdown,
  Circuit,
  sizeInFields,
} from 'snarkyjs';
//helper functions

function getScore(secret: string, guess: string): number[] {
  let cows = 0;
  let bulls = 0;
  let guessArr: string[] = guess.split('');
  let secretArr: string[] = secret.split('');
  for (let i = 0; i < guessArr.length; i++) {
    let isBull = false;
    if (guessArr[i] === secret[i]) {
      secretArr[i] = 'x';
      isBull = true;
      bulls++;
    }
    //find cows, but only when its not a bull
    //same number cannot be a cow twice
    if (secretArr.includes(guess[i]) && !isBull) {
      secretArr[secret.indexOf(guess[i])] = 'x';
      cows++;
    }
  }

  return [bulls, cows];
}
// function evalGuess(guess: Field) {

// }
// const snappPrivkey = PrivateKey.random();
// const snappPubkey = snappPrivkey.toPublicKey();

class BullsCows extends SmartContract {
  // This is not a state variable but a contract parameter
  secret: Field;
  //contract state
  @state(Field) lastGuess: State<Field>;
  @state(Field) bullScore: State<Field>;
  @state(Field) cowScore: State<Field>;
  @state(Field) currentRound: State<Field>;
  @state(Bool) gameDone: State<Bool>;

  // @state(PublicKey) player: State<PublicKey>    ??Should I assign player to state?  I want to limit who can play once game starts

  static get maxRounds(): Field {
    return new Field(5);
  }

  constructor(initialBalance: UInt64, address: PublicKey, secret: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.secret = secret;
    this.lastGuess = State.init(new Field(0));
    this.gameDone = State.init(new Bool(false));
    this.currentRound = State.init(new Field(0));
    this.bullScore = State.init(new Field(0));
    this.cowScore = State.init(new Field(0));
  }

  @method async startGame() {
    const currentRound = await this.currentRound.get();
    this.currentRound.set(currentRound.add(1));
    //make assert function if condition has to be met
    console.log('Game started!');
  }

  @method async playRound(guess: Field) {
    //make sure the game isn't over
    let currentRound = await this.currentRound.get();
    const gameDone = await this.gameDone.get();
    gameDone.assertEquals(false);
    currentRound.assertLte(BullsCows.maxRounds);

    //start round
    Circuit.asProver(() => {
      console.log(`Round ${currentRound.toString()}`);
    });

    //check the guess make sure its correct length
    let size = new Field(guess.toString().length);
    size.assertLte(4);
    //update state with guess if valid
    this.lastGuess.set(guess);
    //check guess and return score
    Circuit.asProver(() => {
      console.log(`checking guess....`);
    });
    Circuit.asProver(() => {
      console.log(`You guessed ${guess.toString()}`);
      let secret = this.secret.toString();
      let myGuess = guess.toString();
      let score = getScore(secret, myGuess);
      console.log(score);
      this.bullScore.set(new Field(score[0]));
      this.cowScore.set(new Field(score[1]));
    });

    //give back score

    //check to see if the game is over
    //move on to the next round
  }
}

export async function run() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;
  const account1PubKey = account1.toPublicKey();
  const account2Pubkey = account2.toPublicKey();

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: BullsCows;
  const initSecret = new Field('1234');

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new BullsCows(amount, snappPubkey, initSecret);
    console.log('snapp deployed');
  })
    .send()
    .wait();

  // Start the game
  await Mina.transaction(account2, async () => {
    await snappInstance.startGame();
  })
    .send()
    .wait()
    .catch((e) => console.log('starting game failed'));

  // Round #1

  await Mina.transaction(account2, async () => {
    //there is a bug when trying to pass in a guess that leads in 0s ie '0001' only gets recorded as '1'
    await snappInstance.playRound(new Field('1032'));
  })
    .send()
    .wait()
    .catch((e) => console.log('making guess failed'));

  //log state of app
  const a = await Mina.getAccount(snappPubkey);
  Circuit.asProver(() => {
    console.log(`@state lastGuess: ${a.snapp.appState[0].toString()}`);
    console.log(`@state bullScore: ${a.snapp.appState[1].toString()}`);
    console.log(`@state cowScore: ${a.snapp.appState[2].toString()}`);
    console.log(`@state currentRound:${a.snapp.appState[3].toString()}`);
    console.log(`@state gameDone:${a.snapp.appState[4].toString()}`);
  });

  console.log('Success!');
}

run();
shutdown();

// export function playRound() {
//   //submit value for score
//   let guess = input.value
//   let score = getScore(secret, guess)
//   bulls = score[0]
//   cows = score[1]
//   //create and display result
//   let result = document.createElement('div')
//   result.innerText = `Round ${round} Guess: ${guess} 🐂${bulls} 🐄${cows}]`
//   results.append(result)
//   //check to see if game is over
//   if (isOver(round)) {
//       submit.remove()
//       input.remove()
//       body.append(startBtn)
//   }
//   //get ready for next round
//   round++
//   input.value = ''
// }

// function isOver(round: number) {
//   if (bulls === secret.length) {
//       finalResult.innerText = `You win!`
//       return true
//   } else if (round === MAXROUNDS) {
//       finalResult.innerText = "That was your last guess, you lose!"
//       return true
//   }

//   return false
// }
