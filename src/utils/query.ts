const axios = require('axios')

export const getContract = async (url: string, address: string) => {
    console.log(`init contract ${address} - ${url}`);

    const data = JSON.stringify({
        query: `query erc721Contract ($address: String) {
            erc721Contract (id: $address) {
                  name
                  symbol
                  id
              }
        }`,
        variables: {
            address: address,
        },
    })

    const response = await axios.post(url, data, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
        },
        data: data,
    });
    
    return response.data.data?.erc721Contract
}

export const getTokens = async (url: string, skip: number, first: number) => {
    console.log(`fetch start ${url} - ${skip}`);

    const data = JSON.stringify({
        query: `query erc721Tokens ($skip: Int, $first: Int) {
            erc721Tokens (skip: $skip, first: $first) {
                id
                identifier
                uri
                owner {
                  id
                }
              }
        }`,
        variables: {
            skip: skip,
            first: first,
        },
    })

    const response = await axios.post(url, data, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1',
        },
    })

    return response.data.data?.erc721Tokens
}
