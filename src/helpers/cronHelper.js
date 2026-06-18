const THAI_DAYS = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

const formatTime = (hour, minute) => {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${hh}:${mm} น.`;
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const describeCronSchedule = (expression, timezone = "Asia/Bangkok") => {
  if (!expression || typeof expression !== "string") {
    return "ยังไม่ได้ตั้งค่า";
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return expression;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = minute.slice(2);
    return `ทุก ${interval} นาที (${timezone})`;
  }

  if (hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = hour.slice(2);
    return `ทุก ${interval} ชั่วโมง (${timezone})`;
  }

  const minuteValue = parseNumber(minute);
  const hourValue = parseNumber(hour);

  if (minuteValue !== null && hourValue !== null && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `ทุกวัน เวลา ${formatTime(hourValue, minuteValue)} (${timezone})`;
  }

  if (minuteValue !== null && hourValue !== null && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const dayIndex = parseNumber(dayOfWeek);
    if (dayIndex !== null && dayIndex >= 0 && dayIndex <= 6) {
      return `ทุก${THAI_DAYS[dayIndex]} เวลา ${formatTime(hourValue, minuteValue)} (${timezone})`;
    }
  }

  if (minuteValue !== null && hourValue !== null && dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    return `ทุกวันที่ ${dayOfMonth} ของเดือน เวลา ${formatTime(hourValue, minuteValue)} (${timezone})`;
  }

  return `${expression} (${timezone})`;
};

module.exports = {
  describeCronSchedule
};
