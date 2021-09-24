# Fetch-NFT

## Subgraph Legacy Explorer

Graph Explorer only provides ethereum mainnet. You can test the other networks in Legacy Explorer.
The Subgraph Legacy Explorer url: https://thegraph.com/legacy-explorer/dashboard
First, need to sign up with github user, and then create the subgraph project. The commands are as follows:

```bash
# install graph-cli
npm install -g @graphprotocol/graph-cli@0.20.1

# authenticate the legacy explorer
graph auth --product hosted-service https://api.thegraph.com/deploy/ <ACCESS TOKEN>

cd fetch-nft
graph codegen subgraph.yaml
graph build subgraph.yaml 

graph deploy  --product hosted-service --ipfs https://api.thegraph.com/ipfs/ --node https://api.thegraph.com/deploy/ <GITHUB_USER/SUBGRAPH_NAME>
```

## Contracts

- 0x88B48F654c30e99bc2e4A1559b4Dcf1aD93FA656
- 0xac5ebbbf4ebe1151827e33efcd1753b6b5870924 : Up Only Founders
- 0xaf7da83420df32bf17978cf3f66f677582c482b1