const axios = require("axios");
const https = require("https");
const moment = require("moment");
require("dotenv").config();
const isEmpty = require("lodash.isempty");
const log = require("../middleware/logger");
const dateHelper = require("../helpers/dateHelper");
const db = require("../services/connectionService");

const addOrderModel = async (body, headers) => {
  const connection = await db.getConnection();
  try {
    if (!isEmpty(body)) {
      await responseResultOrder(body, headers);
      return body.number;
    }
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};
const updateOrderModel = async (body, headers) => {
  const connection = await db.getConnection();
  try {
    if (!isEmpty(body)) {
      await responseResultOrder(body, headers);
      return body.number;
    }
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};
const updatePaymentOrderModel = async (body, headers) => {
  const connection = await db.getConnection();
  try {
    if (!isEmpty(body)) {
      await responseResultOrder(body, headers);
      return body.number;
    }
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};
const updateTrackingOrderModel = async (body, headers) => {
  const connection = await db.getConnection();
  try {
    if (!isEmpty(body)) {
      await responseResultOrder(body, headers);
      // [{"trackingno":"THP0001","trackingurl":"","shippingdate":null}]
      const result = body.map((item) => item.trackingno);
      return result;
    }
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};
const deleteOrderModel = async (body, headers) => {
  const connection = await db.getConnection();
  try {
    if (!isEmpty(body)) {
      await responseResultOrder(body, headers);
      return body.number;
    }
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};

const getUrl = async () => {
  const connection = await db.getConnection();
  try {
    const query = "SELECT url FROM web_links WHERE active = 1";
    const [data] = await connection.query(query);
    return data.length > 0 ? { result: data } : null;
  } catch (error) {
    throw error;
  } finally {
    connection?.release();
  }
};

const responseResultOrder = async (body, headers) => {
  const url = await getUrl();
  console.log("url", url);

  if (!isEmpty(url)) {
    for (const link of url?.result) {
      console.log("method:post", "url:", `${link.url}`, "headers:", `${JSON.stringify(headers, null, 2)}`, "data:", `${JSON.stringify(body, null, 2)}`);
      // return axios({
      //   method: "post",
      //   url: `${link.url}`,
      //   headers: { headers },
      //   data: { body },
      //   httpsAgent: new https.Agent({ rejectUnauthorized: false })
      // })
      //   .then((response) => {
      //     return response;
      //   })
      //   .catch((error) => {
      //     console.log(error.response.data.message);
      //     throw new Error(error.response.data.message);
      //   });
    }
  }
};

module.exports = {
  addOrderModel,
  updateOrderModel,
  updatePaymentOrderModel,
  updateTrackingOrderModel,
  deleteOrderModel
};
