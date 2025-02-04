const axios = require("axios");
const https = require("https");
const isEmpty = require("lodash.isempty");
const { withDbConnection } = require("../services/withDbConnection");

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

const getUrl = (query) => {
  const resultMethod = query.method;
  let queryMethod = resultMethod?.toUpperCase();

  return withDbConnection(
    async (connection) => {
      const query = "SELECT url,type,projects FROM web_links WHERE active = 1 AND type = ?";
      const [data] = await connection.query(query, [queryMethod]);
      return data.length > 0 ? { result: data } : null;
    }
    //, "manage"  -> name database(2)
  );
};

const responseResultOrder = async (body, headers, query) => {
  console.log("query", query);

  const headersAuth = headers?.authorization || "";
  const urlData = await getUrl(query);

  console.log("urlData", urlData);

  if (isEmpty(urlData)) return null;
  const { result: urls } = urlData;

  const responses = [];

  for (const path of urls) {
    try {
      const project = path?.projects;
      let key3 = query?.key3;
      key3 = key3.split(":")[0];
      console.log("split key3", key3);

      const trimmedUrl = path.url.trim();

      if (project == "GeminiFourth" && key3 !== "pas") {
        console.log("GeminiFourth not Brand Pastel creative");
      } else {
        await axios.post(trimmedUrl, body, {
          headers: {
            Authorization: headersAuth,
            "Content-Type": "application/json"
          },
          query: query,
          data: body
        });
      }

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
