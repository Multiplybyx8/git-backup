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

const orderModelBase = async (body, headers, processCallback) => {
  if (isEmpty(body)) return null;

  const resultOrder = await responseResultOrder(body, headers);
  const resultData = {
    number: processCallback ? processCallback(body) : body.number,
    status: resultOrder == null ? null : resultOrder
  };

  return resultData;
};

const addOrderModel = (body, headers) => orderModelBase(body, headers);
const updateOrderModel = (body, headers) => orderModelBase(body, headers);
const updatePaymentOrderModel = (body, headers) => orderModelBase(body, headers);
const updateTrackingOrderModel = (body, headers) => orderModelBase(body, headers, (body) => body.map((item) => item.trackingno));
const deleteOrderModel = (body, headers) => orderModelBase(body, headers);

const getUrl = () =>
  withDbConnection(async (connection) => {
    const query = "SELECT url FROM web_links WHERE active = 1";
    const [data] = await connection.query(query);
    return data.length > 0 ? { result: data } : null;
  });

const responseResultOrder = async (body, headers) => {
  const urlData = await getUrl();

  if (isEmpty(urlData)) return null;
  const { result: urls } = urlData;
  const responses = [];

  for (const { url } of urls) {
    try {
      const trimmedUrl = url.trim();
      await axios.post(trimmedUrl, {
        headers: headers,
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
