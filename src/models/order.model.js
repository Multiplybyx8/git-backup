const axios = require("axios");
const https = require("https");
const isEmpty = require("lodash.isempty");
const db = require("../services/connectionService");

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

const orderModelBase = async (body, headers, query, processCallback) => {
  if (isEmpty(body)) return null;

  const resultOrder = await responseResultOrder(body, headers, query);
  const resultData = {
    number: processCallback ? processCallback(body) : body.number,
    status: resultOrder == null ? null : resultOrder
  };

  return resultData;
};

const addOrderModel = (body, headers, query) => orderModelBase(body, headers, query);
const updateOrderModel = (body, headers, query) => orderModelBase(body, headers, query);
const updatePaymentOrderModel = (body, headers, query) => orderModelBase(body, headers, query);
const updateTrackingOrderModel = (body, headers, query) => orderModelBase(body, headers, query, (body) => body.map((item) => item.trackingno));
const deleteOrderModel = (body, headers, query) => orderModelBase(body, headers, query);

const getUrl = () =>
  withDbConnection(async (connection) => {
    const query = "SELECT url FROM web_links WHERE active = 1";
    const [data] = await connection.query(query);
    return data.length > 0 ? { result: data } : null;
  });

const responseResultOrder = async (body, headers, query) => {
  const urlData = await getUrl();

  if (isEmpty(urlData)) return null;
  const { result: urls } = urlData;
  const responses = [];

  for (const { url } of urls) {
    try {
      const trimmedUrl = url.trim();
      await axios.post(trimmedUrl, {
        headers: headers,
        query: query,
        data: body
        // httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });

      const responsePush = trimmedUrl;
      responses.push(responsePush);
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
