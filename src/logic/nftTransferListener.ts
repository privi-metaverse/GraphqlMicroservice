const { ethers } = require('ethers');
const axios = require('axios');

const infuraUrl = process.env.PROVIDER_URL;

const erc165Interface = [
  'function supportsInterface(bytes4 interfaceID) view returns (bool)',
];
const erc721Interface = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 _tokenId) view returns (string)',
];
const erc721InterfaceId = '0x80ac58cd';

const erc721TransferTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const erc1155TransferSingleTopic =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

function decodeAddressFromTopic(topic) {
  return ethers.utils.defaultAbiCoder.decode(['address'], topic);
}

function encodeAddressToTopic(address) {
  return ethers.utils.defaultAbiCoder.encode(['address'], [address]);
}

function erc721TranferLogsRequest(block, address) {
  return {
    jsonrpc: '2.0',
    method: 'eth_getLogs',
    params: [
      {
        fromBlock: block,
        toBlock: block,
        topics: [erc721TransferTopic, null, encodeAddressToTopic(address)],
      },
    ],
    id: '0',
  };
}

function fetchErc721TranfersLogs(blockNumber, address, endpoint) {
  return new Promise((resolve, reject) => {
    axios
      .post(endpoint, erc721TranferLogsRequest(blockNumber, address))
      .then((res) => {
        if (res.data.error) {
          reject(res.data.error.message);
        }
        resolve(res.data.result);
      })
      .catch((err) => reject(err));
  });
}

function isErc721(address, endpoint) {
  let provider;
  if (endpoint.substr(0, 1) === 'h')
    provider = new ethers.providers.JsonRpcProvider(endpoint);
  else if (endpoint.substr(0, 1) === 'w')
    provider = new ethers.providers.WebSocketProvider(endpoint);
  else return;

  return new Promise((resolve, reject) => {
    const contract = new ethers.Contract(address, erc165Interface, provider);
    contract
      .supportsInterface(erc721InterfaceId)
      .then((res) => resolve(res))
      .catch(() => resolve(false));
  });
}

async function fetchErc721Description(address, provider) {
  const contract = new ethers.Contract(address, erc721Interface, provider);
  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    return { name, symbol };
  } catch (err) {
    return null;
  }
}

async function fetchErc721Uri(address, id, provider) {
  const contract = new ethers.Contract(address, erc721Interface, provider);
  try {
    return await contract.tokenURI(id);
  } catch (err) {
    return null;
  }
}

const sanitizeIfIpfsUrl = (url) => {
  if (url.includes('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
};

async function fetchErc721Metadata(address, id, provider) {
  try {
    const uri = await fetchErc721Uri(address, id, provider);
    return await axios.get(sanitizeIfIpfsUrl(uri));
  } catch (err) {
    return null;
  }
}

async function formatDataFromErc721TransferLog(log, endpoint) {
  let provider;
  if (endpoint.substr(0, 1) === 'h')
    provider = new ethers.providers.JsonRpcProvider(endpoint);
  else if (endpoint.substr(0, 1) === 'w')
    provider = new ethers.providers.WebSocketProvider(endpoint);
  else return;

  const { address: token_address, topics } = log;
  const token_id = parseInt(topics[3], 16);
  return {
    token_address,
    token_id,
    ...(await fetchErc721Description(token_address, provider)),
    metadata: await fetchErc721Metadata(token_address, token_id, provider),
  };
}

function filterErc721Logs(logs, endpoint) {
  return logs.map(async (log) => {
    if (await isErc721(log.address, endpoint)) return log;
  });
}

export async function getErc721TokensReceived(hexBlock, userAddress, endpoint) {
  try {
    const logs = await fetchErc721TranfersLogs(hexBlock, userAddress, endpoint);
    const erc721Logs = filterErc721Logs(logs, endpoint);
    return erc721Logs.map(
      async (log) => await formatDataFromErc721TransferLog(log, endpoint)
    );
  } catch (err) {
    console.log('Log request failed, likely because of the node answer');
  }
}
