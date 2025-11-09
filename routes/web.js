import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/stores', (req, res) => {
  res.render('stores');
});

router.get('/stores/:name(*)', (req, res) => {
  res.render('store-detail', { storeName: req.params.name });
});

export default router;
