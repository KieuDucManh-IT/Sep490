import express from 'express';

export const wishlistRouter = express.Router();
export const collectionRouter = express.Router();

wishlistRouter.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

collectionRouter.get('/', (req, res) => {
  res.json({ success: true, data: [] });
});

export default { wishlistRouter, collectionRouter };

