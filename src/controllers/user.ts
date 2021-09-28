import express from "express";
import Moralis from 'moralis/node';

import { db } from '../utils/firebase';
import collections from '../utils/collections';

export const storeUserNFTsFromMoralis = async (req: express.Request, res: express.Response) => {
  try {
    const { uid, mainnet } = req.params;
    let settings: any;

    const userSnap = await db.collection(collections.user).doc(uid).get();
    const userData: any = userSnap.data();

    if (!userData) {
      res.send({ success: false, message: 'cant find user with given uid' });
      return;
    }

    const address = userData.address;

    if (mainnet) {
      settings = {
        moralisKey: process.env.MORALIS_MAINNET_KEY,
        moralisServerURL: process.env.MORALIS_MAINNET_SERVER,
        chains: ['eth', 'matic', 'bsc'],
        chainsFullName: ['Mainnet', 'Matic', 'BSC'],
        masterCollection: collections.NftMasterCollectionMainnet,
        userCollection: collections.UserNFTMainnet,
      };
    } else {
      settings = {
        moralisKey: process.env.MORALIS_TESTNET_KEY,
        moralisServerURL: process.env.MORALIS_TESTNET_SERVER,
        chains: ['rinkeby', 'mumbai'],
        chainsFullName: ['Rinkeby', 'Mumbai'],
        masterCollection: collections.NftMasterCollectionTestnet,
        userCollection: collections.UserNFTTestnet,
      };
    }

    Moralis.initialize(settings.moralisKey);
    Moralis.serverURL = settings.moralisServerURL;

    db.collection(settings.userCollection).doc(uid).delete();
    await db.runTransaction(async transaction => {
      transaction.set(db.collection(settings.userCollection).doc(uid),
        {
          id: uid,
        });
    });

    const userNFTsWithData: any[] = [];

    const userEthNFTPromise = settings.chains.map(chain => Moralis.Web3API.account.getNFTs({ address, chain }));
    const userEthNFTResult = await Promise.all(userEthNFTPromise);

    for (let i = 0; i < userEthNFTResult.length; i++) {
      const userEthNFTs: any = userEthNFTResult[i];

      if (userEthNFTs) {

        for (const nft of userEthNFTs.result) {
          const ob: any = { ...nft, chainsFullName: settings.chainsFullName[i] };
          let dataFound = false;
          try {
            nft.metadata = JSON.parse(nft.metadata);

            if (nft.metadata) {
              // Check for various NFT format fields in metadata (image, animation)
              if ( 'animation_url' in nft.metadata && nft.metadata.animation_url) {
                if (nft.metadata.animation_url.includes('ipfs://')) {
                  nft.metadata.animation_url = nft.metadata.animation_url.replace('ipfs://', 'https://ipfs.io/ipfs/');
                }
                ob.animation_url = nft.metadata.animation_url;
                dataFound = true;
              }

              if ('image' in nft.metadata && nft.metadata.image) {
                if (nft.metadata.image.includes('ipfs://')) {
                  nft.metadata.image = nft.metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
                }
                ob.content_url = nft.metadata.image;
                dataFound = true;
              }

              if (dataFound) {
                userNFTsWithData.push(ob);
              }
            }
          } catch (err) {
            console.log('cant parse metadata from ERC721 NFT, error: ' + err);
            res.send({ success: false, message: "Can't parse metadata from ERC721 NFT" });
          }
        }
      }
    }

    const createdCollections: string[] = [];
    const createdMasterAddresses: string[] = [];
    const createdUserAddresses: string[] = [];

    for (const nft of userNFTsWithData) {
      if (!nft)
        continue;

      if (!createdCollections.includes(nft.token_address)) {
        const nftCollectionRef = await db.collection(settings.masterCollection).doc(nft.token_address).get();
        const nftCollectionData = nftCollectionRef.data();

        if (!nftCollectionData) {
          await db.runTransaction(async transaction => {
            transaction.set(db.collection(settings.masterCollection).doc(nft.token_address),
              {
                Chain: nft.chainsFullName,
                Name: nft.name,
                Symbol: nft.symbol,
              });
          });
        }

        createdCollections.push(nft.token_address);
      }

      if (!createdMasterAddresses.includes(nft.token_address)) {
        const nftMasterRef = await db.collection(settings.masterCollection).doc(nft.token_address).get();
        const nftMasterData = nftMasterRef.data();

        if (nftMasterData == null) {
          await db.runTransaction(async transaction => {
            transaction.set(db.collection(settings.masterCollection).doc(nft.token_address),
              { address: nft.token_address });
          });
        }

        createdMasterAddresses.push(nft.token_address);
      }


      const nftMasterNFTAddressRef = await db.collection(settings.masterCollection).doc(nft.token_address).collection('NFT').doc(nft.token_id).get();
      const nftMasterNFTAddressData = nftMasterNFTAddressRef.data();

      if (nftMasterNFTAddressData == null) {
        await db.runTransaction(async transaction => {
          transaction.set(db.collection(settings.masterCollection).doc(nft.token_address).collection('NFT').doc(nft.token_id),
            nft);
        });
      }

      if (!createdUserAddresses.includes(nft.token_address)) {
        const nftUserRef = await db.collection(settings.userCollection).doc(uid).collection('Owned').doc(nft.token_address).get();
        const nftUserData = nftUserRef.data();

        if (nftUserData == null) {
          await db.runTransaction(async transaction => {
            transaction.set(db.collection(settings.userCollection).doc(uid).collection('Owned').doc(nft.token_address),
              {
                address: nft.token_address,
              });
          });
        }

        createdUserAddresses.push(nft.token_address);
      }

      await db.runTransaction(async transaction => {
        transaction.set(db.collection(settings.userCollection).doc(uid).collection('Owned').doc(nft.token_address).collection(collections.collectionIds).doc(nft.token_id),
          {
            Id: nft.token_id,
          });
      });
    }

    res.send({ success: true });
  } catch (e) {
    console.log(e);
    res.send({ success: false, message: "Error" });
  }
  return false;
};