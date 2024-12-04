const moment = require("moment-timezone");
const dateHelper = require("../helpers/dateHelper");
const isEmpty = require("lodash.isempty");
require("dotenv").config();

const generateRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const replaceCharacters = (data) => {
  const withoutComma = data.replace(/,/g, "");
  const withoutDot = withoutComma.replace(/\./g, "");
  const withoutSlash = withoutDot.replace(/\//g, "");
  const withoutSingle = withoutSlash.replace(/\'/g, "");
  return withoutSingle;
};

const replaceTextMenu = (text) => {
  const textLower = text.toLowerCase().trim();
  const textOutput = textLower.replace(/[\/\\&'"]/g, "").replace(/ /g, "_");
  return textOutput;
};

const currencyFormat = (number) => {
  return Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 2
  }).format(number);
};

const currencyFormat1 = (number) => {
  return Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 1
  }).format(number);
};

const questionNumbers = (number) => {
  return Array(number).fill("?").join(",");
};

const formatPhoneNumber = (data) => {
  const cleanedString = data.replaceAll("-", "");
  const areaCode = cleanedString.substr(0, 2);
  const firstPart = cleanedString.substr(2, 3);
  const secondPart = cleanedString.substr(5, 4);
  const phoneNewFormat = areaCode + "-" + firstPart + "-" + secondPart;
  return phoneNewFormat;
};

const trimSpace = (data) => {
  const trimspace = data.replace(/\s+/g, " ").trim();
  return trimspace;
};

const numberFormat = (num) => {
  if (num) {
    return parseFloat(num)
      .toFixed(2)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else {
    return parseFloat(0)
      .toFixed(2)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
};

const mapTable = (data, tblPrefix) => {
  let maplist = "";
  if (data.length > 0) {
    const filterConditions = data.map((key) => `${tblPrefix}.${key}`);
    maplist = `${filterConditions.join(",")}`;
  }
  return maplist;
};

const mapTableCol = (data) => {
  return data.join(",");
};

const mapTableVal = (data) => {
  let maplist = "";
  if (data.length > 0) {
    const mapConditions = data.map((key) => `@${key}`);
    maplist += mapConditions.join(",");
  }
  return maplist;
};

const mapTableSetUpdate = (data) => {
  let maplist = "";
  if (data.length > 0) {
    const mapConditions = data.map((key) => `${key} = @${key}`);
    maplist += mapConditions.join(",");
  }
  return maplist;
};

const transformKeySort = (key) => {
  let [firstPart, ...restParts] = key.split("_");
  const transformed = `${firstPart}.${key}`;

  return transformed.replace(/(\w+)_active$/, "active");
};

const transformKeys = (keys, value) => {
  return Array.isArray(keys) ? keys.map((key) => transformKey(key, value)) : transformKey(keys, value);
};

const transformKey = (key, value) => {
  if (!key.includes("_")) {
    return key;
  }

  const parts = key.split("_");

  // Join the first two parts with a dot and leave the rest as underscores
  if (parts.length > 1) {
    const firstTwoParts = parts.slice(0, 2).join(".");
    const restParts = parts.slice(2).join("_");
    return restParts ? `${firstTwoParts}_${restParts}` : firstTwoParts;
  }

  return key;
};

const processFilter = async (filter) => {
  let whereClause = "WHERE 1 = 1";
  const filterValues = [];

  for (const [key, value] of Object.entries(filter)) {
    const transformedKey = transformKeys(key, value);

    console.log("transformedKey", transformedKey);

    if (typeof value === "string" && value.includes(",")) {
      const idArray = value.split(",").map((item) => item.trim());
      const placeholders = idArray.map(() => "?").join(", ");
      whereClause += ` AND ${transformedKey} IN (${placeholders})`;
      filterValues.push(...idArray);
    } else if (value.length > 0) {
      whereClause += ` AND ${transformedKey} = ?`;
      const newValue = await dateHelper.dateISO(value);

      if (newValue === "Invalid date") {
        filterValues.push(value);
      } else {
        filterValues.push(newValue);
      }
    }
  }
  return { whereClause, filterValues };
};

const countMenu = async (data) => {
  const menu_id = data.map((e) => e.menu_id);
  const filteredData = menu_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const countOptions = async (data) => {
  const option_id = data.map((e) => e.option_id);
  const filteredData = option_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const countCustomers = async (data) => {
  const customer_id = data.map((e) => e.customer_id);
  const filteredData = customer_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};

const countBranch = async (data) => {
  const branch_id = data.map((e) => e.branch_id);
  const filteredData = branch_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const countProvinces = async (data) => {
  const province_id = data.map((e) => e.province_id);
  const filteredData = province_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const countDistrict = async (data) => {
  const district_id = data.map((e) => e.district_id);
  const filteredData = district_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const countSubDistrict = async (data) => {
  const subdistrict_id = data.map((e) => e.subdistrict_id);
  const filteredData = subdistrict_id.filter((value) => value !== null);
  const uniqueValues = new Set(filteredData);
  const countUniqueNonNull = uniqueValues.size;
  return countUniqueNonNull;
};
const trimData = async (input) => {
  if (input === null || input === undefined || input === "") {
    return input; // ถ้าเป็นค่าว่าง null หรือ undefined ให้ return ค่าเดิม
  }

  if (Array.isArray(input)) {
    return input.map((item) => trimData(item)); // ถ้าเป็น array ให้ใช้ trimData กับแต่ละ item ใน array
  } else if (typeof input === "object" && input !== null) {
    const trimmedObj = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        // ถ้าค่าเป็น object (nested) หรือ array, ให้เรียก trimData ซ้ำ
        if (typeof input[key] === "object" && input[key] !== null) {
          trimmedObj[key] = await trimData(input[key]);
        }
        // ถ้าค่าเป็น string, ให้ trim แต่ต้องตรวจสอบว่าไม่ใช่ค่าว่าง null หรือ undefined
        else if (typeof input[key] === "string" && input[key] !== null && input[key] !== undefined && input[key] !== "") {
          trimmedObj[key] = input[key].trim();
        }
        // ถ้าเป็นชนิดข้อมูลอื่นๆ ให้คงค่าเดิม
        else {
          trimmedObj[key] = input[key];
        }
      }
    }
    return trimmedObj;
  } else if (typeof input === "string") {
    // ถ้าเป็น string ธรรมดา, ให้ trim แล้ว return ค่า
    return input.trim();
  }

  return input; // ถ้าไม่ใช่ทั้ง array, object หรือ string ก็ return input เดิม
};

const trimDatNotPrototypeChain = async (input) => {
  if (input === null || input === undefined || input === "") {
    return input; // ถ้าเป็นค่าว่าง null หรือ undefined ให้ return ค่าเดิม
  }

  if (Array.isArray(input)) {
    return input.map((item) => trimData(item)); // ถ้าเป็น array ให้ใช้ trimData กับแต่ละ item ใน array
  } else if (typeof input === "object") {
    // ใช้ Object.entries แทนการใช้ for..in เพื่อรองรับ Object ที่ไม่มี prototype
    const trimmedObj = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "object" && value !== null) {
        trimmedObj[key] = trimData(value);
      } else if (typeof value === "string") {
        trimmedObj[key] = value.trim();
      } else {
        trimmedObj[key] = value;
      }
    }
    return trimmedObj;
  } else if (typeof input === "string") {
    // ถ้าเป็น string ธรรมดา, ให้ trim แล้ว return ค่า
    return input.trim();
  }

  return input; // ถ้าไม่ใช่ทั้ง array, object หรือ string ก็ return input เดิม
};

// --------------sort

const mapSortKey = (sortMapping, sortKey) => {
  return sortMapping[sortKey] || sortKey; // หากมี mapping จะใช้, ถ้าไม่มีก็ใช้ key เดิม
};

const orderByClause = async (sortMapping, filter, data) => {
  let orderByClause = "";
  let filterOrder = filter?.order ?? "ASC";

  if (filter?.sort && filterOrder) {
    const sortKey = mapSortKey(sortMapping, filter?.sort); // แปลง sort key ที่มาจาก frontend
    const allowedSortColumns = data;
    const allowedOrderDirections = ["ASC", "DESC"];
    if (allowedSortColumns.includes(sortKey) && allowedOrderDirections.includes(filterOrder.toUpperCase())) {
      return (orderByClause = `ORDER BY ${sortKey} ${filterOrder.toUpperCase()}`);
    } else {
      throw new Error(`Invalid Value - sort.`);
    }
  }
};

const paginate = ({ page = 1, limit = 1000 }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 1000;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const checkJsonString = (data) => {
  // return typeof data == "string" ? JSON.parse(data) : data;
  return data ? (typeof data === "string" ? JSON.parse(data) : data) : "";
};
const calculateAge = (input) => {
  if (input === undefined || input === null) {
    return null;
  }
  const birthDate = new Date(input);
  const today = new Date();

  if (isNaN(birthDate)) {
    throw new Error("Invalid date format.");
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const validateNumeric = (value) => {
  return /^\d+$/.test(value) ? parseInt(value) : null;
};

module.exports = {
  generateRandomNumber,
  currencyFormat,
  currencyFormat1,
  generateHash,
  questionNumbers,
  formatPhoneNumber,
  trimSpace,
  numberFormat,
  replaceCharacters,
  mapTable,
  mapTableCol,
  mapTableVal,
  mapTableSetUpdate,
  replaceTextMenu,
  processFilter,
  countMenu,
  countBranch,
  trimDatNotPrototypeChain,
  transformKeys,
  trimData,
  transformKeySort,
  orderByClause,
  paginate,
  checkJsonString,
  calculateAge,
  countCustomers,
  validateNumeric,
  countOptions,
  countProvinces,
  countDistrict,
  countSubDistrict
};
