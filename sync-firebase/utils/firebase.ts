import admin from 'firebase-admin'
import { getContract, getTokens } from './query'

const contracts = require('../../contracts.json')

require('dotenv').config({ path: __dirname + '/../../.env' })

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