const express = require("express");
const router = express.Router();
require("dotenv").config();
const orderController = require("../controllers/order.controller");

router.post("/add", orderController.addOrder);
router.post("/update", orderController.updateOrder);
router.post("/update-payment", orderController.updatePaymentOrder);
router.post("/update-tracking", orderController.updateTrackingOrder);
router.post("/delete", orderController.deleteOrder);

module.exports = router;
