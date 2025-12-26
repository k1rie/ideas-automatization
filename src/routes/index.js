const express = require('express');
const router = express.Router();
const contactsController = require('../controllers/contactsController');

// Rutas para contactos
router.get('/contacts', contactsController.getAllContacts);
router.get('/contacts/:contactId', contactsController.getContactById);
router.post('/contacts/:contactId/analyze', contactsController.analyzeContact);
router.post('/contacts/analyze-all', contactsController.analyzeAllContacts);

module.exports = router;


