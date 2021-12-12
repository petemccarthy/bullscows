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
function isWon(bulls: number) {
  if (bulls === 4) {
    console.log('You found all the bulls, you win!!!');
    return true;
  } else {
    return false;
  }
}

// }

class BullsCows extends SmartContract {
  //contract state
  @state(Field) lastGuess: State<Field>;
  @state(Field) bullScore: State<Field>;
  @state(Field) cowScore: State<Field>;
  @state(Field) currentRound: State<Field>;
  @state(Bool) isWon: State<Bool>;
  @state(PublicKey) lastPlayer: State<PublicKey>;
  @state(Field) secretHash: State<Field>;

  //set max rounds
  static get maxRounds(): Field {
    return new Field(5);
  }
  //set prize $Mina
  static get Prize(): UInt64 {
    return UInt64.fromNumber(5000);
  }

  constructor(initialBalance: UInt64, address: PublicKey, secret: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.lastGuess = State.init(new Field(0));
    this.currentRound = State.init(new Field(1));
    this.bullScore = State.init(new Field(0));
    this.cowScore = State.init(new Field(0));
    this.isWon = State.init(new Bool(false));
    this.lastPlayer = State.init(address);
    this.secretHash = State.init(Poseidon.hash([secret]));
  }

  @method async playRound(guess: Field, player: PublicKey) {
    //make sure rounds are left
    let currentRound = await this.currentRound.get();
    currentRound.assertLte(BullsCows.maxRounds);
    //make sure game hasn't been won
    let isWon = await this.isWon.get();
    isWon.assertEquals(false);
    //start round
    Circuit.asProver(() => {
      console.log(`Round ${currentRound.toString()}`);
      console.log('######################');
    });

    //check the guess make sure its correct length
    let size = new Field(guess.toString().length);
    size.assertLte(4);
    //update state with guess if valid
    this.lastGuess.set(guess);
    //update state with publicKey of guesser
    this.lastPlayer.set(player);
  }

  @method async checkGuess(secret: Field) {
    //verify correct secret passed in
    const hashSecret = await this.secretHash.get();
    Poseidon.hash([secret]).assertEquals(hashSecret);

    let guess = await this.lastGuess.get();
    let currentRound = await this.currentRound.get();

    Circuit.asProver(() => {
      //get the score for the guess
      console.log(`You guessed ${guess.toString()}`);
      let mySecret: string = secret.toString();
      let myGuess = guess.toString();
      let score = getScore(mySecret, myGuess);
      this.bullScore.set(new Field(score[0]));
      this.cowScore.set(new Field(score[1]));
      console.log(`SCORE [BULLS:${score[0]} COWS:${score[1]}]`);

      //check to see if the game is over
      if (isWon(score[0])) {
        //update state variable if won
        this.isWon.set(new Bool(true));
        //Let them know they've won and reveal secret
        console.log('Thanks for playing');
        console.log(`The secret was ${secret.toString()}`);
      } else {
        //check and see if that was last round
        const isLast: Bool = currentRound.equals(BullsCows.maxRounds);
        isLast.assertEquals(false);
        //if game isn't over move to next round
        this.currentRound.set(currentRound.add(1));
        console.log('Play another round?');
      }
    });
  }
  @method async claimPrize(winner: PrivateKey) {
    //check to make sure prize is won
    const isWon = await this.isWon.get();
    isWon.assertEquals(true);
    //check to make sure the private key matches the public key of winner
    const claimPubKey = winner.toPublicKey();
    const winnerPubKey = await this.lastPlayer.get();
    const claim: Bool = claimPubKey.equals(winnerPubKey);
    claim.assertEquals(true);
    console.log('Sending funds...');
    //   send funds to winner
    this.balance.subInPlace(BullsCows.Prize);
    //   change state of address back to contract pubkey
    this.lastPlayer.set(this.address);
  }
}

export async function run() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;
  const account1PubKey = account1.toPublicKey();
  const account2PubKey = account2.toPublicKey();

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: BullsCows;
  const initSecret = new Field('1234');
  const wrongSecret = new Field('1111');

  // Deploys the snapp with secret only known to deployer
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

  // Round #1
  await Mina.transaction(account2, async () => {
    //there is a bug when trying to pass in a guess that leads in 0s ie '0001' only gets recorded as '1'
    await snappInstance.playRound(new Field('1001'), account2PubKey);
  })
    .send()
    .wait()
    .catch((e) => console.log('making guess failed'));

  // Person tries to check with wrong secret
  await Mina.transaction(account1, async () => {
    await snappInstance.checkGuess(wrongSecret);
  })
    .send()
    .wait()
    .catch((e) => console.log('ERROR: Incorrect secret'));
  // Person who knows secret checks the guess
  await Mina.transaction(account1, async () => {
    await snappInstance.checkGuess(initSecret);
  })
    .send()
    .wait()
    .catch((e) => console.log('incorrect secret'));

  // Someone tries to claim the prize early
  await Mina.transaction(account2, async () => {
    await snappInstance.claimPrize(account2);
    const winner = Party.createUnsigned(account2PubKey);
    winner.balance.addInPlace(BullsCows.Prize);
  })
    .send()
    .wait()
    .catch((e) => console.log('ERROR: claiming prize failed'));

  // Round #2
  await Mina.transaction(account2, async () => {
    await snappInstance.playRound(new Field('1014'), account2PubKey);
  })
    .send()
    .wait()
    .catch((e) => console.log('making guess failed'));

  // Person who knows secret checks the guess
  await Mina.transaction(account1, async () => {
    await snappInstance.checkGuess(initSecret);
  })
    .send()
    .wait()
    .catch((e) => console.log('incorrect secret'));

  // Round #3
  await Mina.transaction(account2, async () => {
    await snappInstance.playRound(new Field('1304'), account2PubKey);
  })
    .send()
    .wait()
    .catch((e) => console.log('making guess failed'));

  // Person who knows secret checks the guess
  await Mina.transaction(account1, async () => {
    await snappInstance.checkGuess(initSecret);
  })
    .send()
    .wait()
    .catch((e) => console.log('incorrect secret'));

  // Round #4 (They try to guess more characters) Round doesn't count
  await Mina.transaction(account2, async () => {
    await snappInstance.playRound(new Field('13045'), account2PubKey);
  })
    .send()
    .wait()
    .catch((e) => console.log('too many characters used'));

  //Round 4 (redo).  Person guesses correctly
  await Mina.transaction(account2, async () => {
    await snappInstance.playRound(new Field('1234'), account2PubKey);
  })
    .send()
    .wait()
    .catch((e) => console.log('too many characters used'));

  // Winner winner chicken dinner
  await Mina.transaction(account1, async () => {
    await snappInstance.checkGuess(initSecret);
  })
    .send()
    .wait()
    .catch((e) => console.log('incorrect secret'));

  //non-winner tries to claim prize
  console.log('Some rando tries to claim prize');
  await Mina.transaction(account2, async () => {
    await snappInstance.claimPrize(account1);
    const winner = Party.createUnsigned(account2PubKey);
    winner.balance.addInPlace(BullsCows.Prize);
  })
    .send()
    .wait()
    .catch((e) => console.log('ERROR: claiming prize failed'));

  //winner claims prize
  console.log('Winner claims prize');
  await Mina.transaction(account2, async () => {
    await snappInstance.claimPrize(account2);
    const winner = Party.createUnsigned(account2PubKey);
    winner.balance.addInPlace(BullsCows.Prize);
  })
    .send()
    .wait()
    .catch((e) => console.log('ERROR: claiming prize failed'));

  //and tries again
  console.log('Greedy winner tries to claim prize twice');
  await Mina.transaction(account2, async () => {
    await snappInstance.claimPrize(account2);
    const winner = Party.createUnsigned(account2PubKey);
    winner.balance.addInPlace(BullsCows.Prize);
  })
    .send()
    .wait()
    .catch((e) => console.log('ERROR: claiming prize failed'));
  //log state of app
  const a = await Mina.getAccount(snappPubkey);
  Circuit.asProver(() => {
    console.log('@@@@@@@@ contract state @@@@@@@@@@');
    console.log(`@state lastGuess: ${a.snapp.appState[0].toString()}`);
    console.log(`@state bullScore: ${a.snapp.appState[1].toString()}`);
    console.log(`@state cowScore: ${a.snapp.appState[2].toString()}`);
    console.log(`@state currentRound:${a.snapp.appState[3].toString()}`);
    console.log(`@state isWon:${a.snapp.appState[4].toString()}`);
    console.log(`@state lastPlayer:${a.snapp.appState[5].toString()}`);
    console.log(`@state secretHash:${a.snapp.appState[6].toString()}`);
    console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
  });
}

run();
shutdown();
