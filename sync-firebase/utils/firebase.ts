import admin from 'firebase-admin'
import {getContract, getTokens} from './query'


import collections from "./collections";
const Moralis = require('moralis/node')
const axios = require('axios');

const contracts = require('../../contracts.json')

require('dotenv').config({path: __dirname + '/../../.env'})

const getFileTypeTimeout = 3000;

interface Contract {
    BaseUri: string
    address: string
    Chain: string
    Name: string
    Symbol: string
}

function getStore() {
    if (admin.apps.length == 0) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASESDK_PROJECT_ID,
                privateKey: process.env.FIREBASESDK_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASESDK_CLIENT_EMAIL,
            }),
        })
    }

    return admin.firestore()
}

export const initContracts = async () => {
    const store = getStore()

    contracts.forEach(async (contract: Contract) => {
        try {
            const data = await getContract(contract.BaseUri, contract.address)

            await store.collection('NftMasterCollection').doc(contract.address).set(
                {
                    "BaseUri": contract.BaseUri,
                    "Chain": contract.Chain,
                    "Name": data['name'],
                    "Symbol": data['symbol']
                },
                {merge: true}
            );
        } catch (error) {
            console.log('eee: ', error)
        }
    });

}

const getNFTUsers = async () => {
    const store = getStore()

    const users: { [index: string]: any } = {};

    (await store.collection('UserNFT').get()).docs.forEach((doc) => {
        if (doc.data().address) users[doc.data().address] = doc.id
    })

    return users
}

const stringContainsArrayItem = (str: string, arr: string[]) => {
    return arr.some(v => str.includes(v));
};

const getIPFSFileType = async (url: string) => {
    try {
        const response = await axios.head(url, {timeout: getFileTypeTimeout});
        if (response.headers['content-type']) {
            return response.headers['content-type'];
        }
    } catch (err) {
        return null;
    }
};

const storeUserNFTsFromMoralis = async (uid: string) => {
    try {
        const db = getStore();

        Moralis.initialize(process.env.MORALIS_KEY);
        Moralis.serverURL = process.env.MORALIS_SERVER;

        const userSnap = await db.collection(collections.user).doc(uid).get();
        const userData: any = userSnap.data();

        if (userData == null) {
            console.log('cant find user with given uid');
            return null;
        }

        const address = userData.address;

        const userEthNFTs = await Moralis.Web3API.account.getNFTs({address: address});

        const userNFTsWithData: any[] = [];

        if (userEthNFTs != null) {
            const allowedExtensions: string[] = ['.mp4', '.mp3', '.jpg', 'jpeg', '.png', '.ogg', '.tiff', '.tif', '.bmp', '.wav', '.aac', '.flac', '.gif', 'ipfs://'];
            for (const nft of userEthNFTs.result) {

                const ob: any = {...nft};

                let dataFound = false;

                try {
                    nft.metadata = JSON.parse(nft.metadata);

                    if (nft.metadata != null) {
                        // Check for various NFT format fields in metadata (image, animation)
                        if (
                            'animation_url' in nft.metadata &&
                            nft.metadata.animation_url &&
                            stringContainsArrayItem(nft.metadata.animation_url, allowedExtensions)
                        ) {
                            if (nft.metadata.animation_url.includes('ipfs://')) {
                                nft.metadata.animation_url = nft.metadata.animation_url.replace('ipfs://', 'https://ipfs.io/ipfs/');
                            }
                            ob.animation_type = await getIPFSFileType(nft.metadata.animation_url);
                            ob.animation_url = nft.metadata.animation_url;
                            dataFound = true;
                        }

                        if (
                            'image' in nft.metadata &&
                            nft.metadata.image &&
                            stringContainsArrayItem(nft.metadata.image, allowedExtensions)
                        ) {
                            if (nft.metadata.image.includes('ipfs://')) {
                                nft.metadata.image = nft.metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
                            }
                            ob.content_type = await getIPFSFileType(nft.metadata.image);
                            ob.content_url = nft.metadata.image;
                            dataFound = true;
                        }

                        if (dataFound) {
                            userNFTsWithData.push(ob);
                        }
                    }
                } catch
                    (err) {
                    console.log('cant parse metadata from ERC721 NFT, error: ' + err);
                }

                // If data was not found in metadata, maybe it's in token_uri
                if (!dataFound && stringContainsArrayItem(nft.token_uri, allowedExtensions)) {
                    if (nft.token_uri.includes('ipfs://')) {
                        nft.token_uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
                    }
                    ob.content_type = await getIPFSFileType(nft.token_uri);
                    ob.content_url = nft.token_uri;
                    userNFTsWithData.push(ob);
                }
            }

            db.collection(collections.UserNFTTest).doc(uid).delete();

            await db.runTransaction(async transaction => {
                transaction.set(db.collection(collections.UserNFTTest).doc(uid),
                    {
                        id: uid,
                    });
            });

            const createdCollections: string[] = [];
            const createdMasterAddresses: string[] = [];
            const createdUserAddresses: string[] = [];

            for (const nft of userNFTsWithData) {
                if (nft == null)
                    continue;

                if (!createdCollections.includes(nft.token_address)) {
                    const nftCollectionRef = await db.collection(collections.NftMasterCollectionTest).doc(nft.token_address).get();
                    const nftCollectionData = nftCollectionRef.data();

                    if (nftCollectionData == null) {
                        await db.runTransaction(async transaction => {
                            transaction.set(db.collection(collections.NftMasterCollectionTest).doc(nft.token_address),
                                {
                                    Chain: 'Ethereum',
                                    Name: nft.name,
                                    Symbol: nft.symbol,
                                });
                        });
                    }

                    createdCollections.push(nft.token_address);
                }

                if(!createdMasterAddresses.includes(nft.token_address)){
                    const nftMasterRef = await db.collection(collections.NftMasterCollectionTest).doc(nft.token_address).get();
                    const nftMasterData = nftMasterRef.data();

                    if (nftMasterData == null) {
                        await db.runTransaction(async transaction => {
                            transaction.set(db.collection(collections.NftMasterCollectionTest).doc(nft.token_address),
                                {address: nft.token_address});
                        });
                    }

                    createdMasterAddresses.push(nft.token_address);
                }


                const nftMasterNFTAddressRef = await db.collection(collections.NftMasterCollectionTest).doc(nft.token_address).collection('NFT').doc(nft.token_id).get();
                const nftMasterNFTAddressData = nftMasterNFTAddressRef.data();

                if(nftMasterNFTAddressData == null){
                    await db.runTransaction(async transaction => {
                        transaction.set(db.collection(collections.NftMasterCollectionTest).doc(nft.token_address).collection('NFT').doc(nft.token_id),
                            nft);
                    });
                }

                if(!createdUserAddresses.includes(nft.token_address)){
                    const nftUserRef = await db.collection(collections.UserNFTTest).doc(uid).collection('Owned').doc(nft.token_address).get();
                    const nftUserData = nftUserRef.data();

                    if(nftUserData == null){
                        await db.runTransaction(async transaction => {
                            transaction.set(db.collection(collections.UserNFTTest).doc(uid).collection('Owned').doc(nft.token_address),
                                {
                                    address: nft.token_address,
                                });
                        });
                    }

                    createdUserAddresses.push(nft.token_address);
                }

                await db.runTransaction(async transaction => {
                    transaction.set(db.collection(collections.UserNFTTest).doc(uid).collection('Owned').doc(nft.token_address).collection(collections.collectionIds).doc(nft.token_id),
                        {
                            Id: nft.token_id,
                        });
                });
            }
            return true;
        }
    } catch (e) {
        console.log(e);
    }
    return false;
};


export const getNFTTokens = async () => {
    const store = getStore();
    const users = await getNFTUsers();

    contracts.forEach(async (contract: Contract) => {
        try {
            const count = (await store.collection('NftMasterCollection').doc(contract.address).collection('NFT').get()).docs.length;
            const tokens: [any] = await getTokens(contract.BaseUri, count, parseInt(process.env.BULK_COUNT || '5'));
            tokens.forEach(async (token) => {
                await store.collection('NftMasterCollection').doc(contract.address).collection('NFT').doc(token.identifier).set(
                    {
                        "imageUrl": token.uri,
                        "owner": token.owner.id,
                    },
                    {merge: true}
                );

                if (users[token.owner.id]) {
                    await store.collection('UserNFT').doc(users[token.owner.id]).collection('Owned').doc(token.id.replace('/', '-')).set(
                        {
                            "address": contract.address,
                            "identifier": token.identifier,
                            "imageUrl": token.uri
                        },
                        {merge: true}
                    )
                }
            });
        } catch (error) {
            console.log('error: ', error)
        }
    });
}