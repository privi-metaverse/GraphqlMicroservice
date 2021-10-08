import express from 'express';
import Moralis from 'moralis/node';
const { ethers } = require('ethers');
var converter = require('hex2dec');

import { getErc721TokensReceived } from '../logic/nftTransferListener';
import { db } from '../utils/firebase';
import collections from '../utils/collections';

const infuraUrl = process.env.PROVIDER_URL;
const provider = new ethers.providers.JsonRpcProvider(infuraUrl);

const fetchDocumentFromDb = async (collection, id) => {
  const document = await db.collection(collection).doc(id).get();
  return document.data();
};

const getSettings = (mainnet) => {
  const moralisKey = process.env.MORALIS_MAINNET_KEY;
  if (mainnet) {
    return {
      moralisKey,
      moralisServerURL: process.env.MORALIS_MAINNET_SERVER,
      chains: ['eth', 'matic', 'bsc'],
      chainsFullName: ['Mainnet', 'Matic', 'BSC'],
      masterCollection: collections.NftMasterCollectionMainnet,
      userCollection: collections.UserNFTMainnet,
    };
  } else {
    return {
      moralisKey,
      moralisServerURL: process.env.MORALIS_TESTNET_SERVER,
      chains: ['rinkeby', 'mumbai'],
      chainsFullName: ['Rinkeby', 'Mumbai'],
      masterCollection: collections.NftMasterCollectionTestnet,
      userCollection: collections.UserNFTTestnet,
    };
  }
};

const initializeMoralis = ({ moralisKey, moralisServerURL }) => {
  Moralis.initialize(moralisKey);
  Moralis.serverURL = moralisServerURL;
};

const initializeDatabase = async ({ userCollection }, uid) => {
  db.collection(userCollection).doc(uid).delete();
  await db.runTransaction(async (transaction) => {
    transaction.set(db.collection(userCollection).doc(uid), {
      id: uid,
    });
  });
};

const fetchUserNfts = async ({ chains }, address) => {
  const userEthNFTPromise = chains.map((chain) =>
    Moralis.Web3API.account.getNFTs({ address, chain })
  );
  return await Promise.all(userEthNFTPromise);
};

const sanitizeIfIpfsUrl = (url) => {
  if (url.includes('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
};

const filterNftsWithImage = (nfts, chain) => {
  return nfts
    .map((nft) => {
      const nftWithData = {
        ...nft,
        chainsFullName: chain,
      };

      let dataFound = false;

      try {
        nft.metadata = JSON.parse(nft.metadata);
      } catch (err) {
        console.log('cant parse metadata from ERC721 NFT, error: ' + err);
        return null;
      }

      if (!nft.metadata) {
        return null;
      }

      // Check for various NFT format fields in metadata (image, animation)
      if ('animation_url' in nft.metadata && nft.metadata.animation_url) {
        nftWithData.animation_url = sanitizeIfIpfsUrl(
          nft.metadata.animation_url
        );
        dataFound = true;
      }
      if ('image' in nft.metadata && nft.metadata.image) {
        nftWithData.content_url = sanitizeIfIpfsUrl(nft.metadata.image);
        dataFound = true;
      }

      if (dataFound) {
        return nftWithData;
      }
    })
    .filter((element) => {
      if (element !== null) return element;
    });
};

const writeNftsIntoDb = async (uid, userNFTsWithData, settings) => {
  const createdCollections: string[] = [];
  const createdUserAddresses: string[] = [];

  for (const nft of userNFTsWithData) {
    if (!nft) continue;
    // Fills the collection data
    // if we did now already processed this nft
    if (!createdCollections.includes(nft.token_address)) {
      const nftCollectionData = fetchDocumentFromDb(
        settings.masterCollection,
        nft.token_address
      );
      // if this nft is not already on the db
      if (!nftCollectionData) {
        await db.runTransaction(async (transaction) => {
          transaction.set(
            db.collection(settings.masterCollection).doc(nft.token_address),
            {
              Chain: nft.chainsFullName,
              Name: nft.name,
              Symbol: nft.symbol,
            }
          );
        });
      }
      createdCollections.push(nft.token_address);
    }

    // Fills the nft data
    const nftMasterNFTAddressRef = await db
      .collection(settings.masterCollection)
      .doc(nft.token_address)
      .collection('NFT')
      .doc(nft.token_id)
      .get();
    const nftMasterNFTAddressData = nftMasterNFTAddressRef.data();

    if (!nftMasterNFTAddressData) {
      await db.runTransaction(async (transaction) => {
        transaction.set(
          db
            .collection(settings.masterCollection)
            .doc(nft.token_address)
            .collection('NFT')
            .doc(nft.token_id),
          nft
        );
      });
    }

    // save the nft collection address in the user's owned collection
    if (!createdUserAddresses.includes(nft.token_address)) {
      const nftUserRef = await db
        .collection(settings.userCollection)
        .doc(uid)
        .collection('Owned')
        .doc(nft.token_address)
        .get();
      const nftUserData = nftUserRef.data();
      if (!nftUserData) {
        await db.runTransaction(async (transaction) => {
          transaction.set(
            db
              .collection(settings.userCollection)
              .doc(uid)
              .collection('Owned')
              .doc(nft.token_address),
            {
              address: nft.token_address,
            }
          );
        });
      }
      createdUserAddresses.push(nft.token_address);
    }

    // save the nft id in the user's owned collection > nft collection address
    await db.runTransaction(async (transaction) => {
      transaction.set(
        db
          .collection(settings.userCollection)
          .doc(uid)
          .collection('Owned')
          .doc(nft.token_address)
          .collection(collections.collectionIds)
          .doc(nft.token_id),
        {
          Id: nft.token_id,
        }
      );
    });
  }
};

const launchNewTokenReceivedListener = (
  network,
  userAddress,
  uid,
  settings
) => {
  let endpoint;
  switch (network) {
    case 'Mainnet':
      endpoint = process.env.MAINNET_PROVIDER_URL;
      break;
    case 'Matic':
      endpoint = process.env.MATIC_PROVIDER_URL;
      break;
    case 'BSC':
      endpoint = process.env.BSC_PROVIDER_URL;
      break;
    case 'Rinkeby':
      endpoint = process.env.RINKEBY_PROVIDER_URL;
      break;
    case 'Mumbai':
      endpoint = process.env.MUMBAI_PROVIDER_URL;
      break;
  }
  const provider = new ethers.providers.JsonRpcProvider(endpoint);

  return provider.on('block', async (blockNumber) => {
    const hexBlockNumber = converter.decToHex(String(blockNumber));
    console.log(`Block ${blockNumber} or ${hexBlockNumber} from ${network}`);

    const nftsReceived = await getErc721TokensReceived(
      hexBlockNumber,
      userAddress,
      endpoint
    );
    if (!nftsReceived || nftsReceived.length === 0) return;

    const userNFTsWithData = [...filterNftsWithImage(nftsReceived, network)];
    try {
      await writeNftsIntoDb(uid, userNFTsWithData, settings);
    } catch (err) {
      console.log(err);
    }
  });
};

export const storeUserNFTsFromMoralis = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { uid, mainnet }: { uid: string; mainnet: boolean } = req.body;

    const userData = await fetchDocumentFromDb(collections.user, uid);

    if (!userData) {
      res.send({ success: false, message: 'cant find user with given uid' });
      return;
    }

    const { address: userAddress } = userData;
    // const userAddress = '0x714c282332fefc5efab73e34052de21b6b340a59';
    const settings = getSettings(mainnet);

    initializeMoralis(settings);
    initializeDatabase(settings, uid);

    const userEthNFTResult = await fetchUserNfts(settings, userAddress);

    let userNFTsWithData: any[] = [];
    // loops around the return of the different networks
    for (let i = 0; i < userEthNFTResult.length; i++) {
      const reponseForCurrentNetwork: any = userEthNFTResult[i];

      if (reponseForCurrentNetwork.result.length === 0) {
        continue;
      }

      userNFTsWithData = [
        ...filterNftsWithImage(
          reponseForCurrentNetwork.result,
          settings.chainsFullName[i]
        ),
      ];
    }

    await writeNftsIntoDb(uid, userNFTsWithData, settings);

    settings.chainsFullName.forEach((network) =>
      launchNewTokenReceivedListener(network, userAddress, uid, settings)
    );

    res.send({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).send({ success: false, message: 'Error' });
  }
  return false;
};

// Master collection check if the collection with address exist if yes go to nft and check if nft is there if add id to nft in address

// proceed to user collection go to owned add address then ids and create document with just id
