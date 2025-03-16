# 🐮 🧑‍🌾 Cowllector v2 🌾

This is the bot that harvest all strategies from all Beefy's chains:

**Cowllectors does NOT focus in to be profitable, so don't expect it to win some profit when it harvests. Cowllector harvest script was create it to bring resilience and consistency in all active vaults strategies, giving at least ONE harvest every 24 hour to every strat in every chain**

After every run of harvests in every chain, you can find the `harvest report` in our discord channel [#Harvester](https://discord.com/channels/755231190134554696/914666606641184768)

# 📖 Prerequisites

In order to run the project you need `node>=20.5`, `yarn>=1.22`, `docker` with the `docker compose v2` and `foundry` installed on our development machines

- Install foundry: https://book.getfoundry.sh/getting-started/installation

# 🖥️ Local development

To install the application:

```shell
yarn

# configure the app
cp .env.example .env
```

To start the report database:
  
```shell
yarn infra:start
yarn db:migrate
```

Work on a local fork

```shell
# start the fork, copy the generated private key to the .env file
anvil -f 'https://rpc.ankr.com/arbitrum' --accounts 3 --balance 300 --no-cors --block-time 5 --auto-impersonate
``` 

```shell
# harvest
LOG_LEVEL=debug yarn ts-node ./src/script/harvest.ts -c arbitrum

# Run harvest with pretty log parser (pino-pretty also has many formatting and filtering options)
LOG_LEVEL=trace yarn ts-node ./src/script/harvest.ts -c base | yarn pino-pretty > debug-pretty.log

# see harvest script options
yarn ts-node ./src/script/harvest.ts --help
```

```shell
# unwrap wnative to native
LOG_LEVEL=debug yarn ts-node ./src/script/unwrap.ts -c arbitrum

# see unwrap script options
yarn ts-node ./src/script/unwrap.ts --help
```

Use our inspect commands
  
```shell
# get the result of our lens contract 
LOG_LEVEL=debug yarn ts-node ./src/script/inspect/lens.ts -c zkevm -a 0x000000...
LOG_LEVEL=debug yarn ts-node ./src/script/inspect/lens.ts --help

# see a contract balance
LOG_LEVEL=debug yarn ts-node ./src/script/inspect/balance.ts -c zkevm -a 0x000000...
LOG_LEVEL=debug yarn ts-node ./src/script/inspect/balance.ts -help
```

Update the addressbook

```bash
yarn run ncu --upgrade blockchain-addressbook
yarn
```

Run all tests

```bash
yarn test
```

Deploy the lens contract 

```shell
# deploy and verify the lens contract
forge script contracts/script/DeployLens.s.sol:DeployLens -vvvvvv --slow --account deployer --verify --retries 5 --delay 10 --rpc-url chain --broadcast
```

# 🤝 Contributing

We encourage you to contribute to Cowllector!

We recommend to use [this commit convention](https://github.com/conventional-commits/conventionalcommits.org) that helps you write your commits in a way that is easy to understand and process by others.

In case you want to contribute, please follow next steps:

- fork this repo
- create a new branch and named using conventional commit reference
- commit your changes using conventional commit
- push your change in your forked repo
- createa a PR from your new branch directly to our `master` branch

## Adding a new chain

- update the addressbook and viem: `yarn update:addressbook`
- add the chain in `src/lib/addressbook.ts` if it's not in `blockchain-addressbook` already
- Fix TS errors `yarn test:ts`
  - update `src/lib/config.ts`
  - update `src/lib/rpc-client.ts` 
- apply migrations (only needed locally, migrations are applied on deploy): `yarn db:migrate`
- create an explorer api key (important to verify the lens contract later on)
- add the rpc url, explorer url and api key in `.env`
- inspect the final chain config: `LOG_LEVEL=error yarn --silent ts-node ./src/script/inspect/config.ts -c <chain>`
- test the api is working: `LOG_LEVEL=trace yarn --silent ts-node ./src/script/inspect/api.ts -h 0 -c <chain> > api.log`
- test we can get a contract balance: `LOG_LEVEL=trace yarn ts-node ./src/script/inspect/balance.ts -c <chain> -a <some address> > balance.log`
- test any on chain action with a fork: `anvil -f <rpc url> --accounts 3 --balance 300 --no-cors --block-time 5 --auto-impersonate`
- Deploy the lens contract: `forge script contracts/script/DeployLens.s.sol:DeployLens -vvvvvv --slow --account deployer --verify --retries 5 --delay 10 --rpc-url chain --broadcast`
    - if this errors try using foundry stable `foundryup --version stable`
    - if the contract verification failed, retry the `forge verify-contract --watch 0x34621B852357B318c75642D558cdC9866cB7F18B --rpc-url chain contracts/src/BeefyHarvestLens.sol:BeefyHarvestLens`
    - if that doesn't work, wait for the explorer to detect that this address is a contract, then retry
    - if that doesn't work, go to the explorer and verify manually
        - Grab the `standard-json-input` content of any other verified lens: `forge verify-contract --chain-id 2222 --num-of-optimizations 1000000 --verifier blockscout --verifier-url https://explorer.kava.io/api --etherscan-api-key a --watch --show-standard-json-input 0x2fD8E72e488d6D2Bc770Cf6F74A5d60E44516aaD BeefyHarvestLens > compile.json`
        - compiler type: standard json input
        - compiler version: see in `contracts/out/BeefyHarvestLens.sol/BeefyHarvestLens.json`
        - license: MIT
    - if that doesn't work, idk
- test we can lens a strategy: `LOG_LEVEL=trace yarn ts-node ./src/script/inspect/lens.ts -c <chain> -a <strat_address> > lens.log`
- test the harvest script: `LOG_LEVEL=trace yarn ts-node ./src/script/revenue-bridge-harvest.ts -c gnosis > revenue.log`
- test the harvest script: `LOG_LEVEL=trace yarn ts-node ./src/script/harvest.ts -c <chain> -a <strat_address> > harvest.log`
- test the unwrap script: `LOG_LEVEL=trace yarn ts-node ./src/script/unwrap.ts -c gnosis > unwrap.log`
- add a custom rpc url to our heroku deployment <CHAIN>_RPC_URL
- deploy the updated cowllector: `yarn deploy`

## Update monitoring

To update a dashboard:
- create or update a dashboard it directly in grafana
- export it as json
- put the json in `./analytics/dashboards/folders/` 
  - that will tell grafana to overwrite dashboards with this config on re-deploy

## 🍕 Community

- Got Questions? Join the conversation in our [Discord](https://discord.gg/yq8wfHd).
- Want to up to date with Beefy? Follow us in [Twitter](https://twitter.com/beefyfinance).
