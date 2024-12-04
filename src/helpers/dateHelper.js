const isNil = require("lodash.isnil");
const moment = require("moment-timezone");
require("dotenv").config();

const timeToUnix = (data) => {
  const dateObject = new Date(data);
  const unixTimestamp = Math.floor(dateObject.getTime() / 1000);
  return unixTimestamp;
};

const unixToTime = (data) => {
  const dateObject = new Date(data * 1000);
  const formattedDateTime = dateObject.toISOString();
  return formattedDateTime;
};

const changeDateTH = (data) => {
  const dd = moment.locale("th");
  const dateTime = moment(data).add(543, "year").format("LL");
  return dateTime;
};

const dateOnly = () => {
  return moment().tz("Asia/Bangkok").format("YYYY-MM-DD");
};
const dateT = () => {
  return moment().tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss");
};
const dateISO = (data) => {
  //2024-09-19T02:01:01.000Z -> 2024-09-19 09:01:01

  if (isNil(data)) {
    return null;
  }

  const formatDate = typeof data === "string" ? moment(data).tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss") : moment(data).tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss");

  return formatDate;
};
const datetoISOString = (data) => {
  if (isNil(data)) {
    return null;
  }
  return moment(data).toISOString();
};
const dateN = () => {
  return moment().tz("Asia/Bangkok").format("YYYY-MM-DD");
};
const timeN = (time) => {
  const [hours, minutes, seconds] = time?.split(":");
  const date = new Date();
  date.setUTCHours(hours, minutes, seconds);
  const times = date.toISOString().slice(11, 19);
  return times;
};

module.exports = {
  timeToUnix,
  unixToTime,
  changeDateTH,
  dateT,
  dateISO,
  datetoISOString,
  dateN,
  timeN,
  dateOnly
};
