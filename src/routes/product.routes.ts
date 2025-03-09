import { Router } from 'express';
import { ProductService } from '../services/product/product.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const productService = new ProductService();

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, page, limit } = req.query;
    const products = await productService.getProducts({
      category: category as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

// Get product by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

// Create product (sellers only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, price, stock, category, images } = req.body;
    const sellerId = req.user.id; // From auth middleware
    
    const product = await productService.createProduct({
      name, 
      description, 
      price, 
      stock, 
      category,
      images,
      sellerId
    });
    
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la création du produit' });
  }
});

// Update product (seller only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const sellerId = req.user.id;
    
    // Verify product belongs to seller
    const isOwner = await productService.isProductOwnedBySeller(productId, sellerId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    const product = await productService.updateProduct(productId, req.body);
    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
});

// Delete product (seller only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const sellerId = req.user.id;
    
    // Verify product belongs to seller
    const isOwner = await productService.isProductOwnedBySeller(productId, sellerId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await productService.deleteProduct(productId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

export default router;