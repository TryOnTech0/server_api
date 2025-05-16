const Cloth = require('../models/Cloth');



// Tüm kıyafetleri getir
const getAllClothes = async (req, res) => {
    try {
      const clothes = await Cloth.find();
      res.json(clothes);
    } catch (error) {
      res.status(500).json({ error: 'Veriler getirilirken hata oluştu.' });
    }
  };

  // Yeni kıyafet ekle
const addCloth = async (req, res) => {
    try {
      const { name, size, color, price } = req.body;
      const newCloth = new Cloth({ name, size, color, price });
      const savedCloth = await newCloth.save();
      res.status(201).json(savedCloth);
    } catch (error) {
      res.status(500).json({ error: 'Kıyafet eklenirken bir hata oluştu.' });
    }
  };

  //kıyafet sil
  const deleteCloth = async (req, res) => {
    try {
      const { id } = req.params;
      const deletedCloth = await Cloth.findByIdAndDelete(id);
  
      if (!deletedCloth) {
        return res.status(404).json({ message: 'Kıyafet bulunamadı' });
      }
  
      res.status(200).json({ message: 'Kıyafet başarıyla silindi' });
    } catch (error) {
      res.status(500).json({ error: 'Silme işlemi sırasında bir hata oluştu' });
    }
  };

  // GET /api/clothes/:id - Belirli kıyafeti getir
exports.getClothById = async (req, res) => {
    try {
      const cloth = await Cloth.findById(req.params.id);
      if (!cloth) return res.status(404).json({ message: 'Cloth not found' });
      res.json(cloth);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  // PUT /api/clothes/:id - Kıyafeti güncelle
exports.updateCloth = async (req, res) => {
    try {
      const updatedCloth = await Cloth.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedCloth) return res.status(404).json({ message: 'Cloth not found' });
      res.json(updatedCloth);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

module.exports = {
    getAllClothes,
    addCloth,
    deleteCloth,
    updateCloth,
    getClothById
};

