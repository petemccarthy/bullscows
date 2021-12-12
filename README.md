# Mina Snapp: BullsAndCows

This is an implementation of the game **Bulls and Cows** using SnarkyJS
For detailed explaination of the game check [here](https://pages.github.com/)

## How to play
1. Contract is deployed, the deployer picks a secret, 4 digit, number.
2. Anyone can try to guess the secret and they have 5 rounds to do it.
3. They must guess using only 4 digits.
4. Guess are scored as follows:
    For each digit in a guess that is in the same position as the guess the player gets 1 bull
    For any remaining digits that aren't bulls but do match to a digit in the secret, player gets 1 cow
    Examples:
    secret = '1234'
    guess1 = '1002'
    This would score 1 bull and 1 cow
    
    guess2 = '1200'
    This would score 2 bulls and 0 cows
    
    guess3 = '4321'
    This would score 0 bulls and 4 cows
    
    guess4 = '1234'
    This would score 4 bulls and 0 cows and be a winner
 5. The game is over when player scores 4 bulls or maximum rounds (5) are reached 


## How this demonstrates Zero Knowledge Proofs
The secret is never stored on chain.  When the contract is initiated, the initiator passes the secret as an argument to the chain. 
The secret gets hashed and only the hash of the secret is stored on the state of the smart contract. 
  `@state(Field) secretHash: State<Field>;`
After the player makes a guess, the person who deployed the contract checks the answer, using their secret.  The secret is then hashed and checked against the hashed secret to ensure it is valid.

## TODOS
1.  Turn the game into 2 player, where each player can submit a secret and play against each other
2.  Add a timer, whereby the checker must check the score of the other player within a certain time or forfeit.  This would prevent a player from just not checking a winning guess.
3.  Add frontend UI

## How to build

```sh
npm run build
```
## How to run
```sh
npx tsc && node build/src/index.js/
```


## License

[Apache-2.0](LICENSE)
