# Fetch-NFT

## Introduction

You can manage the bulk count of a cycle and bulk period through the environment variables (`BULK_COUNT`, `BULK_PERIOD`) defined in `.env`.

```bash
npm run dev
```

## Subgraph Legacy Explorer

Graph Explorer only provides ethereum mainnet. You can test the other networks in Legacy Explorer.
The Subgraph Legacy Explorer url: https://thegraph.com/legacy-explorer/dashboard
First, need to sign up with github user, and then create the subgraph project. The commands are as follows:

```bash
# install graph-cli
npm install -g @graphprotocol/graph-cli@0.20.1

# authenticate the legacy explorer
graph auth --product hosted-service https://api.thegraph.com/deploy/ <ACCESS TOKEN>

cd subgraph-nft
graph codegen subgraph.yaml
graph build subgraph.yaml 

graph deploy  --product hosted-service --ipfs https://api.thegraph.com/ipfs/ --node https://api.thegraph.com/deploy/ <GITHUB_USER/SUBGRAPH_NAME>
```

## Contracts
- 0xf8a7b3cb7427e68154862df3ae96687bbfac8f47 : cryptopunks
- 0x43d29d6dc3346a812b10b572ffb52fc7668bf8ba : cryptokitties 
- 0xA08126f5E1ED91A635987071E6FF5EB2aEb67C48 : galaxy_eggs