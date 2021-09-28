import express from 'express';

import * as userController from '../controllers/user';

const router = express.Router();

router.post('/storeUserNFTs/:uid/:mainnet', userController.storeUserNFTsFromMoralis);

export default router;