// const axios = require("axios");
// const https = require("https");
// const moment = require("moment");
// require("dotenv").config();
// const isEmpty = require("lodash.isempty");
// const log = require("../middleware/logger");
// const dateHelper = require("../helpers/dateHelper");
// const db = require("../services/connectionService");

// const addOrderModel = async (body, headers) => {
//   const connection = await db.getConnection();
//   try {
//     if (!isEmpty(body)) {
//       await responseResultOrder(body, headers);
//       return body.number;
//     }
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };
// const updateOrderModel = async (body, headers) => {
//   const connection = await db.getConnection();
//   try {
//     if (!isEmpty(body)) {
//       await responseResultOrder(body, headers);
//       return body.number;
//     }
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };
// const updatePaymentOrderModel = async (body, headers) => {
//   const connection = await db.getConnection();
//   try {
//     if (!isEmpty(body)) {
//       await responseResultOrder(body, headers);
//       return body.number;
//     }
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };
// const updateTrackingOrderModel = async (body, headers) => {
//   const connection = await db.getConnection();
//   try {
//     if (!isEmpty(body)) {
//       await responseResultOrder(body, headers);
//       // [{"trackingno":"THP0001","trackingurl":"","shippingdate":null}]
//       const result = body.map((item) => item.trackingno);
//       return result;
//     }
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };
// const deleteOrderModel = async (body, headers) => {
//   const connection = await db.getConnection();
//   try {
//     if (!isEmpty(body)) {
//       await responseResultOrder(body, headers);
//       return body.number;
//     }
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };

// const getUrl = async () => {
//   const connection = await db.getConnection();
//   try {
//     const query = "SELECT url FROM web_links WHERE active = 1";
//     const [data] = await connection.query(query);
//     return data.length > 0 ? { result: data } : null;
//   } catch (error) {
//     throw error;
//   } finally {
//     connection?.release();
//   }
// };

// const responseResultOrder = async (body, headers) => {
//   const url = await getUrl();
//   console.log("url", url);

//   if (!isEmpty(url)) {
//     for (const link of url?.result) {
//       return axios({
//         method: "post",
//         url: `${link.url}`,
//         headers: { headers },
//         data: { body },
//         httpsAgent: new https.Agent({ rejectUnauthorized: false })
//       })
//         .then((response) => {
//           return response;
//         })
//         .catch((error) => {
//           console.log(error.response.data.message);
//           throw new Error(error.response.data.message);
//         });
//     }
//   }
// };

// module.exports = {
//   addOrderModel,
//   updateOrderModel,
//   updatePaymentOrderModel,
//   updateTrackingOrderModel,
//   deleteOrderModel
// };

const axios = require("axios");
const https = require("https");
const isEmpty = require("lodash.isempty");
const db = require("../services/connectionService");

// Helper function to handle database connections
const withDbConnection = async (callback) => {
  const connection = await db.getConnection();
  try {
    return await callback(connection);
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};

// Base model for order operations
const orderModelBase = async (body, headers, processCallback) => {
  if (isEmpty(body)) return null;

  const resultOrder = await responseResultOrder(body, headers);
  const resultData = {
    number: processCallback ? processCallback(body) : body.number,
    status: resultOrder == null ? null : resultOrder
  };

  return resultData;
};

// Generic order models
const addOrderModel = (body, headers) => orderModelBase(body, headers);
const updateOrderModel = (body, headers) => orderModelBase(body, headers);
const updatePaymentOrderModel = (body, headers) => orderModelBase(body, headers);
const updateTrackingOrderModel = (body, headers) => orderModelBase(body, headers, (body) => body.map((item) => item.trackingno));
const deleteOrderModel = (body, headers) => orderModelBase(body, headers);

// Fetch active URLs from the database
const getUrl = () =>
  withDbConnection(async (connection) => {
    const query = "SELECT url FROM web_links WHERE active = 1";
    const [data] = await connection.query(query);
    return data.length > 0 ? { result: data } : null;
  });

// Send data to external URLs
const responseResultOrder = async (body, headers) => {
  const urlData = await getUrl();

  if (isEmpty(urlData)) return null;
  const { result: urls } = urlData;
  const responses = [];

  for (const { url } of urls) {
    try {
      const trimmedUrl = url.trim();
      // const response = await axios({
      //   method: "post",
      //   url,
      //   headers,
      //   data: body,
      //   httpsAgent: new https.Agent({ rejectUnauthorized: false })
      // });
      console.log("method:", "post\n", "url:", `${trimmedUrl}\n`, "headers = ", headers, "data = ", body);
      const response = trimmedUrl;
      responses.push(response);
    } catch (error) {
      console.error("Error:", error.response?.data?.message || error.message);
      throw error;
    }
  }
  return responses;
};

module.exports = {
  addOrderModel,
  updateOrderModel,
  updatePaymentOrderModel,
  updateTrackingOrderModel,
  deleteOrderModel
};
