// const orderModel = require("../models/order.model");
// const log = require("../middleware/logger");

// const addOrder = async (req, res, next) => {
//   const { headers, body } = req;
//   const textMessage = "Add Order";
//   try {
//     const result = await orderModel.addOrderModel(body, headers);

//     console.log("result", result);

//     const response = {
//       message: "success",
//       api: `${textMessage}`,
//       number: result ?? {}
//     };

//     res.status(200).json(response);
//   } catch (error) {
//     console.error(`Error api ${textMessage}:`, error.message);
//     res.status(400).send({
//       message: `An error occurred while : ${textMessage}`,
//       error: error.message,
//       data: {}
//     });
//     await log.insertLog(req, res, error.message, `${textMessage}`);
//   }
// };
// const updateOrder = async (req, res, next) => {
//   const { headers, body } = req;
//   const textMessage = "Update Order";
//   try {
//     const result = await orderModel.updateOrderModel(body, headers);

//     const response = {
//       message: "success",
//       api: `${textMessage}`,
//       number: result ?? {}
//     };

//     res.status(200).json(response);
//   } catch (error) {
//     console.error(`Error api ${textMessage}:`, error.message);
//     res.status(400).send({
//       message: `An error occurred while : ${textMessage}`,
//       error: error.message,
//       data: {}
//     });
//     await log.insertLog(req, res, error.message, `${textMessage}`);
//   }
// };
// const updatePaymentOrder = async (req, res, next) => {
//   const { headers, body } = req;
//   const textMessage = "Update Payment";
//   try {
//     const result = await orderModel.updatePaymentOrderModel(body, headers);

//     const response = {
//       message: "success",
//       api: `${textMessage}`,
//       number: result ?? {}
//     };

//     res.status(200).json(response);
//   } catch (error) {
//     console.error(`Error api ${textMessage}:`, error.message);
//     res.status(400).send({
//       message: `An error occurred while : ${textMessage}`,
//       error: error.message,
//       data: {}
//     });
//     await log.insertLog(req, res, error.message, `${textMessage}`);
//   }
// };
// const updateTrackingOrder = async (req, res, next) => {
//   const { headers, body } = req;
//   const textMessage = "Update Tracking";
//   try {
//     const result = await orderModel.updateTrackingOrderModel(body, headers);

//     const response = {
//       message: "success",
//       api: `${textMessage}`,
//       trackingno: result ?? []
//     };

//     res.status(200).json(response);
//   } catch (error) {
//     console.error(`Error api ${textMessage}:`, error.message);
//     res.status(400).send({
//       message: `An error occurred while : ${textMessage}`,
//       error: error.message,
//       data: []
//     });
//     await log.insertLog(req, res, error.message, `${textMessage}`);
//   }
// };
// const deleteOrder = async (req, res, next) => {
//   const { headers, body } = req;
//   const textMessage = "Delete Order";
//   try {
//     const result = await orderModel.deleteOrderModel(body, headers);

//     const response = {
//       message: "success",
//       api: `${textMessage}`,
//       number: result ?? {}
//     };

//     res.status(200).json(response);
//   } catch (error) {
//     console.error(`Error api ${textMessage}:`, error.message);
//     res.status(400).send({
//       message: `An error occurred while : ${textMessage}`,
//       error: error.message,
//       data: {}
//     });
//     await log.insertLog(req, res, error.message, `${textMessage}`);
//   }
// };

// module.exports = {
//   addOrder,
//   updateOrder,
//   updatePaymentOrder,
//   updateTrackingOrder,
//   deleteOrder
// };

const orderModel = require("../models/order.model");
const log = require("../middleware/logger");

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
  const { headers, body } = req;

  try {
    const result = await modelMethod(body, headers);

    const response = {
      message: "success",
      api: textMessage,
      [responseKey]: result ?? defaultResponse
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
