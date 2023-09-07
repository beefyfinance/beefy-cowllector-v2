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
# get a seed
LOG_LEVEL=fatal node -r ts-node/register ./src/script/deploy/seed.ts -c bsc
LOG_LEVEL=fatal node -r ts-node/register ./src/script/deploy/seed.ts --help

# deploy and verify the lens contract
LOG_LEVEL=trace node -r ts-node/register ./src/script/deploy/deploy-lens.ts -s 0x000000000... -c bsc
LOG_LEVEL=trace node -r ts-node/register ./src/script/deploy/deploy-lens.ts -help
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

## 🍕 Community

- Got Questions? Join the conversation in our [Discord](https://discord.gg/yq8wfHd).
- Want to up to date with Beefy? Follow us in [Twitter](https://twitter.com/beefyfinance).
