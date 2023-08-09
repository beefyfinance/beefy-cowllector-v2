

### install
    
```bash
yarn
```

Install foundry: https://book.getfoundry.sh/getting-started/installation

### Start a local fork

```bash
anvil -f https://rpc.ankr.com/eth --accounts 3 --balance 300 --no-cors
```


### update the addressbook

```bash
yarn run ncu --upgrade blockchain-addressbook
yarn
```