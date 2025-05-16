const express = require('express');
const router = express.Router();
const clothesController = require('../controllers/clothesController');

// POST /api/clothes - Yeni kıyafet oluştur
router.post('/', clothesController.addCloth);

// GET /api/clothes - Tüm kıyafetleri getir
router.get('/', clothesController.getAllClothes);

// GET /api/clothes/:id - Belirli kıyafeti getir
router.get('/:id', clothesController.getClothById);

// PUT /api/clothes/:id - Belirli kıyafeti güncelle
router.put('/:id', clothesController.updateCloth);

// DELETE /api/clothes/:id - Belirli kıyafeti sil
router.delete('/:id', clothesController.deleteCloth);


module.exports = router;
