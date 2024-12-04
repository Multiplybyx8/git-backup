const orderModel = require("../models/order.model");
const log = require("../middleware/logger");

const addOrder = async (req, res, next) => {
  const { headers, body } = req;
  const textMessage = "Add Order";
  try {
    const result = await orderModel.addOrderModel(body, headers);

    console.log("result", result);

    const response = {
      message: "success",
      api: `${textMessage}`,
      number: result ?? {}
    };

    const result_log = {};

    res.status(200).json(response);
    // await log.insertLog(req, res, result_log, `${textMessage} - ${result[0].order_no}`);
  } catch (error) {
    console.error(`Error api ${textMessage}:`, error.message);
    res.status(400).send({
      message: `An error occurred while : ${textMessage}`,
      error: error.message,
      data: {}
    });
    await log.insertLog(req, res, error.message, `${textMessage}`);
  }
};
const updateOrder = async (req, res, next) => {
  const { headers, body } = req;
  const textMessage = "Update Order";
  try {
    const result = await orderModel.updateOrderModel(body, headers);

    const response = {
      message: "success",
      api: `${textMessage}`,
      number: result ?? {}
    };

    const result_log = {};

    res.status(200).json(response);
    // await log.insertLog(req, res, result_log, `${textMessage} - ${result[0].order_no}`);
  } catch (error) {
    console.error(`Error api ${textMessage}:`, error.message);
    res.status(400).send({
      message: `An error occurred while : ${textMessage}`,
      error: error.message,
      data: {}
    });
    await log.insertLog(req, res, error.message, `${textMessage}`);
  }
};
const updatePaymentOrder = async (req, res, next) => {
  const { headers, body } = req;
  const textMessage = "Update Payment";
  try {
    const result = await orderModel.updatePaymentOrderModel(body, headers);

    const response = {
      message: "success",
      api: `${textMessage}`,
      number: result ?? {}
    };

    const result_log = {};

    res.status(200).json(response);
    // await log.insertLog(req, res, result_log, `${textMessage} - ${result[0].order_no}`);
  } catch (error) {
    console.error(`Error api ${textMessage}:`, error.message);
    res.status(400).send({
      message: `An error occurred while : ${textMessage}`,
      error: error.message,
      data: {}
    });
    await log.insertLog(req, res, error.message, `${textMessage}`);
  }
};
const updateTrackingOrder = async (req, res, next) => {
  const { headers, body } = req;
  const textMessage = "Update Tracking";
  try {
    const result = await orderModel.updateTrackingOrderModel(body, headers);

    const response = {
      message: "success",
      api: `${textMessage}`,
      trackingno: result ?? []
    };

    const result_log = {};

    res.status(200).json(response);
    // await log.insertLog(req, res, result_log, `${textMessage} - ${result[0].order_no}`);
  } catch (error) {
    console.error(`Error api ${textMessage}:`, error.message);
    res.status(400).send({
      message: `An error occurred while : ${textMessage}`,
      error: error.message,
      data: []
    });
    await log.insertLog(req, res, error.message, `${textMessage}`);
  }
};
const deleteOrder = async (req, res, next) => {
  const { headers, body } = req;
  const textMessage = "Delete Order";
  try {
    const result = await orderModel.deleteOrderModel(body, headers);

    const response = {
      message: "success",
      api: `${textMessage}`,
      number: result ?? {}
    };

    const result_log = {};

    res.status(200).json(response);
    // await log.insertLog(req, res, result_log, `${textMessage} - ${result[0].order_no}`);
  } catch (error) {
    console.error(`Error api ${textMessage}:`, error.message);
    res.status(400).send({
      message: `An error occurred while : ${textMessage}`,
      error: error.message,
      data: {}
    });
    await log.insertLog(req, res, error.message, `${textMessage}`);
  }
};

module.exports = {
  addOrder,
  updateOrder,
  updatePaymentOrder,
  updateTrackingOrder,
  deleteOrder
};
