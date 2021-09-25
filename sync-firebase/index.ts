import { initContracts, getNFTTokens } from './utils/firebase';
require('dotenv').config({ path: __dirname + '/../.env' })

initContracts();

setInterval(() => {
    getNFTTokens();
}, parseInt(process.env.BULK_PERIOD || '10000'));
