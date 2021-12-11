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
} from 'snarkyjs';
//helper functions
// function evalGuess(guess: Field) {

// }
// const snappPrivkey = PrivateKey.random();
// const snappPubkey = snappPrivkey.toPublicKey();

class BullsCows extends SmartContract {
  // This is not a state variable but a contract parameter
  secret: Field;
  //contract state
  @state(Field) lastGuess: State<Field>;
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
    this.lastGuess = State.init(new Field(''));
    this.gameDone = State.init(new Bool(false));
    this.currentRound = State.init(new Field(0));
  }

  @method async startGame() {
    const currentRound = await this.currentRound.get();
    this.currentRound.set(currentRound.add(1));
    //make assert function if condition has to be met
    console.log('Game started!');
  }

  @method async makeGuess(guess: Field) {
    let currentRound = await this.currentRound.get();
    const gameDone = await this.gameDone.get();
    //make assert function if condition has to be met
    gameDone.assertEquals(false);
    currentRound.assertLte(BullsCows.maxRounds);

    console.log(currentRound);
    console.log('got here');
    //update state with guess
    this.lastGuess.set(guess);
    //check guess and return score
    //
    //move to next round
    this.currentRound.set(currentRound.add(1));
    currentRound = await this.currentRound.get();
    console.log(currentRound);
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

  // Make a guess
  await Mina.transaction(account2, async () => {
    await snappInstance.makeGuess(new Field('1234'));
  })
    .send()
    .wait()
    .catch((e) => console.log('making guess failed'));
  const a = await Mina.getAccount(snappPubkey);

  // console.log('Round', a.snapp.appState[1].toString());
}

run();
shutdown();
