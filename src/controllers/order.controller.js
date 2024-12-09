const orderModel = require("../models/order.model");
const log = require("../middleware/logger");
const isEmpty = require("lodash.isempty");

/**
 * Handles API responses and logs errors.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} modelMethod - The model method to call.
 * @param {String} textMessage - The descriptive text for the operation.
 * @param {String} responseKey - The key for the response data.
 * @param {*} defaultResponse - The default value for the response key.
 */
const handleRequest = async (req, res, modelMethod, textMessage, responseKey = "so-number", defaultResponse = {}) => {
  const { headers, body, query } = req;

  console.log("req", req);

  try {
    const result = await modelMethod(body, headers, query);

    const response = {
      message: "success",
      api: textMessage,
      [responseKey]: result.number ?? defaultResponse,
      destination: isEmpty(result.status) ? "No destination link." : result.status
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(`Error in API ${textMessage}:`, error.message);

    res.status(400).send({
      message: `An error occurred while: ${textMessage}`,
      error: error.message,
      data: defaultResponse
    });

    await log.insertLog(req, res, error.message, textMessage);
  }
};

const addOrder = (req, res, next) => handleRequest(req, res, orderModel.addOrderModel, "Add Order");

const updateOrder = (req, res, next) => handleRequest(req, res, orderModel.updateOrderModel, "Update Order");

const updatePaymentOrder = (req, res, next) => handleRequest(req, res, orderModel.updatePaymentOrderModel, "Update Payment");

const updateTrackingOrder = (req, res, next) => handleRequest(req, res, orderModel.updateTrackingOrderModel, "Update Tracking", "trackingno", []);

const deleteOrder = (req, res, next) => handleRequest(req, res, orderModel.deleteOrderModel, "Delete Order");

module.exports = {
  addOrder,
  updateOrder,
  updatePaymentOrder,
  updateTrackingOrder,
  deleteOrder
};
