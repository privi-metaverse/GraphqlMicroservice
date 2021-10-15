const axios = require('axios');
var converter = require('hex2dec');

var hex = converter.decToHex('250'); // '0xfa'

// const endpoint =
//   'https://mainnet.infura.io/v3/8e011102fcf148d6aef3bc349e3c7cd0';
// const endpoint = 'https://bsc-dataseed.binance.org/';
const endpoint = 'https://rpc-mainnet.matic.network';

const block = converter.decToHex(19988180.toString());
// const block = '0x130FED4';
console.log(block);

axios
  .post(endpoint, {
    jsonrpc: '2.0',
    method: 'eth_getLogs',
    params: [
      {
        fromBlock: block,
        toBlock: block,
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          null,
          '0x000000000000000000000000714c282332fefc5efab73e34052de21b6b340a59',
        ],
      },
    ],
    id: '0',
  })
  .then((data) => console.log(data.data));
