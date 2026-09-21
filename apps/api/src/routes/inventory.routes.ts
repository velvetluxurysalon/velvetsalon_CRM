import { Router } from 'express';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getPurchases, addPurchase,
  getUsage,    addUsage,
  getAlerts,   getStats,
} from '../controllers/inventory.controller.js';

const router = Router();

// Stats / alerts before /:id so they aren't caught as ID params
router.get('/stats',        getStats);
router.get('/alerts',       getAlerts);
router.get('/purchases',    getPurchases);
router.get('/usage',        getUsage);

router.get('/',             getProducts);
router.post('/',            createProduct);
router.get('/:id',          getProduct);
router.put('/:id',          updateProduct);
router.delete('/:id',       deleteProduct);

router.post('/:id/purchase', addPurchase);
router.post('/:id/usage',    addUsage);

export default router;